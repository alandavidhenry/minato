// src/app/customer/completions/[id]/view/page.tsx
import { notFound } from 'next/navigation'

import { CompletionPdfViewer } from './completion-pdf-viewer'

interface PageProps {
  readonly params: Promise<{ id: string }>
}

export default async function CompletionViewPage({ params }: PageProps) {
  const { id } = await params

  if (!id) {
    notFound()
  }

  return <CompletionPdfViewer completionId={id} />
}

export function generateStaticParams() {
  return []
}
