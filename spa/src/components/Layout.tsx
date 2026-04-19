import { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import { Popcorn, Truck, Users, LogOut, Settings, ScrollText } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";
import { useCurrentUser, useHasRole } from "../hooks/useCurrentUser.js";
import { cn } from "../lib/utils.js";

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
}

function NavItem({ to, icon: Icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </NavLink>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const { data: user } = useCurrentUser();
  const isManager = useHasRole("Manager");

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-border bg-white">
        {/* Logo */}
        <div className="flex items-center border-b border-border p-3">
          <Link to="/products" className="w-full">
            <img src="/logo.png" alt="Allergen Manager" className="w-full object-contain" />
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col p-3 gap-4">
          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Catalogue</p>
            <div className="flex flex-col gap-0.5">
              <NavItem to="/products" icon={Popcorn} label="Products" />
              <NavItem to="/suppliers" icon={Truck} label="Suppliers" />
            </div>
          </div>
          {isManager && (
            <div>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
              <div className="flex flex-col gap-0.5">
                <NavItem to="/users" icon={Users} label="Users" />
                <NavItem to="/audit" icon={ScrollText} label="Audit Log" />
              </div>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-3 space-y-1">
          <div className="flex items-center gap-2.5 px-1 py-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {user?.displayName?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-gray-900 truncate">{user?.displayName ?? "—"}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
            <Link
              to="/settings"
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-gray-100 hover:text-gray-900 transition-colors"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
