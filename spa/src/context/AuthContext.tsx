import { createContext, useContext, ReactNode } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SCOPES = [import.meta.env.VITE_API_SCOPE as string];

export function AuthProvider({ children }: { children: ReactNode }) {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const isLoading = inProgress !== InteractionStatus.None;

  function login() {
    instance.loginRedirect({ scopes: SCOPES });
  }

  function logout() {
    instance.logoutRedirect();
  }

  async function getAccessToken(): Promise<string> {
    const accounts = instance.getAllAccounts();
    if (!accounts[0]) throw new Error("Not authenticated");

    const result = await instance.acquireTokenSilent({
      scopes: SCOPES,
      account: accounts[0],
    });

    return result.accessToken;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function DevAuthProvider({ children }: { children: ReactNode }) {
  const value: AuthContextValue = {
    isAuthenticated: true,
    isLoading: false,
    login: () => {},
    logout: () => {},
    getAccessToken: async () => "dev-bypass",
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
