import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  assertEmployeeUserIdAvailable,
  ensureUserProfilesTable,
  getEmployeeIdsForUsers,
  setEmployeeUserId,
} from "@/lib/user-profiles";

// GET /api/users — list all users for the store
export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "MANAGER" && session.role !== "OWNER") return NextResponse.json({ error: "Managers only" }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const users = await prisma.user.findMany({
    where: { storeId: session.storeId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      lastLoginAt: true,
      grantedPermissions: true,
    },
    orderBy: { createdAt: "asc" },
  });

  await ensureUserProfilesTable();
  const employeeIdMap = await getEmployeeIdsForUsers(users.map((u) => u.id));

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      employeeUserId: employeeIdMap.get(u.id) ?? null,
    })),
  });
}

// POST /api/users — create a new user
export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "MANAGER" && session.role !== "OWNER") return NextResponse.json({ error: "Managers only" }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { name, email, password, role, employeeUserId } = body;

  if (!name?.trim() || !email?.trim() || !password?.trim() || !role) {
    return NextResponse.json({ error: "Name, email, password, and role are required." }, { status: 400 });
  }

  // OWNER can create any role including other OWNERs.
  // MANAGER can only create MANAGER, SHIFT_LEAD, EMPLOYEE — not OWNER.
  const allowedRoles = session.role === "OWNER"
    ? ["OWNER", "MANAGER", "SHIFT_LEAD", "EMPLOYEE"]
    : ["MANAGER", "SHIFT_LEAD", "EMPLOYEE"];

  if (!allowedRoles.includes(role)) {
    return NextResponse.json(
      { error: role === "OWNER" ? "Only an Owner can create another Owner account." : "Invalid role." },
      { status: 403 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const normalizedEmployeeUserId = employeeUserId ? String(employeeUserId).trim() : "";

  // Check email not already taken
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }
  if (normalizedEmployeeUserId) {
    try {
      await assertEmployeeUserIdAvailable(normalizedEmployeeUserId);
    } catch (error) {
      if (error instanceof Error && error.message === "EMPLOYEE_USER_ID_TAKEN") {
        return NextResponse.json(
          { error: "Employee User ID is already assigned to another user." },
          { status: 409 }
        );
      }
      throw error;
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      storeId: session.storeId,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      lastLoginAt: true,
      grantedPermissions: true,
    },
  });

  if (employeeUserId !== undefined) {
    await setEmployeeUserId(user.id, String(employeeUserId));
  }

  return NextResponse.json(
    {
      user: {
        ...user,
        employeeUserId: normalizedEmployeeUserId || null,
      },
    },
    { status: 201 }
  );
}
