import { CircuitDetail } from "@/components/circuit-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CircuitDetail id={id} />;
}
