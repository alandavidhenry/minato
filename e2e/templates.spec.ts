import { test, expect } from '@playwright/test'

import { ADMIN_STATE } from './credentials'

test.use({ storageState: ADMIN_STATE })

test.describe('Template creation and versioning', () => {
  test('creates a form-based template and publishes a new version', async ({
    page
  }) => {
    const title = `E2E Template ${Date.now()}`

    await page.goto('/admin/templates')

    await page.getByRole('button', { name: 'New Template' }).click()
    await expect(
      page.getByRole('heading', { name: 'Create Document Template' })
    ).toBeVisible()

    await page.getByLabel('Title').fill(title)
    // Category defaults to "General" and document type to "Build a form
    // online" — both are fine for this test, no need to change either.
    await page.getByRole('button', { name: 'Create Template' }).click()

    await expect(
      page.getByRole('heading', { name: 'Create Document Template' })
    ).not.toBeVisible()

    // Narrow the list to just this template, then expand its category group
    // (all groups start collapsed) to reveal its row.
    await page.getByPlaceholder('Search templates...').fill(title)
    await page.getByRole('button', { name: /General/ }).click()

    const row = page.getByRole('row', { name: new RegExp(title) })
    await expect(row).toBeVisible()
    await expect(row.getByText(/^v\d+$/)).not.toBeVisible()

    await row.getByTitle('Publish new version').click()
    await expect(
      page.getByRole('heading', { name: 'Publish New Version' })
    ).toBeVisible()

    await page
      .getByLabel('Reason for change')
      .fill('E2E test: confirming version publish works end to end')
    await page.getByRole('button', { name: 'Publish', exact: true }).click()

    await expect(
      page.getByRole('heading', { name: 'Publish New Version' })
    ).not.toBeVisible()
    await expect(row.getByText('v2')).toBeVisible()
  })
})
