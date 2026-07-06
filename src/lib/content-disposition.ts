// HTTP header values must be ASCII; a raw non-ASCII filename (e.g. containing
// an em dash or accented character) embedded directly in a `filename="..."`
// parameter causes Azure Blob Storage to reject the SAS request with 400 when
// it tries to set the Content-Disposition response header. RFC 6266 solves
// this with a dual `filename`/`filename*` parameter: an ASCII-safe fallback
// plus a UTF-8 percent-encoded value for clients that support it.
function toAsciiFallback(fileName: string): string {
  return fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
}

export function buildContentDisposition(
  type: 'attachment' | 'inline',
  fileName: string
): string {
  const asciiFallback = toAsciiFallback(fileName)
  const encodedFileName = encodeURIComponent(fileName)
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encodedFileName}`
}
