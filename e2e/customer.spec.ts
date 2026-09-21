import { test, expect } from '@playwright/test'

import { CUSTOMER_ADMIN_STATE, CUSTOMER_USER_STATE } from './credentials'

test.describe('Customer user', () => {
  test.use({ storageState: CUSTOMER_USER_STATE })

  test('sees their assigned documents', async ({ page }) => {
    await page.goto('/customer/documents')

    await expect(page.getByText(/Welcome back/)).toBeVisible()
  })
})

test.describe('Customer admin', () => {
  test.use({ storageState: CUSTOMER_ADMIN_STATE })

  test('sees their team completions overview', async ({ page }) => {
    await page.goto('/customer/admin/completions')

    await expect(page.getByText(/Welcome back/)).toBeVisible()
  })
})
