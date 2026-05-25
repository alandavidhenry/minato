import { expect, test } from '@playwright/test'

import { authenticateAsCustomer } from './fixtures/auth-cookies'

test.describe('Customer documents page', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAsCustomer(page)
  })

  test('shows pending and complete sections', async ({ page }) => {
    await page.route('/api/customer/assignments', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assignments: [
            {
              id: 'a1',
              templateId: 't1',
              customerCompanyId: 'c1',
              createdAt: '2025-01-01',
              template: {
                id: 't1',
                title: 'Fire Safety Policy',
                description: 'Annual fire safety briefing',
                blobPath: null,
                formSchema: null
              }
            },
            {
              id: 'a2',
              templateId: 't2',
              customerCompanyId: 'c1',
              createdAt: '2025-01-02',
              template: {
                id: 't2',
                title: 'Manual Handling',
                description: null,
                blobPath: null,
                formSchema: null
              }
            }
          ]
        })
      })
    )
    await page.route('/api/customer/completions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          completions: [
            {
              id: 'comp1',
              assignmentId: 'a2',
              signedAt: '2025-03-01',
              blobPath: null
            }
          ]
        })
      })
    )

    await page.goto('/customer/documents')

    await expect(
      page.getByRole('heading', { name: 'My Documents' })
    ).toBeVisible()

    await expect(
      page.getByRole('heading', { name: 'Pending' })
    ).toBeVisible()
    await expect(page.getByText('Fire Safety Policy')).toBeVisible()

    await expect(
      page.getByRole('heading', { name: 'Complete' })
    ).toBeVisible()
    await expect(page.getByText('Manual Handling')).toBeVisible()
  })

  test('shows no documents message when no assignments', async ({ page }) => {
    await page.route('/api/customer/assignments', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ assignments: [] })
      })
    )
    await page.route('/api/customer/completions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ completions: [] })
      })
    )

    await page.goto('/customer/documents')

    await expect(
      page.getByText('No documents have been assigned to your company yet.')
    ).toBeVisible()
  })

  test('pending document has Fill In & Complete button for form assignments', async ({
    page
  }) => {
    await page.route('/api/customer/assignments', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assignments: [
            {
              id: 'a1',
              templateId: 't1',
              customerCompanyId: 'c1',
              createdAt: '2025-01-01',
              template: {
                id: 't1',
                title: 'H&S Questionnaire',
                description: null,
                blobPath: null,
                formSchema: [{ id: 'f1', label: 'Name', type: 'text' }]
              }
            }
          ]
        })
      })
    )
    await page.route('/api/customer/completions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ completions: [] })
      })
    )

    await page.goto('/customer/documents')

    await expect(
      page.getByRole('button', { name: /Fill In & Complete/ })
    ).toBeVisible()
  })

  test('pending document has Mark Complete button for non-form assignments', async ({
    page
  }) => {
    await page.route('/api/customer/assignments', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assignments: [
            {
              id: 'a1',
              templateId: 't1',
              customerCompanyId: 'c1',
              createdAt: '2025-01-01',
              template: {
                id: 't1',
                title: 'Site Rules',
                description: null,
                blobPath: null,
                formSchema: null
              }
            }
          ]
        })
      })
    )
    await page.route('/api/customer/completions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ completions: [] })
      })
    )

    await page.goto('/customer/documents')

    await expect(
      page.getByRole('button', { name: 'Mark Complete' })
    ).toBeVisible()
  })
})
