import bcrypt from "bcryptjs";

type PasswordChangeResult =
  | { password: string; error?: never; status?: never }
  | { password?: never; error: string; status: 400 | 403 };

export async function verifyPasswordChange(
  currentPassword: unknown,
  password: unknown,
  targetPasswordHash: string,
): Promise<PasswordChangeResult> {
  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return { error: "The account's current password is required.", status: 400 };
  }
  if (typeof password !== "string" || password.length < 8) {
    return { error: "New password must be a string of at least 8 characters.", status: 400 };
  }
  if (!await bcrypt.compare(currentPassword, targetPasswordHash)) {
    return { error: "The account's current password is incorrect.", status: 403 };
  }
  return { password };
}
