import { expect, test } from '@playwright/test'

import { authenticateAsAdmin } from './fixtures/auth-cookies'

test.describe('Admin dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAsAdmin(page)
    await page.route('/api/admin/users', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [
            {
              id: 'u1',
              name: 'Admin User',
              email: 'admin@test.com',
              role: 'Platform Admin'
            },
            {
              id: 'u2',
              name: 'Customer',
              email: 'c@test.com',
              role: 'Customer User'
            }
          ]
        })
      })
    )
    await page.route('/api/admin/companies', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          companies: [
            { id: 'c1', name: 'Acme Ltd' },
            { id: 'c2', name: 'Widgets Inc' }
          ]
        })
      })
    )
    await page.route('/api/documents/stats', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalDocuments: 42 })
      })
    )
    await page.route('/api/admin/activity*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ logs: [] })
      })
    )
  })

  test('shows stats cards with counts', async ({ page }) => {
    await page.goto('/admin')

    await expect(
      page.getByRole('heading', { name: 'Admin Dashboard' })
    ).toBeVisible()

    // Stats cards should show counts from mocked API responses
    await expect(page.getByText('Total Users')).toBeVisible()
    await expect(page.getByText('Admin Users')).toBeVisible()
    await expect(page.getByText('Total Companies')).toBeVisible()
    await expect(page.getByText('Total Documents')).toBeVisible()
  })

  test('shows stats counts loaded from API', async ({ page }) => {
    await page.goto('/admin')

    // Wait for loading to finish — stats appear as text after async fetch
    await expect(page.getByText('2').first()).toBeVisible()
  })

  test('shows navigation sidebar', async ({ page }) => {
    await page.goto('/admin')

    await expect(page.getByRole('link', { name: /Dashboard/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Users/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Companies/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Templates/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Completions/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Settings/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Activity Logs/ })).toBeVisible()
  })
})

test.describe('Admin users page', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAsAdmin(page)
    await page.route('/api/admin/users', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [
            {
              id: 'u1',
              displayName: 'Alice Admin',
              email: 'alice@test.com',
              role: 'Platform Admin',
              jobRole: null,
              lineManagerId: null
            },
            {
              id: 'u2',
              displayName: 'Bob Customer',
              email: 'bob@test.com',
              role: 'Customer User',
              jobRole: 'Operative',
              lineManagerId: null
            }
          ]
        })
      })
    )
  })

  test('shows user list', async ({ page }) => {
    await page.goto('/admin/users')

    await expect(
      page.getByRole('heading', { name: 'User Management' })
    ).toBeVisible()
    await expect(page.getByText('Alice Admin')).toBeVisible()
    await expect(page.getByText('Bob Customer')).toBeVisible()
  })
})

test.describe('Admin companies page', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAsAdmin(page)
    await page.route('/api/admin/companies', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          companies: [
            { id: 'c1', name: 'Acme Ltd', createdAt: '2025-01-01' },
            { id: 'c2', name: 'Widgets Inc', createdAt: '2025-02-01' }
          ]
        })
      })
    )
  })

  test('shows company list', async ({ page }) => {
    await page.goto('/admin/companies')

    await expect(
      page.getByRole('heading', { name: 'Client Companies' })
    ).toBeVisible()
    await expect(page.getByText('Acme Ltd')).toBeVisible()
    await expect(page.getByText('Widgets Inc')).toBeVisible()
  })
})
