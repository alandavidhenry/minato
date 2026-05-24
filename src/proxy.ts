import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { CUSTOMER_ROLES, UserRole } from '@/types/rbac'

const STAFF_ONLY_PATHS = ['/documents', '/scan']

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request })

  if (!token) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/signin'
    url.searchParams.set('callbackUrl', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  const roles: UserRole[] = (token.roles as UserRole[]) ?? []
  const isCustomer = roles.some((r) => CUSTOMER_ROLES.includes(r))
  const isStaffOnlyPath = STAFF_ONLY_PATHS.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  )

  if (isCustomer && isStaffOnlyPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/customer'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/documents/:path*',
    '/scan/:path*',
    '/customer/:path*',
    '/profile/:path*',
    '/profile'
  ]
}
