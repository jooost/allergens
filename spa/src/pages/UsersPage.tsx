import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../context/ApiContext.js";
import { useHasRole } from "../hooks/useCurrentUser.js";
import type { UserPermission } from "../types/index.js";

export function UsersPage() {
  const api = useApi();
  const qc = useQueryClient();
  const isManager = useHasRole("Manager");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [grantForm, setGrantForm] = useState({ regionId: "", countryId: "", role: "Reader" });
  const [showGrant, setShowGrant] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users.list(),
    enabled: isManager,
  });

  const { data: regions } = useQuery({
    queryKey: ["regions"],
    queryFn: () => api.reference.regions(),
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: () => api.reference.countries(),
  });

  const { data: permissions } = useQuery({
    queryKey: ["userPermissions", selectedUser],
    queryFn: () => api.users.getPermissions(selectedUser!),
    enabled: !!selectedUser,
  });

  const grantMutation = useMutation({
    mutationFn: () =>
      api.users.grant(selectedUser!, {
        regionId: parseInt(grantForm.regionId),
        countryId: grantForm.countryId ? parseInt(grantForm.countryId) : null,
        role: grantForm.role,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["userPermissions", selectedUser] });
      setShowGrant(false);
      setGrantForm({ regionId: "", countryId: "", role: "Reader" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (permId: number) => api.users.revoke(selectedUser!, permId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["userPermissions", selectedUser] }),
  });

  if (!isManager) return <div style={{ padding: 24 }}>Insufficient permissions.</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2>User Management</h2>

      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ minWidth: 280 }}>
          <h3>Users</h3>
          {isLoading && <p>Loading…</p>}
          {(users as any[])?.map((u: any) => (
            <div
              key={u.entraObjectId}
              onClick={() => setSelectedUser(u.entraObjectId)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                borderRadius: 4,
                background: selectedUser === u.entraObjectId ? "#e8f0fe" : "transparent",
                borderLeft: selectedUser === u.entraObjectId ? "3px solid #337ab7" : "3px solid transparent",
                marginBottom: 4,
              }}
            >
              <div style={{ fontWeight: 500 }}>{u.displayName}</div>
              <div style={{ fontSize: 12, color: "#666" }}>{u.email}</div>
            </div>
          ))}
        </div>

        {selectedUser && (
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Permissions</h3>
              <button onClick={() => setShowGrant((v) => !v)}>
                {showGrant ? "Cancel" : "+ Grant Permission"}
              </button>
            </div>

            {showGrant && (
              <form
                onSubmit={(e) => { e.preventDefault(); grantMutation.mutate(); }}
                style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12, marginBottom: 16 }}
              >
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label>
                    Region *
                    <select
                      required
                      value={grantForm.regionId}
                      onChange={(e) => setGrantForm((f) => ({ ...f, regionId: e.target.value, countryId: "" }))}
                      style={{ display: "block", marginTop: 4, padding: "6px 8px" }}
                    >
                      <option value="">Select…</option>
                      {(regions as any[])?.map((r: any) => (
                        <option key={r.Id} value={r.Id}>{r.Name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Country (optional — leave blank for full region access)
                    <select
                      value={grantForm.countryId}
                      onChange={(e) => setGrantForm((f) => ({ ...f, countryId: e.target.value }))}
                      style={{ display: "block", marginTop: 4, padding: "6px 8px" }}
                    >
                      <option value="">All countries in region</option>
                      {(countries as any[])
                        ?.filter((c: any) => !grantForm.regionId || c.regionId === parseInt(grantForm.regionId))
                        .map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Role *
                    <select
                      value={grantForm.role}
                      onChange={(e) => setGrantForm((f) => ({ ...f, role: e.target.value }))}
                      style={{ display: "block", marginTop: 4, padding: "6px 8px" }}
                    >
                      <option value="Reader">Reader</option>
                      <option value="Editor">Editor</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={grantMutation.isPending}
                    style={{ padding: "8px 16px", background: "#337ab7", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                  >
                    Grant
                  </button>
                </div>
              </form>
            )}

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px" }}>Region</th>
                  <th style={{ padding: "8px 12px" }}>Country</th>
                  <th style={{ padding: "8px 12px" }}>Role</th>
                  <th style={{ padding: "8px 12px" }}></th>
                </tr>
              </thead>
              <tbody>
                {(permissions as UserPermission[])?.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "8px 12px" }}>{p.regionName}</td>
                    <td style={{ padding: "8px 12px" }}>{p.countryName ?? <em style={{ color: "#999" }}>All countries</em>}</td>
                    <td style={{ padding: "8px 12px" }}>{p.role}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <button
                        onClick={() => revokeMutation.mutate(p.id)}
                        disabled={revokeMutation.isPending}
                        style={{ color: "#d9534f", background: "none", border: "none", cursor: "pointer" }}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
