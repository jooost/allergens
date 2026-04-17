import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { useCurrentUser, useHasRole } from "../hooks/useCurrentUser.js";

export function Layout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const { data: user } = useCurrentUser();
  const isManager = useHasRole("Manager");

  const navStyle = ({ isActive }: { isActive: boolean }) => ({
    display: "block",
    padding: "8px 16px",
    color: isActive ? "#fff" : "#ccc",
    background: isActive ? "#1a3a5c" : "transparent",
    textDecoration: "none",
    borderRadius: 4,
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <nav
        style={{
          width: 200,
          background: "#1e2b3c",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          padding: "16px 8px",
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, padding: "8px 16px", marginBottom: 16, color: "#fff" }}>
          Allergen Manager
        </div>
        <NavLink to="/products" style={navStyle}>Products</NavLink>
        <NavLink to="/suppliers" style={navStyle}>Suppliers</NavLink>
        {isManager && <NavLink to="/users" style={navStyle}>Users</NavLink>}

        <div style={{ flex: 1 }} />
        <div style={{ padding: "8px 16px", borderTop: "1px solid #2d3f54", marginTop: 16 }}>
          <div style={{ fontSize: 13, color: "#aaa", marginBottom: 4 }}>{user?.displayName}</div>
          <button
            onClick={logout}
            style={{
              background: "none",
              border: "1px solid #555",
              color: "#ccc",
              padding: "4px 12px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Sign out
          </button>
        </div>
      </nav>

      <main style={{ flex: 1, overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
