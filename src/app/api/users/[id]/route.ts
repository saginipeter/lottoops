import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  assertEmployeeUserIdAvailable,
  getEmployeeIdsForUsers,
  setEmployeeUserId,
} from "@/lib/user-profiles";

// PATCH /api/users/[id] — update name, role, active, or reset password
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "MANAGER" && session.role !== "OWNER") return NextResponse.json({ error: "Managers only" }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;

  // Confirm the user belongs to this Manager's store or this Owner's portfolio.
  const existing = await prisma.user.findFirst({
    where: session.role === "OWNER"
      ? { id, store: { ownerUserId: session.userId } }
      : { id, storeId: session.storeId },
    select: { id: true, role: true },
  });
  if (!existing) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // Prevent the manager from demoting or deactivating themselves
  if (id === session.userId) {
    return NextResponse.json(
      { error: "You cannot edit your own account here. Contact the store owner." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { name, role, active, password, grantedPermissions, email, employeeUserId } = body;

  // OWNER can assign any role; MANAGER cannot assign OWNER
  const allowedRoles = session.role === "OWNER"
    ? ["OWNER", "MANAGER", "SHIFT_LEAD", "EMPLOYEE"]
    : ["MANAGER", "SHIFT_LEAD", "EMPLOYEE"];

  if (role !== undefined && !allowedRoles.includes(role)) {
    return NextResponse.json(
      { error: role === "OWNER" ? "Only an Owner can assign the Owner role." : "Invalid role." },
      { status: 403 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = String(name).trim();
  if (email !== undefined) {
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
    const taken = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        id: { not: id },
      },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    updateData.email = normalizedEmail;
  }
  if (role !== undefined) updateData.role = role;
  if (active !== undefined) updateData.active = Boolean(active);
  if (grantedPermissions !== undefined && Array.isArray(grantedPermissions)) {
    updateData.grantedPermissions = grantedPermissions.filter((p: unknown) => typeof p === "string");
  }
  if (password !== undefined) {
    if (String(password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    updateData.passwordHash = await bcrypt.hash(String(password), 12);
  }

  if (Object.keys(updateData).length === 0) {
    if (employeeUserId === undefined) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }
  }

  if (employeeUserId !== undefined && String(employeeUserId).trim()) {
    try {
      await assertEmployeeUserIdAvailable(String(employeeUserId), id);
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

  const user = Object.keys(updateData).length
    ? await prisma.user.update({
        where: { id },
        data: updateData,
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
      })
    : await prisma.user.findUniqueOrThrow({
        where: { id },
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
    await setEmployeeUserId(id, String(employeeUserId));
  }

  const employeeIdMap = await getEmployeeIdsForUsers([id]);

  return NextResponse.json({
    user: {
      ...user,
      employeeUserId: employeeIdMap.get(id) ?? null,
    },
  });
}

// DELETE /api/users/[id] — deactivate (soft delete only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "MANAGER" && session.role !== "OWNER") return NextResponse.json({ error: "Managers only" }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;

  if (id === session.userId) {
    return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { id, storeId: session.storeId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "User not found." }, { status: 404 });

  await prisma.user.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
