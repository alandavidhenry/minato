import { test, expect } from '@playwright/test'

import { ADMIN_STATE } from './credentials'

test.use({ storageState: ADMIN_STATE })

test.describe('Admin portal', () => {
  test('dashboard shows compliance KPIs', async ({ page }) => {
    await page.goto('/admin')

    await expect(
      page.getByRole('heading', { name: 'Admin Dashboard' })
    ).toBeVisible()
    await expect(page.getByText('Active Assignments')).toBeVisible()
    await expect(page.getByText('Completed This Month')).toBeVisible()
  })

  test('navigates to companies, templates and users via the sidebar', async ({
    page
  }) => {
    // The sidebar defaults to "hover" mode, where nav labels only become
    // clickable once the rail widens on hover — pin it "expanded" up front
    // so link clicks are reliable rather than timing-dependent.
    await page.addInitScript(() => {
      window.localStorage.setItem('sidebar-mode', 'expanded')
    })
    await page.goto('/admin')

    await page.getByRole('link', { name: 'Companies', exact: true }).click()
    await page.waitForURL(/\/admin\/companies$/)
    await expect(
      page.getByRole('heading', { name: 'Client Companies' })
    ).toBeVisible()

    await page.getByRole('link', { name: 'Templates', exact: true }).click()
    await page.waitForURL(/\/admin\/templates$/)
    await expect(
      page.getByRole('heading', { name: 'Document Templates' })
    ).toBeVisible()

    await page.getByRole('link', { name: 'Users', exact: true }).click()
    await page.waitForURL(/\/admin\/users$/)
    await expect(
      page.getByRole('heading', { name: 'User Management' })
    ).toBeVisible()
  })

  test('lists at least one seeded client company', async ({ page }) => {
    await page.goto('/admin/companies')

    await expect(page.getByText('Northgate Logistics')).toBeVisible()
  })
})
