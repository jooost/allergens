import type { ApiClient } from "./client.js";
import type {
  PaginatedResponse,
  ProductDetail,
  ProductSummary,
} from "../types/index.js";

export interface ProductFilters {
  countryId?: number;
  categoryId?: number;
  status?: string;
  supplierId?: number;
  allergenId?: number;
  search?: string;
  languageId?: number;
  page?: number;
  pageSize?: number;
}

export function productsApi(client: ApiClient) {
  return {
    list(filters: ProductFilters = {}) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== "") params.set(k, String(v));
      }
      return client.get<PaginatedResponse<ProductSummary>>(`/products?${params}`);
    },

    get(id: number) {
      return client.get<ProductDetail>(`/products/${id}`);
    },

    create(data: unknown) {
      return client.post<ProductDetail>("/products", data);
    },

    update(id: number, data: unknown) {
      return client.put<ProductDetail>(`/products/${id}`, data);
    },

    publish(id: number) {
      return client.post<ProductDetail>(`/products/${id}/publish`, {});
    },

    archive(id: number) {
      return client.post<ProductDetail>(`/products/${id}/archive`, {});
    },

    rollback(id: number) {
      return client.post<ProductDetail>(`/products/${id}/rollback`, {});
    },
  };
}
