import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { ApiProvider } from "./context/ApiContext.js";
import { Layout } from "./components/Layout.js";
import { LoginPage } from "./pages/LoginPage.js";
import { ProductsPage } from "./pages/ProductsPage.js";
import { ProductDetailPage } from "./pages/ProductDetailPage.js";
import { ProductFormPage } from "./pages/ProductFormPage.js";
import { SuppliersPage } from "./pages/SuppliersPage.js";
import { UsersPage } from "./pages/UsersPage.js";

const msalInstance = new PublicClientApplication({
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </MsalProvider>
  </StrictMode>,
);
