import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cache } from "react";
import { cookies } from "next/headers";

/** Loads the current Supabase auth user plus their business `User` row
 *  (store, role). Cached per-request. Redirects to /login if unauthenticated. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { authId: authUser.id },
    include: { store: true, storeMemberships: { include: { store: true } } },
  });

  if (!user || !user.isActive) redirect("/login");

  const cookieStore = await cookies();
  const requestedStoreId = cookieStore.get("active_store_id")?.value;
  const accessibleStores = user.role === "OWNER"
    ? await prisma.store.findMany({ orderBy: { createdAt: "asc" } })
    : user.storeMemberships.map((membership) => membership.store);
  const selectedStore = accessibleStores.find((store) => store.id === requestedStoreId)
    ?? accessibleStores.find((store) => store.id === user.storeId)
    ?? accessibleStores[0];
  if (!selectedStore) redirect("/login");
  return { ...user, storeId: selectedStore.id, store: selectedStore, accessibleStores };
});

/** Throws/redirects unless the current user is an OWNER. Use at the top of
 *  any owner-only server action or page. */
export async function requireOwner() {
  const user = await getCurrentUser();
  if (user.role !== "OWNER") {
    throw new Error("Forbidden: this action requires the Owner role.");
  }
  return user;
}
