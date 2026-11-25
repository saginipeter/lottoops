import { test, expect } from "@playwright/test";

test("employee signs in directly and chooses a shift after authentication", async ({ page }) => {
  const requests: Array<{ url: string; body: unknown }> = [];
  await page.route("**/api/auth/login", async (route) => {
    requests.push({ url: "/api/auth/login", body: route.request().postDataJSON() });
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
  await page.waitForURL((url) => url.pathname === "/shifts");
  await expect(page.getByText("Shift selection")).toBeVisible();
  await expect(page.getByLabel(/verification code/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /resend/i })).toHaveCount(0);
  expect(requests).toEqual([
    { url: "/api/auth/login", body: { email: "staff@example.test", password: "local-test-password", rememberMe: false } },
  ]);
});

test("configured authenticator MFA remains supported without an email OTP step", async ({ page }) => {
  const requests: Array<{ url: string; body: unknown }> = [];
  await page.route("**/api/auth/login", async (route) => {
    requests.push({ url: "/api/auth/login", body: route.request().postDataJSON() });
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
  await page.getByLabel("Email address").fill("staff@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill("local-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByLabel("Authenticator code")).toBeVisible();
  await expect(page.getByLabel(/email verification code/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /resend/i })).toHaveCount(0);
  await page.getByLabel("Authenticator code").fill("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/shifts");
  expect(requests).toEqual([
    { url: "/api/auth/login", body: { email: "staff@example.test", password: "local-test-password", rememberMe: false } },
    { url: "/api/auth/mfa/verify", body: { code: "123456" } },
  ]);
});

test("manager login routes to shift selection without preserving stale selector parameters", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/api/auth/login", async (route) => {
    requests.push(new URL(route.request().url()).pathname);
    await route.fulfill({ json: { ok: true, user: { role: "MANAGER", needsShiftSelection: false } } });
  });
  await page.route((url) => url.pathname === "/shifts", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html", body: "<main>Choose Shift + Terminal</main>" });
  });
  await page.goto("/login?from=%2Fshifts%3Fterminal%3DT1%26shiftId%3Dprevious-session-shift");
  await page.getByLabel("Email address").fill("manager@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill("local-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/shifts");
  await expect(page).toHaveURL(/\/shifts$/);
  await expect(page.getByText("Choose Shift + Terminal")).toBeVisible();
  await expect(page.getByLabel(/verification code/i)).toHaveCount(0);
  expect(requests).toEqual(["/api/auth/login"]);
});
