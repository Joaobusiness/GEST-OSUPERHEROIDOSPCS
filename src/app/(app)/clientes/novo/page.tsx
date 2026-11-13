import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../customer-form";

export const metadata = { title: "Novo cliente" };

export default function NovoCliente() {
  return (
    <>
      <PageHeader title="Novo cliente" sub="Nome e telefone bastam para começar." />
      <div className="card card-pad"><CustomerForm /></div>
    </>
  );
}
