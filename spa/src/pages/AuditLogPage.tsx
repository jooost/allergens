import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useApi } from "../context/ApiContext.js";
import { Input } from "../components/ui/input.js";
import { Select } from "../components/ui/select.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { cn } from "../lib/utils.js";
import type { AuditEntry } from "../types/index.js";

const ACTION_VARIANT: Record<string, "success" | "danger" | "default"> = {
  Insert: "success",
  Update: "default",
  Delete: "danger",
};

export function AuditLogPage() {
  const api = useApi();
  const [tableName, setTableName] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit", tableName, action, page],
    queryFn: () =>
      api.audit.query({
        ...(tableName ? { tableName } : {}),
        ...(action ? { action } : {}),
        page,
        pageSize: 50,
      }),
  });

  const rows = (data?.data ?? []).filter((e: AuditEntry) =>
    !search || e.changedBy.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-gray-900">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Full change history across all records</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by user…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-48"
          />
        </div>
        <Select value={tableName} onChange={(e) => { setTableName(e.target.value); setPage(1); }} className="w-40">
          <option value="">All tables</option>
          <option value="Products">Products</option>
          <option value="ProductAllergens">Allergens</option>
          <option value="ProductTranslations">Translations</option>
          <option value="Suppliers">Suppliers</option>
          <option value="UserPermissions">Permissions</option>
        </Select>
        <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="w-36">
          <option value="">All actions</option>
          <option value="Insert">Insert</option>
          <option value="Update">Update</option>
          <option value="Delete">Delete</option>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-gray-50/50">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">When</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">User</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Table</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Record</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No entries found</td></tr>
            )}
            {rows.map((entry: AuditEntry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2">
            <span className="text-xs text-muted-foreground">
              Page {data.page} of {data.totalPages} · {data.total} entries
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);

  const changedFields = entry.newValues
    ? Object.entries(entry.newValues).filter(([k, v]) => entry.oldValues?.[k] !== v)
    : [];

  return (
    <>
      <tr className="hover:bg-gray-50/60 transition-colors">
        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
          {new Date(entry.changedAt).toLocaleString("en-GB", {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </td>
        <td className="px-3 py-2 text-xs">{entry.changedBy}</td>
        <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{entry.tableName}</td>
        <td className="px-3 py-2 text-xs font-mono">{entry.recordId}</td>
        <td className="px-3 py-2">
          <Badge variant={ACTION_VARIANT[entry.action] ?? "default"}>{entry.action}</Badge>
        </td>
        <td className="px-3 py-2">
          {changedFields.length > 0 ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-primary hover:underline"
            >
              {expanded ? "Hide" : `${changedFields.length} field${changedFields.length > 1 ? "s" : ""}`}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50/50">
          <td colSpan={6} className="px-6 pb-3 pt-1">
            <div className="rounded-md border border-border bg-white px-3 py-2 text-xs space-y-1">
              {changedFields.map(([key, newVal]) => (
                <div key={key} className={cn("grid gap-2")} style={{ gridTemplateColumns: "160px 1fr 1fr" }}>
                  <span className="font-medium text-muted-foreground truncate">{key}</span>
                  <span className="text-muted-foreground line-through truncate">{String(entry.oldValues?.[key] ?? "—")}</span>
                  <span className="text-gray-800 truncate">{String(newVal ?? "—")}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
