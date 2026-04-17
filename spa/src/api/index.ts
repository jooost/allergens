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
        return client.get<PaginatedResponse<unknown>>(`/audit?${qs}`);
      },
    },
  };
}

export type Api = ReturnType<typeof createApi>;
