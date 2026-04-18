export const mapSupplier = (r) => ({
    id: r.Id,
    name: r.Name,
    contactEmail: r.ContactEmail ?? null,
    contactPhone: r.ContactPhone ?? null,
    address: r.Address ?? null,
    isActive: r.IsActive,
    createdAt: r.CreatedAt,
    ...(r.ProductCount !== undefined ? { productCount: r.ProductCount } : {}),
});
export const mapProductSupplier = (r) => ({
    id: r.Id,
    productId: r.ProductId,
    supplierId: r.SupplierId,
    priority: r.Priority ?? null,
    notes: r.Notes ?? null,
    ...(r.SupplierName !== undefined ? {
        supplierName: r.SupplierName,
        contactEmail: r.ContactEmail ?? null,
        contactPhone: r.ContactPhone ?? null,
        supplierIsActive: r.SupplierIsActive,
    } : {}),
});
export const mapDocument = (r) => ({
    id: r.Id,
    productId: r.ProductId,
    documentType: r.DocumentType,
    isActive: r.IsActive,
    createdBy: r.CreatedBy,
    createdAt: r.CreatedAt,
    currentVersionId: r.CurrentVersionId ?? null,
    currentVersionNumber: r.CurrentVersionNumber ?? null,
    currentFileName: r.CurrentFileName ?? null,
    currentBlobPath: r.CurrentBlobPath ?? null,
    currentFileSizeBytes: r.CurrentFileSizeBytes ?? null,
    currentUploadedAt: r.CurrentUploadedAt ?? null,
    currentUploadedBy: r.CurrentUploadedBy ?? null,
});
export const mapDocumentVersion = (r) => ({
    id: r.Id,
    documentId: r.DocumentId,
    versionNumber: r.VersionNumber,
    fileName: r.FileName,
    blobPath: r.BlobPath,
    fileSizeBytes: r.FileSizeBytes ?? null,
    uploadedBy: r.UploadedBy,
    uploadedAt: r.UploadedAt,
});
export const mapPermission = (r) => ({
    id: r.Id,
    regionId: r.RegionId,
    countryId: r.CountryId ?? null,
    role: r.Role,
    regionName: r.RegionName,
    countryName: r.CountryName ?? null,
    isoCode: r.IsoCode ?? null,
});
export const mapUser = (r) => ({
    entraObjectId: r.EntraObjectId,
    displayName: r.DisplayName,
    email: r.Email,
    createdAt: r.CreatedAt,
    lastLoginAt: r.LastLoginAt ?? null,
    preferredLanguageId: r.PreferredLanguageId ?? null,
});
export const mapCategory = (r) => ({
    id: r.Id,
    name: r.Name,
    description: r.Description ?? null,
    isActive: r.IsActive,
});
export const mapAuditEntry = (r) => ({
    id: r.Id,
    tableName: r.TableName,
    recordId: r.RecordId,
    action: r.Action,
    changedBy: r.ChangedBy,
    changedAt: r.ChangedAt,
    oldValues: r.OldValues ? JSON.parse(r.OldValues) : null,
    newValues: r.NewValues ? JSON.parse(r.NewValues) : null,
});
