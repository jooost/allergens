import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../context/ApiContext.js";
import { useHasRole } from "../hooks/useCurrentUser.js";
import type { AllergenPresence } from "../types/index.js";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const productId = parseInt(id!);
  const api = useApi();
  const qc = useQueryClient();
  const canEdit = useHasRole("Editor");
  const canManage = useHasRole("Manager");

  const { data: product, isLoading } = useQuery({
    queryKey: ["products", productId],
    queryFn: () => api.products.get(productId),
    enabled: !isNaN(productId),
  });

  const { data: allergens } = useQuery({
    queryKey: ["allergens"],
    queryFn: () => api.reference.allergens(),
  });

  const publishMutation = useMutation({
    mutationFn: () => api.products.publish(productId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", productId] }),
  });

  const archiveMutation = useMutation({
    mutationFn: () => api.products.archive(productId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", productId] }),
  });

  const rollbackMutation = useMutation({
    mutationFn: () => api.products.rollback(productId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", productId] }),
  });

  if (isLoading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!product) return <div style={{ padding: 24 }}>Product not found.</div>;

  const presenceColors: Record<AllergenPresence, string> = {
    Contains: "#d9534f",
    MayContain: "#f0ad4e",
    Free: "#5cb85c",
  };

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/products">← Products</Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0 }}>{product.name ?? product.sku}</h2>
          <div style={{ color: "#666", fontSize: 14 }}>
            {product.sku} · {product.categoryName} · {product.countryName}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusBadge status={product.status} />
          {canEdit && product.status === "Draft" && (
            <button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
              Publish
            </button>
          )}
          {canManage && product.status === "Active" && (
            <button onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending}>
              Archive
            </button>
          )}
          {canEdit && product.status === "Active" && (
            <button onClick={() => rollbackMutation.mutate()} disabled={rollbackMutation.isPending}>
              Rollback to Draft
            </button>
          )}
          {canEdit && (
            <Link to={`/products/${productId}/edit`}>
              <button>Edit</button>
            </Link>
          )}
        </div>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <section style={{ marginBottom: 24 }}>
        <h3>Allergens</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {product.allergens.length === 0 && <span style={{ color: "#999" }}>None declared</span>}
          {product.allergens.map((pa) => {
            const allergen = allergens?.find((a) => a.id === pa.allergenId);
            return (
              <span
                key={pa.allergenId}
                style={{
                  background: presenceColors[pa.presence],
                  color: "#fff",
                  borderRadius: 4,
                  padding: "3px 10px",
                  fontSize: 13,
                  fontWeight: 600,
                }}
                title={pa.notes ?? undefined}
              >
                {allergen?.name ?? `Allergen #${pa.allergenId}`} ({pa.presence})
              </span>
            );
          })}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3>Nutritional Information</h3>
        {!product.nutritionalInfo ? (
          <p style={{ color: "#999" }}>Not provided</p>
        ) : (
          <table style={{ borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Energy (kJ)", product.nutritionalInfo.energyKj],
                ["Energy (kcal)", product.nutritionalInfo.energyKcal],
                ["Fat (g)", product.nutritionalInfo.fatGrams],
                ["of which saturates (g)", product.nutritionalInfo.saturatedFatGrams],
                ["Carbohydrate (g)", product.nutritionalInfo.carbohydrateGrams],
                ["of which sugars (g)", product.nutritionalInfo.sugarsGrams],
                ["Fibre (g)", product.nutritionalInfo.fibreGrams],
                ["Protein (g)", product.nutritionalInfo.proteinGrams],
                ["Salt (g)", product.nutritionalInfo.saltGrams],
              ].map(([label, value]) => (
                <tr key={label as string} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "6px 16px 6px 0", color: "#555" }}>{label}</td>
                  <td style={{ padding: "6px 0", fontWeight: 500 }}>
                    {value ?? <span style={{ color: "#bbb" }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3>Translations</h3>
        {product.translations.length === 0 ? (
          <p style={{ color: "#999" }}>No translations</p>
        ) : (
          product.translations.map((t) => (
            <details key={t.languageId} style={{ marginBottom: 8 }}>
              <summary style={{ cursor: "pointer", fontWeight: 500 }}>
                Language #{t.languageId}: {t.name}
              </summary>
              <div style={{ paddingLeft: 16, marginTop: 8 }}>
                {t.description && <p>{t.description}</p>}
                {t.ingredients && (
                  <div>
                    <strong>Ingredients:</strong> {t.ingredients}
                  </div>
                )}
                {t.storageInstructions && (
                  <div>
                    <strong>Storage:</strong> {t.storageInstructions}
                  </div>
                )}
              </div>
            </details>
          ))
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3>Suppliers</h3>
        {product.suppliers.length === 0 ? (
          <p style={{ color: "#999" }}>No suppliers assigned</p>
        ) : (
          <ul>
            {product.suppliers.map((s) => (
              <li key={s.id}>
                {s.supplierName}
                {s.priority != null && <span style={{ color: "#666", marginLeft: 8 }}>(Priority {s.priority})</span>}
                {s.notes && <span style={{ color: "#666", marginLeft: 8 }}>— {s.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>Documents</h3>
        {product.documents.length === 0 ? (
          <p style={{ color: "#999" }}>No documents</p>
        ) : (
          <ul>
            {product.documents.map((d) => (
              <li key={d.id} style={{ marginBottom: 4 }}>
                <strong>{d.documentType}</strong>
                {d.currentFileName && (
                  <span style={{ marginLeft: 8, color: "#555" }}>
                    {d.currentFileName} (v{d.currentVersionNumber})
                  </span>
                )}
                {!d.isActive && <span style={{ color: "#999", marginLeft: 8 }}>(inactive)</span>}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <Link to={`/products/${productId}/documents/upload`}>
            <button style={{ marginTop: 8 }}>+ Upload Document</button>
          </Link>
        )}
      </section>
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
        padding: "3px 10px",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}
