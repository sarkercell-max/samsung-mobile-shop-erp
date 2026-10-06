import { requireOwner } from "@/lib/auth";
import { listAssignableUsers, listStores } from "@/actions/stores.actions";
import { Card, CardContent } from "@/components/ui/card";
import { CreateStoreForm } from "@/components/shared/create-store-form";
import { StoreMembershipManager } from "@/components/shared/store-membership-manager";

export default async function StoresPage() {
  await requireOwner();
  const [stores, users] = await Promise.all([listStores(), listAssignableUsers()]);
  return <div className="mx-auto max-w-4xl space-y-5">
    <div><h1 className="text-xl font-semibold">Shops</h1><p className="text-sm text-muted-foreground">Manage locations in this centralized ERP. Products and current rates are shared; stock and transactions stay with each shop.</p></div>
    <Card><CardContent className="p-4"><CreateStoreForm /></CardContent></Card>
    <StoreMembershipManager stores={stores} users={users} />
  </div>;
}
