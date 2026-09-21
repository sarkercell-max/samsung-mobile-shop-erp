import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Topbar } from "@/components/layout/topbar";
import { getNotificationCount } from "@/actions/notifications.actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const notificationCount = await getNotificationCount();

  return (
    <div className="flex min-h-dvh">
      <Sidebar role={user.role} storeName={user.store.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={user.name} notificationCount={notificationCount} />
        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-6">{children}</main>
      </div>
      <BottomNav role={user.role} />
    </div>
  );
}
