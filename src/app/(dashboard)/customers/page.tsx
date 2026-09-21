import { listCustomers } from "@/actions/customers.actions";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { CustomerArchiveButton } from "@/components/shared/customer-archive-button";
import { ChevronRight } from "lucide-react";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const customers = await listCustomers(q);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Customers</h1>
      <div className="space-y-2">
        {customers.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between gap-2 p-3">
              <Link href={`/customers/${c.id}`} className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.phone}{c.address ? ` · ${c.address}` : ""}</p>
              </Link>
              <div className="flex shrink-0 items-center gap-1.5">
                <CustomerArchiveButton customerId={c.id} name={c.name} />
                <Link href={`/customers/${c.id}`}>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
        {customers.length === 0 && <p className="text-sm text-muted-foreground">No customers yet.</p>}
      </div>
    </div>
  );
}
