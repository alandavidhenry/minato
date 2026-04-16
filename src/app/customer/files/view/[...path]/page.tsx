// src/app/customer/files/view/[...path]/page.tsx
import { notFound } from 'next/navigation'

import { CustomerPdfViewer } from './customer-pdf-viewer'

interface PageProps {
  readonly params: Promise<{ path: string[] }>
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params

  if (!resolvedParams?.path?.length) {
    notFound()
  }

  const relativePath = resolvedParams.path.map(decodeURIComponent).join('/')

  return <CustomerPdfViewer relativePath={relativePath} />
}

export function generateStaticParams() {
  return []
}
