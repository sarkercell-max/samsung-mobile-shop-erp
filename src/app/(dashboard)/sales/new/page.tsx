import { getCurrentUser } from "@/lib/auth";
import { SaleForm } from "@/components/sales/sale-form";

export default async function NewSalePage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-xl font-semibold">New Sale</h1>
      <SaleForm isOwner={user.role === "OWNER"} />
    </div>
  );
}
