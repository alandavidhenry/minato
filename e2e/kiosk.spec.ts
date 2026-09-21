import { test, expect } from '@playwright/test'

import { ADMIN_STATE } from './credentials'

test.describe('Kiosk sign-off', () => {
  test.use({ storageState: ADMIN_STATE })

  test("public kiosk page lists a seeded company's workers", async ({
    page,
    browser
  }) => {
    // The sidebar defaults to "hover" mode, where the collapsed rail
    // transiently widens and can intercept clicks on nearby table rows —
    // pin it "collapsed" so it never overlays the page content.
    await page.addInitScript(() => {
      window.localStorage.setItem('sidebar-mode', 'collapsed')
    })

    // Find a seeded company's id as the admin, then load its public,
    // unauthenticated kiosk sign-off page in a fresh browser context. The
    // kiosk only lists no-email workers (prisma/seed.ts gives every third
    // company one) — Solent Manufacturing is the first with one.
    await page.goto('/admin/companies')
    await page.getByText('Solent Manufacturing').click()
    await page.waitForURL(/\/admin\/companies\/[^/]+$/)
    const companyId = new URL(page.url()).pathname.split('/').pop()

    // Explicitly blank — a bare newContext() would otherwise still see this
    // project's default storageState via Playwright's context option
    // inheritance, and the kiosk page must be tested signed out.
    const kioskContext = await browser.newContext({
      storageState: { cookies: [], origins: [] }
    })
    const kioskPage = await kioskContext.newPage()
    await kioskPage.goto(`/signoff/${companyId}`)

    await expect(
      kioskPage.getByRole('heading', { name: 'Solent Manufacturing' })
    ).toBeVisible()
    await expect(kioskPage.getByText('Who are you?')).toBeVisible()

    await kioskContext.close()
  })
})
