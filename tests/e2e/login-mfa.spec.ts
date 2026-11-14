import { test, expect } from "@playwright/test";

test("MFA verification submits the code and routes unassigned staff to Shift Management", async ({ page }) => {
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
  const email = page.getByRole("textbox", { name: "Email address" });
  await expect(email).toBeFocused();
  await email.fill("staff@example.test");
  await expect(email).toHaveValue("staff@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill("local-test-password");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByLabel("Authenticator code")).toBeVisible();
  await page.getByLabel("Authenticator code").fill("123456");
  const verificationRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/auth/mfa/verify");
  await page.getByRole("button", { name: "Sign in" }).click();
  await verificationRequest;
  await page.waitForURL((url) => url.pathname === "/shifts");
  await expect(page.getByText("Shift selection")).toBeVisible();

  expect(requests).toEqual([
    { url: "/api/auth/login", body: { email: "staff@example.test", password: "local-test-password", rememberMe: false } },
    { url: "/api/auth/mfa/verify", body: { code: "123456" } },
  ]);
});
