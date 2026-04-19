import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, X } from "lucide-react";
import { useApi } from "../context/ApiContext.js";
import { useHasRole } from "../hooks/useCurrentUser.js";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Label } from "../components/ui/label.js";
import { Textarea } from "../components/ui/textarea.js";
import { Badge } from "../components/ui/badge.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import type { Supplier } from "../types/index.js";

interface SupplierForm {
  name: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  isActive: boolean;
}

const emptyForm: SupplierForm = { name: "", contactEmail: "", contactPhone: "", address: "", isActive: true };

function supplierToForm(s: Supplier): SupplierForm {
  return {
    name: s.name,
    contactEmail: s.contactEmail ?? "",
    contactPhone: s.contactPhone ?? "",
    address: s.address ?? "",
    isActive: s.isActive,
  };
}

interface SupplierFormPanelProps {
  title: string;
  form: SupplierForm;
  onChange: (patch: Partial<SupplierForm>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}

function SupplierFormPanel({ title, form, onChange, onSubmit, onCancel, isPending, submitLabel }: SupplierFormPanelProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input required value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input type="email" value={form.contactEmail} onChange={(e) => onChange({ contactEmail: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Phone</Label>
              <Input value={form.contactPhone} onChange={(e) => onChange({ contactPhone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Textarea rows={2} value={form.address} onChange={(e) => onChange({ address: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : submitLabel}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function SuppliersPage() {
  const api = useApi();
  const qc = useQueryClient();
  const canManage = useHasRole("Manager");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<SupplierForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<SupplierForm>(emptyForm);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.suppliers.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => api.suppliers.create(createForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setShowCreate(false);
      setCreateForm(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => api.suppliers.update(editingId!, editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setEditingId(null);
    },
  });

  function startEdit(s: Supplier) {
    setShowCreate(false);
    setEditingId(s.id);
    setEditForm(supplierToForm(s));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage product ingredient and packaging suppliers</p>
        </div>
        {canManage && !showCreate && (
          <Button onClick={() => { setShowCreate(true); setEditingId(null); }}>
            <Plus className="h-4 w-4" />
            New Supplier
          </Button>
        )}
      </div>

      {showCreate && (
        <SupplierFormPanel
          title="New Supplier"
          form={createForm}
          onChange={(p) => setCreateForm((f) => ({ ...f, ...p }))}
          onSubmit={() => createMutation.mutate()}
          onCancel={() => { setShowCreate(false); setCreateForm(emptyForm); }}
          isPending={createMutation.isPending}
          submitLabel="Create Supplier"
        />
      )}

      <div className="rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-gray-50/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Products</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {(suppliers as Supplier[] | undefined)?.map((s) => (
              <>
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.contactEmail ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.contactPhone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{s.productCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge variant={s.isActive ? "success" : "muted"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editingId === s.id ? cancelEdit() : startEdit(s)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
                {editingId === s.id && (
                  <tr key={`edit-${s.id}`}>
                    <td colSpan={canManage ? 6 : 5} className="bg-gray-50/50 px-4 py-4">
                      <form
                        onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                          <div className="space-y-1.5">
                            <Label>Name *</Label>
                            <Input required value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Contact Email</Label>
                            <Input type="email" value={editForm.contactEmail} onChange={(e) => setEditForm((f) => ({ ...f, contactEmail: e.target.value }))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Contact Phone</Label>
                            <Input value={editForm.contactPhone} onChange={(e) => setEditForm((f) => ({ ...f, contactPhone: e.target.value }))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Address</Label>
                            <Input value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.isActive}
                            onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                            className="h-4 w-4 rounded border-border accent-primary"
                          />
                          Active supplier
                        </label>
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? "Saving…" : "Save Changes"}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {suppliers?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No suppliers found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
