import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { findMockUser } from "@/lib/mock-users";

// Tries the real database first. If there's no live connection (prisma is
// null, or the query throws — e.g. DATABASE_URL not set, Neon unreachable,
// migrations not yet run), falls back to local mock users so the app keeps
// working offline. Once a real DB is wired up, this fallback simply never
// fires and behavior is identical to a normal online login.
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    let authResult: {
      userId: string;
      storeId: string;
      storeName: string;
      name: string;
      email: string;
      role: "OWNER" | "MANAGER" | "SHIFT_LEAD" | "EMPLOYEE";
      grantedPermissions: string[];
    } | null = null;

    const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
    const allowOfflineFallback = !hasDatabaseUrl || !prisma;

    // Attempt 1: real database
    if (prisma) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          include: { store: true },
        });

        if (user && user.active) {
          const passwordValid = await bcrypt.compare(password, user.passwordHash);
          if (passwordValid) {
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            });
            authResult = {
              userId: user.id,
              storeId: user.storeId,
              storeName: user.store.name,
              name: user.name,
              email: user.email,
              role: user.role,
              grantedPermissions: user.grantedPermissions ?? [],
            };
          } else {
            return NextResponse.json(
              { error: "Invalid email or password" },
              { status: 401 }
            );
          }
        }
      } catch (dbErr) {
        if (!allowOfflineFallback) {
          return NextResponse.json(
            {
              error:
                "Database is temporarily unavailable. Please try again in a moment.",
            },
            { status: 503 }
          );
        }
        // No live connection in offline mode — fall through to mock auth.
        console.warn(
          "[login] Database unavailable, falling back to offline mode:",
          dbErr instanceof Error ? dbErr.message : dbErr
        );
      }
    }

    // Attempt 2: offline mock users (only when offline fallback is allowed)
    if (!authResult) {
      if (!allowOfflineFallback) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }
      const mockUser = findMockUser(normalizedEmail);
      if (!mockUser || !mockUser.active || mockUser.password !== password) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }
      authResult = {
        userId: mockUser.id,
        storeId: mockUser.storeId,
        storeName: mockUser.storeName,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
        grantedPermissions: mockUser.grantedPermissions ?? [],
      };
    }

    const token = await signSession({
      userId: authResult.userId,
      storeId: authResult.storeId,
      storeName: authResult.storeName,
      name: authResult.name,
      email: authResult.email,
      role: authResult.role,
      grantedPermissions: authResult.grantedPermissions,
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        name: authResult.name,
        email: authResult.email,
        role: authResult.role,
        storeName: authResult.storeName,
      },
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours, matching JWT expiry
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
