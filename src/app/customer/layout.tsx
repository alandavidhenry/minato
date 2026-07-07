'use client'

import { CustomerPageGuard } from '@/components/auth/permission-guard'

export default function CustomerLayout({
  children
}: {
  readonly children: React.ReactNode
}) {
  return <CustomerPageGuard>{children}</CustomerPageGuard>
}
