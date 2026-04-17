import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../context/ApiContext.js";
import { useHasRole } from "../hooks/useCurrentUser.js";
import type { Supplier } from "../types/index.js";

export function SuppliersPage() {
  const api = useApi();
  const qc = useQueryClient();
  const canManage = useHasRole("Manager");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", contactEmail: "", contactPhone: "", address: "" });

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.suppliers.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => api.suppliers.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setShowForm(false);
      setForm({ name: "", contactEmail: "", contactPhone: "", address: "" });
    },
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Suppliers</h2>
        {canManage && (
          <button onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New Supplier"}
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          style={{ border: "1px solid #ddd", borderRadius: 4, padding: 16, marginBottom: 16 }}
        >
          <h3 style={{ marginTop: 0 }}>New Supplier</h3>
          {[
            { key: "name", label: "Name *", required: true },
            { key: "contactEmail", label: "Contact Email" },
            { key: "contactPhone", label: "Contact Phone" },
          ].map(({ key, label, required }) => (
            <label key={key} style={{ display: "block", marginBottom: 8 }}>
              {label}
              <input
                required={required}
                value={(form as any)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                style={{ display: "block", marginTop: 4, padding: "6px 10px", width: 300 }}
              />
            </label>
          ))}
          <label style={{ display: "block", marginBottom: 12 }}>
            Address
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              rows={2}
              style={{ display: "block", marginTop: 4, padding: "6px 10px", width: 400 }}
            />
          </label>
          <button
            type="submit"
            disabled={createMutation.isPending}
            style={{ padding: "8px 16px", background: "#337ab7", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            {createMutation.isPending ? "Creating…" : "Create"}
          </button>
        </form>
      )}

      {isLoading && <p>Loading…</p>}

      {suppliers && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Name</th>
              <th style={{ padding: "8px 12px" }}>Email</th>
              <th style={{ padding: "8px 12px" }}>Phone</th>
              <th style={{ padding: "8px 12px" }}>Products</th>
              <th style={{ padding: "8px 12px" }}>Active</th>
            </tr>
          </thead>
          <tbody>
            {(suppliers as Supplier[]).map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 12px" }}>{s.name}</td>
                <td style={{ padding: "8px 12px" }}>{s.contactEmail ?? "—"}</td>
                <td style={{ padding: "8px 12px" }}>{s.contactPhone ?? "—"}</td>
                <td style={{ padding: "8px 12px" }}>{s.productCount}</td>
                <td style={{ padding: "8px 12px" }}>{s.isActive ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
