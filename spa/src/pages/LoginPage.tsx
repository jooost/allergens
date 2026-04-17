import { useAuth } from "../context/AuthContext.js";

export function LoginPage() {
  const { login } = useAuth();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 120 }}>
      <h1>Allergen Manager</h1>
      <p>Sign in with your Microsoft account to continue.</p>
      <button onClick={login} style={{ padding: "10px 24px", fontSize: 16, cursor: "pointer" }}>
        Sign in
      </button>
    </div>
  );
}
