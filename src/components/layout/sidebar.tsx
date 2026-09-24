"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ShoppingCart, Package, Smartphone, Gift, Users,
  ReceiptText, BarChart3, Wallet, UserCog, Settings, Store, Truck,
} from "lucide-react";

const OWNER_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/purchase", label: "Purchase", icon: ShoppingCart },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/products", label: "Products", icon: Smartphone },
  { href: "/promotions", label: "Promotions", icon: Gift },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/sales", label: "Sales", icon: ReceiptText },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/users", label: "Users", icon: UserCog },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MANAGER_NAV = [
  { href: "/dashboard/manager", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sales/new", label: "New Sale", icon: ShoppingCart },
  { href: "/sales", label: "My Sales", icon: ReceiptText },
  { href: "/customers", label: "Customers", icon: Users },
];

export function Sidebar({ role, storeName }: { role: "OWNER" | "MANAGER"; storeName: string }) {
  const pathname = usePathname();
  const nav = role === "OWNER" ? OWNER_NAV : MANAGER_NAV;

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card lg:flex lg:flex-col">
      <div className="flex items-center gap-2 border-b p-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Store className="h-5 w-5" />
        </div>
        <div className="truncate">
          <p className="truncate text-sm font-semibold">{storeName}</p>
          <p className="text-xs text-muted-foreground">{role === "OWNER" ? "Owner" : "Manager"}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
