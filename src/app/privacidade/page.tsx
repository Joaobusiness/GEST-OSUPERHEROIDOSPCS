import Link from "next/link";

export const metadata = { title: "Política de privacidade" };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[68ch] px-4 py-8">
      <p className="chip chip-warn">Modelo a revisar por um advogado antes de uso comercial</p>
      <h1 className="mt-4">Política de privacidade</h1>
      <h2 className="mt-6">Dados tratados</h2>
      <p className="mt-2">Conta e empresa (nome, e-mail, telefone, CNPJ ou CPF), cadastro de clientes da assistência (nome, telefone, e-mail, endereço, equipamentos e histórico de atendimentos), orçamentos, ordens de serviço e lançamentos financeiros. Cada empresa só acessa os próprios dados.</p>
      <h2 className="mt-6">Finalidades</h2>
      <p className="mt-2">Operar o sistema: atendimento, orçamento, cobrança e relacionamento. Mensagens de marketing só são enviadas a clientes que deram consentimento, e o cliente pode retirá-lo a qualquer momento.</p>
      <h2 className="mt-6">Retenção</h2>
      <p className="mt-2">Os dados ficam enquanto a conta estiver ativa. Clientes com histórico são arquivados em vez de apagados, para preservar registros financeiros. Após o encerramento da conta, os dados são excluídos em prazo a definir pelo operador da plataforma.</p>
      <h2 className="mt-6">Direitos do titular</h2>
      <p className="mt-2">Confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e revogação de consentimento (Lei 13.709/2018, LGPD). Para exercer, fale com a assistência que atendeu você ou com o operador da plataforma.</p>
      <h2 className="mt-6">Segurança</h2>
      <p className="mt-2">Senhas armazenadas com hash, sessões por cookie protegido e isolamento de dados entre empresas.</p>
      <p className="mt-8"><Link href="/" className="inline-flex min-h-11 items-center font-semibold text-[var(--accent)]">Voltar ao sistema</Link></p>
    </main>
  );
}
