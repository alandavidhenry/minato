// A signature is a small trimmed-canvas PNG capture, not a general file
// upload — 500,000 base64 chars (~375KB decoded) comfortably covers a
// high-DPI signature while rejecting anything absurdly oversized.
const MAX_SIGNATURE_DATA_URL_LENGTH = 500_000

const SIGNATURE_DATA_URL_PATTERN = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/

export function isValidSignatureDataUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_SIGNATURE_DATA_URL_LENGTH &&
    SIGNATURE_DATA_URL_PATTERN.test(value)
  )
}
