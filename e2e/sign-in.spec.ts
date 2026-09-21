import { test, expect } from '@playwright/test'

// Unauthenticated journeys — no storage state.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Sign in', () => {
  test('rejects invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.getByLabel('Email').fill('nobody@example.com')
    await page.getByLabel('Password', { exact: true }).fill('wrong-password')
    await page.locator('form').getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/signin/)
  })

  test('redirects an unauthenticated visitor to sign in', async ({ page }) => {
    // /customer/** is guarded by src/proxy.ts, which redirects a missing
    // session straight to sign-in before any page code runs.
    await page.goto('/customer/documents')
    await page.waitForURL(/\/auth\/signin/)
  })

  test('bounces an unauthenticated visitor off the admin portal', async ({
    page
  }) => {
    // /admin has no proxy matcher — auth is enforced client-side by
    // AdminPageGuard, which sends anyone without the role to /unauthorized
    // rather than /auth/signin.
    await page.goto('/admin')
    await page.waitForURL(/\/unauthorized/)
  })
})
