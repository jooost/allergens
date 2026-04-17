export type Role = "Reader" | "Editor" | "Manager" | "Admin";
export type ProductStatus = "Draft" | "Active" | "Archived";
export type AllergenPresence = "Contains" | "MayContain" | "Free";
export type DocumentType =
  | "Specification"
  | "AllergenDeclaration"
  | "NutritionalCertificate"
  | "LabelScan"
  | "Other";

export interface Country {
  id: number;
  name: string;
  isoCode: string;
  regionId: number;
  regionName: string;
}

export interface Language {
  id: number;
  name: string;
  isoCode: string;
  isActive: boolean;
}

export interface Allergen {
  id: number;
  code: string;
  sortOrder: number;
  name: string;
  description: string | null;
}

export interface ProductCategory {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface ProductTranslation {
  languageId: number;
  name: string;
  description: string | null;
  ingredients: string | null;
  storageInstructions: string | null;
}

export interface ProductAllergen {
  allergenId: number;
  presence: AllergenPresence;
  notes: string | null;
}

export interface NutritionalInfo {
  servingSizeGrams: number | null;
  energyKj: number | null;
  energyKcal: number | null;
  fatGrams: number | null;
  saturatedFatGrams: number | null;
  carbohydrateGrams: number | null;
  sugarsGrams: number | null;
  fibreGrams: number | null;
  proteinGrams: number | null;
  saltGrams: number | null;
}

export interface ProductSummary {
  id: number;
  sku: string;
  categoryId: number;
  categoryName: string;
  status: ProductStatus;
  name: string | null;
  description: string | null;
  countryId: number;
  countryName: string;
  countryCode: string;
  updatedAt: string;
}

export interface ProductDetail extends ProductSummary {
  translations: ProductTranslation[];
  allergens: ProductAllergen[];
  nutritionalInfo: NutritionalInfo | null;
  suppliers: ProductSupplier[];
  documents: ProductDocument[];
}

export interface ProductSupplier {
  id: number;
  productId: number;
  supplierId: number;
  supplierName: string;
  priority: number | null;
  notes: string | null;
}

export interface Supplier {
  id: number;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  isActive: boolean;
  productCount: number;
}

export interface ProductDocument {
  id: number;
  productId: number;
  documentType: DocumentType;
  isActive: boolean;
  createdAt: string;
  currentVersionId: number | null;
  currentVersionNumber: number | null;
  currentFileName: string | null;
  currentBlobPath: string | null;
  currentUploadedAt: string | null;
}

export interface UserPermission {
  id: number;
  regionId: number;
  regionName: string;
  countryId: number | null;
  countryName: string | null;
  isoCode: string | null;
  role: Role;
}

export interface CurrentUser {
  entraObjectId: string;
  displayName: string;
  email: string;
  roles: string[];
  preferredLanguageId: number | null;
  permissions: UserPermission[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
