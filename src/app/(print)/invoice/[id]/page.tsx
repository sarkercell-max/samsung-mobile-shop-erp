import { getCurrentUser } from "@/lib/auth";
import { saleRepository } from "@/repositories/sale.repository";
import { notFound } from "next/navigation";
import { InvoicePrintView } from "@/components/sales/invoice-print-view";

/**
 * Printable invoice — deliberately lives OUTSIDE the (dashboard) route
 * group so it never inherits the Sidebar/Topbar/BottomNav layout. This was
 * the root cause of "Print Invoice prints the whole page": the previous
 * route rendered inside (dashboard)/layout.tsx, so the browser's print
 * command printed the entire app shell along with the invoice.
 *
 * Supports A4 / 58mm / 80mm thermal via ?format=a4|58mm|80mm.
 */
export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ format?: string }>;
}) {
  const { id } = await params;
  const { format } = await searchParams;
  const user = await getCurrentUser();
  const sale = await saleRepository.findById(user.storeId, id);
  if (!sale) notFound();

  // Managers may only print their own sales; Owners may print any sale.
  if (user.role !== "OWNER" && sale.soldById !== user.id) notFound();

  const validFormats = ["a4", "58mm", "80mm"] as const;
  const resolvedFormat = validFormats.includes(format as never) ? (format as (typeof validFormats)[number]) : "80mm";

  return <InvoicePrintView sale={sale} store={user.store} format={resolvedFormat} canSeeCost={user.role === "OWNER"} />;
}
