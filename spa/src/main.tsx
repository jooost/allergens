import { StrictMode, Component, ReactNode } from "react";
import { createRoot } from "react-dom/client";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: "monospace" }}>
          <h2>Something went wrong</h2>
          <pre style={{ color: "red" }}>{(this.state.error as Error).message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, DevAuthProvider, useAuth } from "./context/AuthContext.js";
import { ApiProvider } from "./context/ApiContext.js";
import { Layout } from "./components/Layout.js";
import { LoginPage } from "./pages/LoginPage.js";
import { ProductsPage } from "./pages/ProductsPage.js";
import { ProductDetailPage } from "./pages/ProductDetailPage.js";
import { ProductFormPage } from "./pages/ProductFormPage.js";
import { SuppliersPage } from "./pages/SuppliersPage.js";
import { UsersPage } from "./pages/UsersPage.js";

const DEV_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === "true";

const msalInstance = DEV_BYPASS
  ? null
  : new PublicClientApplication({
      auth: {
        clientId: import.meta.env.VITE_ENTRA_CLIENT_ID as string,
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID as string}`,
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: "sessionStorage",
      },
    });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!isAuthenticated) return <LoginPage />;

  return (
    <ApiProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/products" replace />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/new" element={<ProductFormPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/products/:id/edit" element={<ProductFormPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/users" element={<UsersPage />} />
        </Routes>
      </Layout>
    </ApiProvider>
  );
}

const inner = (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      {DEV_BYPASS ? (
        <DevAuthProvider>
          <AppRoutes />
        </DevAuthProvider>
      ) : (
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      )}
    </BrowserRouter>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      {DEV_BYPASS ? inner : <MsalProvider instance={msalInstance!}>{inner}</MsalProvider>}
    </ErrorBoundary>
  </StrictMode>,
);
