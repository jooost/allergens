import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "../context/ApiContext.js";
import { useCurrentUser, useHasRole } from "../hooks/useCurrentUser.js";
import type { ProductFilters } from "../api/products.js";
import type { Country, ProductCategory, Allergen } from "../types/index.js";

export function ProductsPage() {
  const api = useApi();
  const { data: user } = useCurrentUser();
  const canEdit = useHasRole("Editor");

  const [filters, setFilters] = useState<ProductFilters>({ page: 1, pageSize: 20 });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", filters],
    queryFn: () => api.products.list(filters),
    enabled: !!user,
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: () => api.reference.countries(),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.reference.categories(),
  });

  const { data: allergens } = useQuery({
    queryKey: ["allergens"],
    queryFn: () => api.reference.allergens(),
  });

  function update(patch: Partial<ProductFilters>) {
    setFilters((f) => ({ ...f, ...patch, page: 1 }));
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Products</h2>
        {canEdit && <Link to="/products/new"><button>+ New Product</button></Link>}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <input
          placeholder="Search…"
          value={filters.search ?? ""}
          onChange={(e) => update({ search: e.target.value || undefined })}
          style={{ padding: "6px 10px" }}
        />
        <select
          value={filters.countryId ?? ""}
          onChange={(e) => update({ countryId: e.target.value ? parseInt(e.target.value) : undefined })}
        >
          <option value="">All countries</option>
          {countries?.map((c: Country) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filters.categoryId ?? ""}
          onChange={(e) => update({ categoryId: e.target.value ? parseInt(e.target.value) : undefined })}
        >
          <option value="">All categories</option>
          {categories?.map((c: ProductCategory) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filters.status ?? ""}
          onChange={(e) => update({ status: e.target.value || undefined })}
        >
          <option value="">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Active">Active</option>
          <option value="Archived">Archived</option>
        </select>
        <select
          value={filters.allergenId ?? ""}
          onChange={(e) => update({ allergenId: e.target.value ? parseInt(e.target.value) : undefined })}
        >
          <option value="">Any allergen</option>
          {allergens?.map((a: Allergen) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {isLoading && <p>Loading…</p>}

      {products && (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>SKU</th>
                <th style={{ padding: "8px 12px" }}>Name</th>
                <th style={{ padding: "8px 12px" }}>Category</th>
                <th style={{ padding: "8px 12px" }}>Country</th>
                <th style={{ padding: "8px 12px" }}>Status</th>
                <th style={{ padding: "8px 12px" }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {products.data.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "8px 12px" }}>
                    <Link to={`/products/${p.id}`}>{p.sku}</Link>
                  </td>
                  <td style={{ padding: "8px 12px" }}>{p.name ?? <em style={{ color: "#999" }}>Untranslated</em>}</td>
                  <td style={{ padding: "8px 12px" }}>{p.categoryName}</td>
                  <td style={{ padding: "8px 12px" }}>{p.countryName}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <StatusBadge status={p.status} />
                  </td>
                  <td style={{ padding: "8px 12px" }}>{new Date(p.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
            <button
              disabled={filters.page === 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              Previous
            </button>
            <span>Page {products.page} of {products.totalPages}</span>
            <button
              disabled={products.page >= products.totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              Next
            </button>
            <span style={{ marginLeft: 16, color: "#666" }}>{products.total} total</span>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Draft: "#f0ad4e",
    Active: "#5cb85c",
    Archived: "#999",
  };
  return (
    <span
      style={{
        background: colors[status] ?? "#ccc",
        color: "#fff",
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}
