import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol
} from '@azure/storage-blob'

interface SasTokenOptions {
  permissions: string
  startsOn?: Date
  expiresOn?: Date
  contentDisposition?: string
}

export async function generateSasToken(
  containerName: string,
  blobName: string,
  options: SasTokenOptions
) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString)
  const containerClient = blobServiceClient.getContainerClient(containerName)
  const blobClient = containerClient.getBlobClient(blobName)

  return blobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse(options.permissions),
    startsOn: options.startsOn ?? new Date(),
    expiresOn: options.expiresOn ?? new Date(Date.now() + 30 * 60 * 1000),
    protocol: SASProtocol.Https,
    contentDisposition: options.contentDisposition
  })
}
