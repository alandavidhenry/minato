// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET
  const token = await getToken({ req: request, secret })

  // If the user is not logged in, redirect to the sign-in page
  if (!token) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/signin'
    url.searchParams.set('callbackUrl', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/documents/:path*']
}
