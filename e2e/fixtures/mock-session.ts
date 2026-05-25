import type { Page } from '@playwright/test'

const SESSION_EXPIRY = '2099-12-31T00:00:00.000Z'

export async function mockAdminSession(page: Page) {
  await page.route('/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'admin-1',
          name: 'Test Admin',
          email: 'admin@test.com',
          roles: ['Platform Admin']
        },
        expires: SESSION_EXPIRY
      })
    })
  )
}

export async function mockCustomerSession(page: Page) {
  await page.route('/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'customer-1',
          name: 'Test Customer',
          email: 'customer@test.com',
          roles: ['Customer User']
        },
        expires: SESSION_EXPIRY
      })
    })
  )
}

export async function mockNoSession(page: Page) {
  await page.route('/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({})
    })
  )
}
