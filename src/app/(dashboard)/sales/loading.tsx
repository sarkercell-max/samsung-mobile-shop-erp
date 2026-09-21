import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-32" />
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
    </div>
  );
}
