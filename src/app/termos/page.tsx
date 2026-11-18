import Link from "next/link";

export const metadata = { title: "Termos de uso" };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[68ch] px-4 py-8">
      <p className="chip chip-warn">Modelo a revisar por um advogado antes de uso comercial</p>
      <h1 className="mt-4">Termos de uso</h1>
      <h2 className="mt-6">Uso do serviço</h2>
      <p className="mt-2">O Super Herói dos PCs é uma plataforma de gestão para assistências técnicas de informática. Quem contrata é responsável pelas informações cadastradas e pelo uso lícito do sistema.</p>
      <h2 className="mt-6">Dados de clientes</h2>
      <p className="mt-2">A assistência é a controladora dos dados dos próprios clientes e deve obter consentimento antes de enviar marketing. O operador da plataforma trata esses dados somente para prestar o serviço.</p>
      <h2 className="mt-6">Planos e pagamento</h2>
      <p className="mt-2">Valores, prazos e renovação são definidos pelo operador da plataforma e informados na contratação. Preço ainda a definir.</p>
      <h2 className="mt-6">Suspensão e encerramento</h2>
      <p className="mt-2">A conta pode ser suspensa por falta de pagamento ou uso indevido. Os dados podem ser exportados antes do encerramento mediante solicitação.</p>
      <h2 className="mt-6">Responsabilidade</h2>
      <p className="mt-2">Os cálculos de preço são uma ajuda; confira os valores antes de enviar um orçamento. O serviço é fornecido no estado em que se encontra, sem garantia de disponibilidade contínua.</p>
      <p className="mt-8"><Link href="/" className="link">Voltar ao sistema</Link></p>
    </main>
  );
}
