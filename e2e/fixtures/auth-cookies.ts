import { encode } from 'next-auth/jwt'

import { UserRole } from '@/types/rbac'

import type { Page } from '@playwright/test'
import type { JWT } from 'next-auth/jwt'

// Proxy-protected routes (/customer/**, /profile/**) use getToken() in the
// Next.js middleware, which reads and decrypts the session cookie directly.
// Mocking /api/auth/session is not enough for those routes — we must set a
// real JWE cookie signed with the same NEXTAUTH_SECRET the server uses.
//
// This module mints valid session cookies so E2E tests can reach protected
// pages without a real database user.

const COOKIE_EXPIRY_SECS = 3600

async function mintSessionCookie(payload: JWT): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error(
      'NEXTAUTH_SECRET is not set in the Playwright process. ' +
        'Make sure .env.local exists and contains NEXTAUTH_SECRET.'
    )
  }
  return encode({ token: payload, secret, maxAge: COOKIE_EXPIRY_SECS })
}

async function setSessionCookie(page: Page, payload: JWT) {
  const token = await mintSessionCookie(payload)
  await page.context().addCookies([
    {
      name: 'next-auth.session-token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }
  ])
}

// Sets a real session cookie AND mocks /api/auth/session so the client-side
// useSession() hook also returns a valid session without hitting the DB.
export async function authenticateAsCustomer(page: Page) {
  await setSessionCookie(page, {
    sub: 'e2e-customer-1',
    id: 'e2e-customer-1',
    name: 'Test Customer',
    email: 'customer@e2e.test',
    roles: [UserRole.CUSTOMER_USER],
    customerCompanyId: 'e2e-company-1',
    jobRole: null
  })

  await page.route('/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'e2e-customer-1',
          name: 'Test Customer',
          email: 'customer@e2e.test',
          roles: ['Customer User'],
          customerCompanyId: 'e2e-company-1',
          jobRole: null
        },
        expires: '2099-12-31T00:00:00.000Z'
      })
    })
  )
}

export async function authenticateAsAdmin(page: Page) {
  await setSessionCookie(page, {
    sub: 'e2e-admin-1',
    id: 'e2e-admin-1',
    name: 'Test Admin',
    email: 'admin@e2e.test',
    roles: [UserRole.PLATFORM_ADMIN],
    customerCompanyId: null,
    jobRole: null
  })

  await page.route('/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'e2e-admin-1',
          name: 'Test Admin',
          email: 'admin@e2e.test',
          roles: ['Platform Admin'],
          customerCompanyId: null,
          jobRole: null
        },
        expires: '2099-12-31T00:00:00.000Z'
      })
    })
  )
}
