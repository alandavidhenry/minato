import { notFound } from 'next/navigation'

import { PDFDocumentViewer } from './pdf-document-viewer'

interface PageProps {
  readonly params: Promise<{ name: string[] }>
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params

  // Validate the name parameter
  if (!resolvedParams?.name?.length) {
    notFound()
  }

  try {
    // A catch-all segment is required because the blob path (which contains
    // '/') is passed as a single encodeURIComponent'd segment. Azure App
    // Service's front end decodes '%2F' to a literal '/' before the request
    // reaches Next.js, which splits it into multiple path segments — a plain
    // `[name]` segment can't match that, only `[...name]` can. Each segment
    // is decoded individually to also support the case where it arrives
    // as a single still-encoded segment (e.g. local dev).
    const decodedName = resolvedParams.name.map(decodeURIComponent).join('/')
    return <PDFDocumentViewer fileName={decodedName} />
  } catch {
    notFound()
  }
}

export function generateStaticParams() {
  return []
}
