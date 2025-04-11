import { notFound } from 'next/navigation'

import { PDFDocumentViewer } from './pdf-document-viewer'

interface PageProps {
  readonly params: Promise<{ name: string }>
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params

  // Validate the name parameter
  if (!resolvedParams?.name) {
    notFound()
  }

  try {
    const decodedName = decodeURIComponent(resolvedParams.name)
    return <PDFDocumentViewer fileName={decodedName} />
  } catch {
    notFound()
  }
}

export function generateStaticParams() {
  return []
}
