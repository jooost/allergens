import { useAuth } from "../context/AuthContext.js";
import { Button } from "../components/ui/button.js";

export function LoginPage() {
  const { login } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-8 shadow-sm text-center">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Allergen Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your Microsoft account to continue
          </p>
        </div>
        <Button className="w-full" onClick={login}>
          Sign in with Microsoft
        </Button>
      </div>
    </div>
  );
}
