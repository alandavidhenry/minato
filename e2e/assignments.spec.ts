import { test, expect } from '@playwright/test'

import { ADMIN_STATE } from './credentials'

test.use({ storageState: ADMIN_STATE })

test.describe('Assignment creation', () => {
  test('assigns a template to a company with a due date', async ({ page }) => {
    // Pin the sidebar open so nav/link clicks aren't timing-dependent on the
    // hover-expanding rail (same reasoning as admin.spec.ts/kiosk.spec.ts).
    await page.addInitScript(() => {
      window.localStorage.setItem('sidebar-mode', 'expanded')
    })

    await page.goto('/admin/companies')
    await page.getByText('Northgate Logistics').click()
    await page.waitForURL(/\/admin\/companies\/[^/]+$/)

    // Northgate Logistics is seeded with company-wide assignments for the
    // first 4 templates only (prisma/seed.ts) — "First Aid Procedures" is
    // never among them, so it's free to assign here.
    const templateTitle = 'First Aid Procedures'
    await expect(
      page.getByRole('row', { name: new RegExp(templateTitle) })
    ).not.toBeVisible()

    await page.getByRole('button', { name: 'Assign Template' }).click()
    const dialog = page.getByRole('dialog')
    await expect(
      dialog.getByRole('heading', { name: 'Assign Template' })
    ).toBeVisible()

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 21)
    // Format as local YYYY-MM-DD (not toISOString, which converts to UTC and
    // can roll the date over near midnight in non-UTC timezones) to keep the
    // value typed into the date input and the display assertion below in sync.
    const dueDateValue = [
      dueDate.getFullYear(),
      String(dueDate.getMonth() + 1).padStart(2, '0'),
      String(dueDate.getDate()).padStart(2, '0')
    ].join('-')
    await dialog.getByLabel('Due date').fill(dueDateValue)

    await dialog.getByLabel('Template', { exact: true }).click()
    await page.getByRole('option', { name: templateTitle }).click()

    await dialog
      .getByRole('button', { name: 'Assign Template', exact: true })
      .click()

    await expect(dialog).not.toBeVisible()

    const row = page.getByRole('row', { name: new RegExp(templateTitle) })
    await expect(row).toBeVisible()
    await expect(
      row.getByText(
        dueDate.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      )
    ).toBeVisible()
  })
})
