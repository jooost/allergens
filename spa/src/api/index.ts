import { createApiClient } from "./client.js";
import { productsApi } from "./products.js";
import type { ApiClient } from "./client.js";
import type {
  Allergen,
  Country,
  Language,
  ProductCategory,
  Supplier,
  CurrentUser,
  UserPermission,
  PaginatedResponse,
  AuditEntry,
} from "../types/index.js";

export function createApi(getToken: () => Promise<string>) {
  const client: ApiClient = createApiClient(getToken);

  return {
    products: productsApi(client),

    suppliers: {
      list: () => client.get<Supplier[]>("/suppliers"),
      get: (id: number) => client.get<Supplier>(`/suppliers/${id}`),
      create: (data: unknown) => client.post<Supplier>("/suppliers", data),
      update: (id: number, data: unknown) => client.put<Supplier>(`/suppliers/${id}`, data),
    },

    image: {
      upload: async (productId: number, file: File) => {
        const token = await getToken();
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/internal/v1/products/${productId}/image`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw Object.assign(new Error(err.error ?? "Upload failed"), { status: res.status });
        }
        return res.json() as Promise<{ imageUrl: string; imageFileName: string }>;
      },
      remove: (productId: number) => client.del(`/products/${productId}/image`),
    },

    documents: {
      list: (productId: number) =>
        client.get(`/products/${productId}/documents`),
      create: (productId: number, data: unknown) =>
        client.post(`/products/${productId}/documents`, data),
      listVersions: (productId: number, docId: number) =>
        client.get(`/products/${productId}/documents/${docId}/versions`),
      addVersion: (productId: number, docId: number, data: unknown) =>
        client.post(`/products/${productId}/documents/${docId}/versions`, data),
      remove: (productId: number, docId: number) =>
        client.del(`/products/${productId}/documents/${docId}`),
    },

    reference: {
      allergens: () => client.get<Allergen[]>("/reference/allergens"),
      categories: () => client.get<ProductCategory[]>("/reference/categories"),
      countries: () => client.get<Country[]>("/reference/countries"),
      regions: () => client.get("/reference/regions"),
      languages: () => client.get<Language[]>("/reference/languages"),
    },

    users: {
      me: () => client.get<CurrentUser>("/users/me"),
      list: () => client.get("/users"),
      getPermissions: (entraObjectId: string) =>
        client.get<UserPermission[]>(`/users/${entraObjectId}/permissions`),
      grant: (entraObjectId: string, data: unknown) =>
        client.post<UserPermission>(`/users/${entraObjectId}/permissions`, data),
      revoke: (entraObjectId: string, permId: number) =>
        client.del(`/users/${entraObjectId}/permissions/${permId}`),
      setLanguage: (languageId: number) =>
        client.put("/users/me/language", { languageId }),
    },

    audit: {
      query: (params: Record<string, string | number>) => {
        const qs = new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        );
        return client.get<PaginatedResponse<AuditEntry>>(`/audit?${qs}`);
      },
    },
  };
}

export type Api = ReturnType<typeof createApi>;
