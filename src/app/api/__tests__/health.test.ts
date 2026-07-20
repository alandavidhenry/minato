import { describe, expect, it } from 'vitest'

import { GET } from '../health/route'

describe('GET /api/health', () => {
  it('returns status ok with 200 without touching any dependencies', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
