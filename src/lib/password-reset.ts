import { randomBytes } from 'crypto'

import { TableClient } from '@azure/data-tables'

interface StorageError {
  statusCode?: number
  [key: string]: unknown
}

const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour
const HEX_TOKEN_RE = /^[0-9a-f]{64}$/

function getTableClient() {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.USE_AZURITE === 'true'
  ) {
    return TableClient.fromConnectionString(
      'UseDevelopmentStorage=true',
      'passwordResets'
    )
  }
  return TableClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING!,
    'passwordResets'
  )
}

async function initTable() {
  const client = getTableClient()
  try {
    await client.createTable()
  } catch (error) {
    const e = error as StorageError
    if (e.statusCode === 409) return
    console.error('Error creating passwordResets table:', error)
  }
}

export async function createResetToken(email: string): Promise<string> {
  const client = getTableClient()
  await initTable()

  // Delete any existing token for this email before creating a new one
  try {
    await client.deleteEntity('resets', email)
  } catch {
    // no existing token — continue
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString()

  await client.createEntity({
    partitionKey: 'resets',
    rowKey: email,
    token,
    expiresAt
  })

  return token
}

export async function validateResetToken(
  token: string
): Promise<string | null> {
  if (!HEX_TOKEN_RE.test(token)) return null

  const client = getTableClient()

  const iterator = client.listEntities({
    queryOptions: { filter: `token eq '${token}'` }
  })

  for await (const entity of iterator) {
    const expiresAt = new Date(entity.expiresAt as string)
    if (expiresAt < new Date()) {
      await client
        .deleteEntity('resets', entity.rowKey as string)
        .catch(() => undefined)
      return null
    }
    return entity.rowKey as string
  }

  return null
}

export async function deleteResetToken(email: string): Promise<void> {
  const client = getTableClient()
  try {
    await client.deleteEntity('resets', email)
  } catch {
    // ignore
  }
}
