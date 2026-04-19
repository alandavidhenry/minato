import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { describe, expect, it, vi } from 'vitest'

import { proxy } from '../proxy'

// vi.mock is hoisted by Vitest — runs before imports regardless of placement
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn()
}))

const mockGetToken = vi.mocked(getToken)

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`)
}

describe('proxy', () => {
  it('redirects unauthenticated requests to sign-in', async () => {
    mockGetToken.mockResolvedValueOnce(null)
    const res = await proxy(makeRequest('/documents'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/auth/signin')
  })

  it('allows staff roles to access /documents', async () => {
    mockGetToken.mockResolvedValueOnce({ roles: ['Tenant Staff'] } as never)
    const res = await proxy(makeRequest('/documents'))
    expect(res.status).toBe(200)
  })

  it('allows staff roles to access /scan', async () => {
    mockGetToken.mockResolvedValueOnce({ roles: ['Tenant Admin'] } as never)
    const res = await proxy(makeRequest('/scan'))
    expect(res.status).toBe(200)
  })

  it('redirects Customer User away from /documents to /customer', async () => {
    mockGetToken.mockResolvedValueOnce({
      roles: ['Customer User']
    } as never)
    const res = await proxy(makeRequest('/documents'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/customer')
  })

  it('redirects Customer Admin away from /documents to /customer', async () => {
    mockGetToken.mockResolvedValueOnce({
      roles: ['Customer Admin']
    } as never)
    const res = await proxy(makeRequest('/documents/some/path'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/customer')
  })

  it('redirects Customer User away from /scan to /customer', async () => {
    mockGetToken.mockResolvedValueOnce({
      roles: ['Customer User']
    } as never)
    const res = await proxy(makeRequest('/scan'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/customer')
  })

  it('allows customer roles to access /customer routes', async () => {
    mockGetToken.mockResolvedValueOnce({
      roles: ['Customer User']
    } as never)
    const res = await proxy(makeRequest('/customer/documents/123'))
    expect(res.status).toBe(200)
  })
})
