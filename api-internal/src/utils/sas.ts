import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

export interface SasTokenResult {
  uploadUrl: string;
  blobPath: string;
  expiresAt: string;
}

export function generateUploadSasToken(
  isoCountryCode: string,
  productId: number,
  documentId: number,
  fileName: string,
  versionNumber: number,
): SasTokenResult {
  const connectionString = process.env.BLOB_STORAGE_CONNECTION!;
  const containerName = process.env.BLOB_CONTAINER_NAME!;
  const expiryMinutes = parseInt(process.env.SAS_TOKEN_EXPIRY_MINUTES ?? "30", 10);

  const client = BlobServiceClient.fromConnectionString(connectionString);
  const credential = (client as any).credential as StorageSharedKeyCredential;

  const blobPath = `${isoCountryCode}/${productId}/${documentId}/v${versionNumber}_${fileName}`;
  const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: blobPath,
      permissions: BlobSASPermissions.parse("cw"), // create + write
      expiresOn,
    },
    credential,
  );

  const accountName = client.accountName;
  const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobPath}?${sas.toString()}`;

  return { uploadUrl, blobPath, expiresAt: expiresOn.toISOString() };
}
