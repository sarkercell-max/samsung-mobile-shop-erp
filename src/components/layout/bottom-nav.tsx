"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, ShoppingCart, Package, ReceiptText, BarChart3 } from "lucide-react";

const OWNER_TABS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/inventory", label: "Stock", icon: Package },
  { href: "/sales/new", label: "Sell", icon: ShoppingCart, primary: true },
  { href: "/sales", label: "Sales", icon: ReceiptText },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

const MANAGER_TABS = [
  { href: "/dashboard/manager", label: "Home", icon: LayoutDashboard },
  { href: "/sales/new", label: "Sell", icon: ShoppingCart, primary: true },
  { href: "/sales", label: "My Sales", icon: ReceiptText },
];

export function BottomNav({ role }: { role: "OWNER" | "MANAGER" }) {
  const pathname = usePathname();
  const tabs = role === "OWNER" ? OWNER_TABS : MANAGER_TABS;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          if (tab.primary) {
            return (
              <Link key={tab.href} href={tab.href} className="-mt-6 flex flex-col items-center gap-0.5">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-medium text-primary">{tab.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
      {/* Safe-area padding for Android/iOS gesture bars */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
