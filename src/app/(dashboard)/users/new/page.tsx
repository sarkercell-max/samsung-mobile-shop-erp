"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createStaffUser } from "@/actions/users.actions";

export default function NewUserPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "MANAGER" as "OWNER" | "MANAGER", phone: "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createStaffUser(form);
	if (!res.ok) {
  		toast.error(res.error);
  		return;
	}
      toast.success(`${form.role === "OWNER" ? "Owner" : "Manager"} account created`);
      router.push("/users");
    });
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader><CardTitle>Add Staff User</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><Label>Name</Label><Input className="mt-1.5" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
            <div><Label>Email</Label><Input className="mt-1.5" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required /></div>
            <div><Label>Temporary Password</Label><Input className="mt-1.5" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} /></div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as any }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="MANAGER">Manager</SelectItem><SelectItem value="OWNER">Owner</SelectItem></SelectContent>
              </Select>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Creating..." : "Create User"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
