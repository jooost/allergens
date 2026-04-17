import { createContext, useContext, useMemo, ReactNode } from "react";
import { createApi, type Api } from "../api/index.js";
import { useAuth } from "./AuthContext.js";

const ApiContext = createContext<Api | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const { getAccessToken } = useAuth();
  const api = useMemo(() => createApi(getAccessToken), [getAccessToken]);
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): Api {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi must be inside ApiProvider");
  return ctx;
}
