import { listStaff } from "@/actions/users.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function UsersPage() {
  const staff = await listStaff();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <Button asChild size="sm"><Link href="/users/new"><Plus className="mr-1 h-4 w-4" /> Add User</Link></Button>
      </div>
      <div className="space-y-2">
        {staff.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">{u.name}</p>
                <p className="text-sm text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={u.role === "OWNER" ? "default" : "secondary"}>{u.role}</Badge>
                <Badge variant={u.isActive ? "success" : "destructive"}>{u.isActive ? "Active" : "Inactive"}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
