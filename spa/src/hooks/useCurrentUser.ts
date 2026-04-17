import { useQuery } from "@tanstack/react-query";
import { useApi } from "../context/ApiContext.js";
import type { CurrentUser } from "../types/index.js";

export function useCurrentUser() {
  const api = useApi();
  return useQuery<CurrentUser>({
    queryKey: ["users", "me"],
    queryFn: () => api.users.me(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useHasRole(minimum: "Reader" | "Editor" | "Manager" | "Admin"): boolean {
  const { data: user } = useCurrentUser();
  if (!user) return false;
  if (user.roles.includes("Admin")) return true;
  const rank: Record<string, number> = { Reader: 1, Editor: 2, Manager: 3, Admin: 4 };
  return user.roles.some((r) => (rank[r] ?? 0) >= rank[minimum]);
}
