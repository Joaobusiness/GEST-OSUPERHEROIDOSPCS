import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="grid gap-4 pt-2">
      <div className="skeleton h-9 w-40" />
      <Skeleton rows={5} />
    </div>
  );
}
