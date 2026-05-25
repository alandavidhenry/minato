import { expect, test } from '@playwright/test'

const COMPANY_ID = 'company-test-1'
const WORKER_ID = 'worker-test-1'
const ASSIGNMENT_ID = 'assignment-test-1'

const mockCompanyData = {
  company: { id: COMPANY_ID, name: 'Acme Construction' },
  workers: [
    {
      id: WORKER_ID,
      displayName: 'John Smith',
      jobRole: 'Operative',
      assignments: [
        {
          id: ASSIGNMENT_ID,
          dueDate: null,
          template: {
            id: 'template-1',
            title: 'Health & Safety Induction',
            description: 'Annual H&S induction document'
          }
        }
      ]
    }
  ]
}

const mockAssignmentData = {
  company: { id: COMPANY_ID, name: 'Acme Construction' },
  workers: [
    {
      id: WORKER_ID,
      displayName: 'John Smith',
      jobRole: 'Operative',
      assignments: [
        {
          id: ASSIGNMENT_ID,
          template: {
            id: 'template-1',
            title: 'Health & Safety Induction',
            description: 'Annual H&S induction document',
            formSchema: null,
            questions: null
          }
        }
      ]
    }
  ]
}

function mockSignoffApi(page: import('@playwright/test').Page) {
  return page.route(`/api/signoff/${COMPANY_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCompanyData)
    })
  )
}

function mockSignoffApiForComplete(page: import('@playwright/test').Page) {
  return page.route(`/api/signoff/${COMPANY_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAssignmentData)
    })
  )
}

test.describe('Kiosk sign-off — company page', () => {
  test('shows company name and worker dropdown', async ({ page }) => {
    await mockSignoffApi(page)
    await page.route('/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      })
    )

    await page.goto(`/signoff/${COMPANY_ID}`)

    await expect(page.getByText('Acme Construction')).toBeVisible()
    await expect(page.getByText('Document Sign-off')).toBeVisible()
    await expect(
      page.getByRole('combobox', { name: /who are you/i })
    ).toBeVisible()
  })

  test('selecting a worker shows their assignments', async ({ page }) => {
    await mockSignoffApi(page)
    await page.route('/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      })
    )

    await page.goto(`/signoff/${COMPANY_ID}`)

    await page.getByRole('combobox', { name: /who are you/i }).click()
    await page.getByRole('option', { name: /John Smith/i }).click()

    await expect(
      page.getByText('Documents for John Smith')
    ).toBeVisible()
    await expect(page.getByText('Health & Safety Induction')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign off' })).toBeVisible()
  })

  test('sign off link points to correct URL', async ({ page }) => {
    await mockSignoffApi(page)
    await page.route('/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      })
    )

    await page.goto(`/signoff/${COMPANY_ID}`)

    await page.getByRole('combobox', { name: /who are you/i }).click()
    await page.getByRole('option', { name: /John Smith/i }).click()

    const link = page.getByRole('link', { name: 'Sign off' })
    await expect(link).toHaveAttribute(
      'href',
      `/signoff/${COMPANY_ID}/${ASSIGNMENT_ID}/complete?workerId=${WORKER_ID}`
    )
  })

  test('shows message when company has no workers', async ({ page }) => {
    await page.route(`/api/signoff/${COMPANY_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          company: { id: COMPANY_ID, name: 'Empty Co' },
          workers: []
        })
      })
    )
    await page.route('/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      })
    )

    await page.goto(`/signoff/${COMPANY_ID}`)

    await expect(
      page.getByText('No workers are registered for kiosk sign-off')
    ).toBeVisible()
  })

  test('shows not found when company is missing', async ({ page }) => {
    await page.route(`/api/signoff/${COMPANY_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ company: null, workers: [] })
      })
    )
    await page.route('/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      })
    )

    await page.goto(`/signoff/${COMPANY_ID}`)

    await expect(
      page.getByText('Sign-off page not found.')
    ).toBeVisible()
  })

  test('shows access denied for authenticated users', async ({ page }) => {
    await page.route('/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-1',
            name: 'Portal User',
            email: 'user@test.com',
            roles: ['Customer User']
          },
          expires: '2099-12-31T00:00:00.000Z'
        })
      })
    )
    await mockSignoffApi(page)

    await page.goto(`/signoff/${COMPANY_ID}`)

    await expect(page.getByText('Access denied')).toBeVisible()
    await expect(
      page.getByText('This kiosk is for workers without a portal account')
    ).toBeVisible()
  })
})

test.describe('Kiosk sign-off — complete page', () => {
  test('renders document title and declaration field', async ({ page }) => {
    await mockSignoffApiForComplete(page)
    await page.route('/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      })
    )

    await page.goto(
      `/signoff/${COMPANY_ID}/${ASSIGNMENT_ID}/complete?workerId=${WORKER_ID}`
    )

    await expect(
      page.getByRole('heading', { name: 'Health & Safety Induction' })
    ).toBeVisible()
    await expect(page.getByText(/Signing off as/)).toBeVisible()
    await expect(page.getByText('John Smith')).toBeVisible()
    await expect(page.getByLabel('Full name')).toBeVisible()
  })

  test('shows error when declaration name is empty on submit', async ({
    page
  }) => {
    await mockSignoffApiForComplete(page)
    await page.route('/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      })
    )

    await page.goto(
      `/signoff/${COMPANY_ID}/${ASSIGNMENT_ID}/complete?workerId=${WORKER_ID}`
    )

    await page.getByRole('button', { name: 'Sign off document' }).click()

    await expect(
      page.getByText('Please enter your full name to confirm this declaration')
    ).toBeVisible()
  })

  test('shows success screen after successful submission', async ({ page }) => {
    await mockSignoffApiForComplete(page)
    await page.route('/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      })
    )
    await page.route(
      `/api/signoff/${COMPANY_ID}/${ASSIGNMENT_ID}`,
      (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
          })
        }
        return route.fallback()
      }
    )

    await page.goto(
      `/signoff/${COMPANY_ID}/${ASSIGNMENT_ID}/complete?workerId=${WORKER_ID}`
    )

    await page.getByLabel('Full name').fill('John Smith')
    await page.getByRole('button', { name: 'Sign off document' }).click()

    await expect(
      page.getByRole('heading', { name: 'Signed off' })
    ).toBeVisible()
    await expect(
      page.getByText(/John Smith has signed off on/)
    ).toBeVisible()
  })

  test('back button navigates to company kiosk page', async ({ page }) => {
    await mockSignoffApiForComplete(page)
    await mockSignoffApi(page)
    await page.route('/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      })
    )

    await page.goto(
      `/signoff/${COMPANY_ID}/${ASSIGNMENT_ID}/complete?workerId=${WORKER_ID}`
    )

    await page.getByRole('button', { name: 'Back' }).click()

    await expect(page).toHaveURL(`/signoff/${COMPANY_ID}`)
  })

  test('redirects to company page if no workerId param', async ({ page }) => {
    await mockSignoffApi(page)
    await page.route('/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      })
    )

    await page.goto(
      `/signoff/${COMPANY_ID}/${ASSIGNMENT_ID}/complete`
    )

    await expect(page).toHaveURL(`/signoff/${COMPANY_ID}`)
  })
})
