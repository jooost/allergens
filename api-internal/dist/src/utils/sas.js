import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, } from "@azure/storage-blob";
export function generateReadSasUrl(blobPath, expiryMinutes = 60) {
    const connectionString = process.env.BLOB_STORAGE_CONNECTION;
    const containerName = process.env.BLOB_CONTAINER_NAME;
    const client = BlobServiceClient.fromConnectionString(connectionString);
    const credential = client.credential;
    const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const sas = generateBlobSASQueryParameters({ containerName, blobName: blobPath, permissions: BlobSASPermissions.parse("r"), expiresOn }, credential);
    const base = client.url.replace(/\/$/, "");
    return `${base}/${containerName}/${blobPath}?${sas.toString()}`;
}
export function generateUploadSasToken(isoCountryCode, productId, documentId, fileName, versionNumber) {
    const connectionString = process.env.BLOB_STORAGE_CONNECTION;
    const containerName = process.env.BLOB_CONTAINER_NAME;
    const expiryMinutes = parseInt(process.env.SAS_TOKEN_EXPIRY_MINUTES ?? "30", 10);
    const client = BlobServiceClient.fromConnectionString(connectionString);
    const credential = client.credential;
    const blobPath = `${isoCountryCode}/${productId}/${documentId}/v${versionNumber}_${fileName}`;
    const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const sas = generateBlobSASQueryParameters({
        containerName,
        blobName: blobPath,
        permissions: BlobSASPermissions.parse("cw"), // create + write
        expiresOn,
    }, credential);
    const accountName = client.accountName;
    const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobPath}?${sas.toString()}`;
    return { uploadUrl, blobPath, expiresAt: expiresOn.toISOString() };
}
