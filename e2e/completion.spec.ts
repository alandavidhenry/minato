import { test, expect } from '@playwright/test'

import { CUSTOMER_USER_STATE } from './credentials'

test.use({ storageState: CUSTOMER_USER_STATE })

test.describe('Customer sign-off flow', () => {
  test('fills the form, answers the comprehension question, signs, and submits', async ({
    page
  }) => {
    // Seeded Northgate Logistics worker (prisma/seed.ts) has one company-wide
    // assignment with nothing completed yet: "COSHH Assessment - Cleaning
    // Chemicals" (the 4th of the 4 templates assigned to this company).
    const templateTitle = 'COSHH Assessment - Cleaning Chemicals'

    await page.goto('/customer/documents')
    await expect(page.getByRole('heading', { name: 'Pending' })).toBeVisible()

    // CardTitle is a plain styled <div>, not a heading, so match on the
    // Card's own classes (rounded-lg border bg-card) plus its text.
    const card = page.locator('div.rounded-lg.border.bg-card', {
      hasText: templateTitle
    })
    await card.getByRole('button', { name: 'Fill In & Complete' }).click()

    await page.waitForURL(/\/customer\/documents\/[^/]+\/complete$/)
    // The first hit on this dynamic route can be slow in dev (on-demand
    // compilation) on top of the assignment fetch itself.
    await expect(
      page.getByRole('heading', { name: templateTitle })
    ).toBeVisible({ timeout: 15_000 })

    // Form fields seeded on every template: a required confirmation checkbox
    // and an optional notes textarea.
    await page
      .getByLabel('I confirm I have read and understood this document')
      .check()

    // Comprehension question: "Have you read and understood ... ?" — options
    // Yes/No, correct answer "Yes".
    await page.getByLabel('Yes', { exact: true }).check()

    // The declaration name must match the account name exactly; the input's
    // placeholder is pre-filled with it server-side, so read it back instead
    // of hardcoding the seeded display name.
    const declarationInput = page.getByLabel('Full name')
    const accountName = await declarationInput.getAttribute('placeholder')
    await declarationInput.fill(accountName ?? '')

    const canvas = page.locator('canvas[aria-label="Signature"]')
    // The pad sits below the fold on a standard viewport — boundingBox()
    // reports its real position even off-screen, and mouse events dispatched
    // there land nowhere, so scroll it into view first.
    await canvas.scrollIntoViewIfNeeded()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Signature canvas not found')
    await page.mouse.move(box.x + 20, box.y + 20)
    await page.mouse.down()
    await page.mouse.move(box.x + 60, box.y + 60, { steps: 5 })
    await page.mouse.move(box.x + 100, box.y + 25, { steps: 5 })
    await page.mouse.up()

    await page.getByRole('button', { name: 'Submit & Complete' }).click()

    await page.waitForURL(/\/customer\/documents$/)
    await expect(page.getByRole('heading', { name: 'Complete' })).toBeVisible()
    const completedCard = page.locator('div.rounded-lg.border.bg-card', {
      hasText: templateTitle
    })
    await expect(
      completedCard.getByText('Complete', { exact: true })
    ).toBeVisible()
  })
})
