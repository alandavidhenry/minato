import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ActivityType,
  getActivityLogs,
  initActivityLogsTable,
  logActivity
} from '../activity-logger'

function asyncOf<T>(...items: T[]) {
  return (async function* () {
    for (const item of items) yield item
  })()
}

const { mockTableClient } = vi.hoisted(() => {
  const mockTableClient = {
    createTable: vi.fn(),
    createEntity: vi.fn(),
    listEntities: vi.fn(),
    deleteEntity: vi.fn()
  }
  return { mockTableClient }
})

vi.mock('@azure/data-tables', () => ({
  TableClient: {
    fromConnectionString: vi.fn(() => mockTableClient)
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockTableClient.listEntities.mockReturnValue(asyncOf())
})

describe('initActivityLogsTable', () => {
  it('creates the table successfully', async () => {
    mockTableClient.createTable.mockResolvedValue({})
    await expect(initActivityLogsTable()).resolves.toBeUndefined()
    expect(mockTableClient.createTable).toHaveBeenCalledOnce()
  })

  it('silently ignores a 409 (table already exists)', async () => {
    mockTableClient.createTable.mockRejectedValue({ statusCode: 409 })
    await expect(initActivityLogsTable()).resolves.toBeUndefined()
  })
})

describe('logActivity', () => {
  const baseActivity = {
    userId: 'user-1',
    userName: 'Alice',
    fileName: 'report.pdf',
    activityType: ActivityType.UPLOAD
  }

  it('creates an entity and returns the logged activity', async () => {
    mockTableClient.createEntity.mockResolvedValue({})

    const result = await logActivity(baseActivity)

    expect(mockTableClient.createEntity).toHaveBeenCalledOnce()
    const entityArg = mockTableClient.createEntity.mock.calls[0][0]
    expect(entityArg.partitionKey).toBe('user-1')
    expect(entityArg.userId).toBe('user-1')
    expect(entityArg.fileName).toBe('report.pdf')
    expect(entityArg.activityType).toBe(ActivityType.UPLOAD)

    expect(result).toMatchObject({
      userId: 'user-1',
      userName: 'Alice',
      fileName: 'report.pdf',
      activityType: ActivityType.UPLOAD
    })
    expect(result?.id).toBeTruthy()
    expect(result?.timestamp).toBeTruthy()
  })

  it('returns null when the Azure write fails', async () => {
    mockTableClient.createEntity.mockRejectedValue(new Error('network error'))
    const result = await logActivity(baseActivity)
    expect(result).toBeNull()
  })
})

describe('getActivityLogs', () => {
  it('returns an empty array when no logs exist', async () => {
    const logs = await getActivityLogs()
    expect(logs).toEqual([])
  })

  it('maps table entities to ActivityLog objects', async () => {
    const entity = {
      rowKey: 'log-1',
      userId: 'user-1',
      userName: 'Alice',
      fileName: 'doc.pdf',
      activityType: ActivityType.VIEW,
      timestamp: '2024-06-01T10:00:00.000Z',
      ipAddress: '127.0.0.1'
    }
    mockTableClient.listEntities.mockReturnValue(asyncOf(entity))

    const logs = await getActivityLogs()

    expect(logs).toHaveLength(1)
    expect(logs[0]).toEqual({
      id: 'log-1',
      userId: 'user-1',
      userName: 'Alice',
      fileName: 'doc.pdf',
      activityType: ActivityType.VIEW,
      timestamp: '2024-06-01T10:00:00.000Z',
      ipAddress: '127.0.0.1'
    })
  })

  it('sorts logs newest first', async () => {
    const older = {
      rowKey: 'a',
      userId: 'u',
      userName: 'U',
      fileName: 'f',
      activityType: ActivityType.VIEW,
      timestamp: '2024-01-01T00:00:00.000Z',
      ipAddress: ''
    }
    const newer = {
      rowKey: 'b',
      userId: 'u',
      userName: 'U',
      fileName: 'f',
      activityType: ActivityType.DOWNLOAD,
      timestamp: '2024-06-01T00:00:00.000Z',
      ipAddress: ''
    }
    mockTableClient.listEntities.mockReturnValue(asyncOf(older, newer))

    const logs = await getActivityLogs()

    expect(logs[0].id).toBe('b')
    expect(logs[1].id).toBe('a')
  })

  it('escapes single quotes in filter values to prevent OData injection', async () => {
    await getActivityLogs({ userId: "user' or PartitionKey eq 'x" })
    expect(mockTableClient.listEntities).toHaveBeenCalledWith({
      queryOptions: {
        filter: "PartitionKey eq 'user'' or PartitionKey eq ''x'"
      }
    })
  })

  it('filters by userId in filters object', async () => {
    await getActivityLogs({ userId: 'user-1' })
    expect(mockTableClient.listEntities).toHaveBeenCalledWith({
      queryOptions: { filter: "PartitionKey eq 'user-1'" }
    })
  })

  it('filters by multiple userIds', async () => {
    await getActivityLogs({ userIds: ['user-1', 'user-2'] })
    expect(mockTableClient.listEntities).toHaveBeenCalledWith({
      queryOptions: {
        filter: "(PartitionKey eq 'user-1' or PartitionKey eq 'user-2')"
      }
    })
  })

  it('filters by date range', async () => {
    await getActivityLogs({
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-01-31T23:59:59.999Z'
    })
    expect(mockTableClient.listEntities).toHaveBeenCalledWith({
      queryOptions: {
        filter:
          "timestamp ge '2024-01-01T00:00:00.000Z' and timestamp le '2024-01-31T23:59:59.999Z'"
      }
    })
  })

  it('combines userId and date filters', async () => {
    await getActivityLogs({
      userId: 'user-1',
      startDate: '2024-01-01T00:00:00.000Z'
    })
    expect(mockTableClient.listEntities).toHaveBeenCalledWith({
      queryOptions: {
        filter:
          "PartitionKey eq 'user-1' and timestamp ge '2024-01-01T00:00:00.000Z'"
      }
    })
  })

  it('returns empty array when the query throws', async () => {
    mockTableClient.listEntities.mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.reject(new Error('fail'))
      })
    })
    const logs = await getActivityLogs()
    expect(logs).toEqual([])
  })
})
