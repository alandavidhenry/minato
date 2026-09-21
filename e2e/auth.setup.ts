import { test as setup, expect, type Page } from '@playwright/test'

import {
  ADMIN_STATE,
  CUSTOMER_ADMIN_STATE,
  CUSTOMER_USER_STATE,
  adminCredentials,
  customerAdminCredentials,
  customerUserCredentials
} from './credentials'

async function signIn(
  page: Page,
  email: string,
  password: string,
  expectedUrl: RegExp
) {
  await page.goto('/auth/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.locator('form').getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL(expectedUrl, { timeout: 15_000 })
}

setup('authenticate as tenant admin', async ({ page }) => {
  await signIn(
    page,
    adminCredentials.email,
    adminCredentials.password,
    /\/admin$/
  )
  await expect(
    page.getByRole('heading', { name: 'Admin Dashboard' })
  ).toBeVisible()
  await page.context().storageState({ path: ADMIN_STATE })
})

setup('authenticate as customer admin', async ({ page }) => {
  await signIn(
    page,
    customerAdminCredentials.email,
    customerAdminCredentials.password,
    /\/customer\/admin\/completions$/
  )
  await page.context().storageState({ path: CUSTOMER_ADMIN_STATE })
})

setup('authenticate as customer user', async ({ page }) => {
  await signIn(
    page,
    customerUserCredentials.email,
    customerUserCredentials.password,
    /\/customer\/documents$/
  )
  await page.context().storageState({ path: CUSTOMER_USER_STATE })
})
