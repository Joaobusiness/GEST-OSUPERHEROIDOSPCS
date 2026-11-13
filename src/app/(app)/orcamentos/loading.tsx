import { PageHeader, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <>
      <PageHeader title="Orçamentos" />
      <Skeleton rows={6} />
    </>
  );
}
