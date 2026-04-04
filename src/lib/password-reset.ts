import { randomBytes } from 'crypto'

import prisma from './prisma'

const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour
const HEX_TOKEN_RE = /^[0-9a-f]{64}$/

export async function createResetToken(email: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS)

  await prisma.passwordReset.upsert({
    where: { email },
    create: { email, token, expiresAt },
    update: { token, expiresAt }
  })

  return token
}

export async function validateResetToken(
  token: string
): Promise<string | null> {
  if (!HEX_TOKEN_RE.test(token)) return null

  const record = await prisma.passwordReset.findUnique({ where: { token } })
  if (!record) return null

  if (record.expiresAt < new Date()) {
    await prisma.passwordReset
      .delete({ where: { token } })
      .catch(() => undefined)
    return null
  }

  return record.email
}

export async function deleteResetToken(email: string): Promise<void> {
  await prisma.passwordReset.delete({ where: { email } }).catch(() => undefined)
}
