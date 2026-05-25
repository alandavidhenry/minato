import { expect, test } from '@playwright/test'

test.describe('Sign-in page', () => {
  test('renders the sign-in form', async ({ page }) => {
    await page.goto('/auth/signin')

    await expect(
      page.getByText('Sign in to Document Portal')
    ).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('shows forgot password link', async ({ page }) => {
    await page.goto('/auth/signin')

    const link = page.getByRole('link', { name: 'Forgot your password?' })
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL('/auth/forgot-password')
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.route('/api/auth/csrf', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'mock-csrf-token' })
      })
    )
    await page.route('/api/auth/callback/credentials', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'http://localhost:3000/api/auth/error?error=CredentialsSignin'
        })
      })
    )

    await page.goto('/auth/signin')
    await page.getByLabel('Email').fill('wrong@test.com')
    await page.locator('#password').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()

    await expect(page.getByText('Invalid email or password')).toBeVisible()
  })

  test('disables button while signing in', async ({ page }) => {
    await page.route('/api/auth/csrf', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'mock-csrf-token' })
      })
    )
    // Delay the response so we can check the loading state
    await page.route('/api/auth/callback/credentials', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'http://localhost:3000/api/auth/error?error=CredentialsSignin'
        })
      })
    })

    await page.goto('/auth/signin')
    await page.getByLabel('Email').fill('user@test.com')
    await page.locator('#password').fill('password123')
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('button[type="submit"]')).toBeDisabled()
  })
})

test.describe('Forgot password page', () => {
  test('renders the form', async ({ page }) => {
    await page.goto('/auth/forgot-password')

    await expect(page.getByText('Reset your password')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
  })
})
