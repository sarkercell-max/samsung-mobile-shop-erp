import { listExpenses } from "@/actions/expenses.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function ExpensesPage() {
  const expenses = await listExpenses();
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <Button asChild size="sm"><Link href="/expenses/new"><Plus className="mr-1 h-4 w-4" /> Add Expense</Link></Button>
      </div>
      <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{formatCurrency(total)}</p></CardContent></Card>
      <div className="space-y-2">
        {expenses.map((e) => (
          <Card key={e.id}>
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <Badge variant="secondary">{e.category}</Badge>
                {e.description && <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>}
                <p className="text-xs text-muted-foreground">{formatDate(e.expenseDate)}</p>
              </div>
              <p className="font-semibold">{formatCurrency(Number(e.amount))}</p>
            </CardContent>
          </Card>
        ))}
        {expenses.length === 0 && <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>}
      </div>
    </div>
  );
}
