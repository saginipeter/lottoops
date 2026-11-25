import { test, expect } from "@playwright/test";

test("email OTP is mandatory before configured authenticator verification and staff routing", async ({ page }) => {
  const requests: Array<{ url: string; body: unknown }> = [];
  await page.route("**/api/auth/login", async (route) => {
    requests.push({ url: "/api/auth/login", body: route.request().postDataJSON() });
    await route.fulfill({ status: 202, json: { emailOtpRequired: true } });
  });
  await page.route("**/api/auth/email-otp/verify", async (route) => {
    requests.push({ url: "/api/auth/email-otp/verify", body: route.request().postDataJSON() });
    await route.fulfill({ status: 202, json: { mfaRequired: true } });
  });
  await page.route("**/api/auth/mfa/verify", async (route) => {
    requests.push({ url: "/api/auth/mfa/verify", body: route.request().postDataJSON() });
    await route.fulfill({ json: { ok: true, user: { role: "EMPLOYEE", needsShiftSelection: true } } });
  });
  await page.route((url) => url.pathname === "/shifts", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html", body: "<main>Shift selection</main>" });
  });
  await page.goto("/login");
  const email = page.getByRole("textbox", { name: "Email address" });
  await expect(email).toBeFocused();
  await email.fill("staff@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill("local-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByLabel("Email verification code")).toBeVisible();
  await expect(page.getByText("Enter the 6-digit code sent to staff@example.test. It expires in 5 minutes.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend verification code" })).toBeVisible();
  await page.getByLabel("Email verification code").fill("001234");
  const emailVerificationRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/auth/email-otp/verify");
  await page.getByRole("button", { name: "Sign in" }).click();
  await emailVerificationRequest;
  await expect(page.getByLabel("Authenticator code")).toBeVisible();
  await page.getByLabel("Authenticator code").fill("123456");
  const totpVerificationRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/auth/mfa/verify");
  await page.getByRole("button", { name: "Sign in" }).click();
  await totpVerificationRequest;
  await page.waitForURL((url) => url.pathname === "/shifts");
  await expect(page.getByText("Shift selection")).toBeVisible();
  expect(requests).toEqual([
    { url: "/api/auth/login", body: { email: "staff@example.test", password: "local-test-password", rememberMe: false } },
    { url: "/api/auth/email-otp/verify", body: { code: "001234" } },
    { url: "/api/auth/mfa/verify", body: { code: "123456" } },
  ]);
});

test("manager logins also require explicit shift and terminal selection", async ({ page }) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({ status: 202, json: { emailOtpRequired: true } });
  });
  await page.route("**/api/auth/email-otp/verify", async (route) => {
    await route.fulfill({ json: { ok: true, user: { role: "MANAGER", needsShiftSelection: false } } });
  });
  await page.route((url) => url.pathname === "/shifts", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html", body: "<main>Choose Shift + Terminal</main>" });
  });
  await page.goto("/login?from=%2Fshifts%3Fterminal%3DT1%26shiftId%3Dprevious-session-shift");
  await page.getByLabel("Email address").fill("manager@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill("local-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Email verification code").fill("004321");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/shifts");
  await expect(page).toHaveURL(/\/shifts$/);
  await expect(page.getByText("Choose Shift + Terminal")).toBeVisible();
});

test("login renders the six-digit email OTP code field after the password checkpoint", async ({ page }) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({ status: 202, json: { emailOtpRequired: true } });
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("staff@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill("local-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  const code = page.getByLabel("Email verification code");
  await expect(code).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
  await code.fill("12abc456789");
  await expect(code).toHaveValue("124567");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
});
