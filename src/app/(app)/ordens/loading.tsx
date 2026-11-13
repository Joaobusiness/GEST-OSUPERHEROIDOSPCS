import { PageHeader, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <>
      <PageHeader title="Ordens de serviço" />
      <Skeleton rows={6} />
    </>
  );
}
