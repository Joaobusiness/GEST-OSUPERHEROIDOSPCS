# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js + React + TypeScript + Tailwind CSS (escolha confirmada pelo usuário, conforme briefing 2.2). Prisma + PostgreSQL e API REST em /api/v1 vêm do briefing; a escolha entre API integrada ao Next.js ou NestJS separado continua em aberto.

## Users

Usuário principal: técnico de informática autônomo que usa o sistema com o celular na mão, atendendo em campo ou na bancada, e faz sozinho atendimento, preço, cobrança e relacionamento. O computador é secundário. Público seguinte: pequenas assistências técnicas, ainda sem peso de design confirmado. Nem todos têm familiaridade com tecnologia.

## Product Purpose

SaaS B2B multi-tenant, em português brasileiro (BRL, America/Sao_Paulo), para gestão operacional, financeira e de relacionamento de assistências técnicas de informática. Organiza a assistência, protege o lucro do técnico e ajuda a trazer clientes de volta. Sucesso do MVP: o técnico cria a conta, cadastra clientes e equipamentos, emite e compartilha orçamentos, calcula preço com margem, controla receitas e despesas, identifica clientes para recontato e vê tudo no dashboard, sem acessar dados de outra empresa.

## Positioning

Não é ERP. É uma plataforma enxuta feita para a rotina de técnico de informática: a precificação inteligente (margem sobre preço de venda, taxas no denominador, três modalidades de Uber, precisão decimal) e o remarketing por WhatsApp ligados à mesma base de clientes, ordens de serviço e financeiro.

## Operating Context

Fluxo: cliente e equipamento, problema e diagnóstico, orçamento, aprovação, execução, conclusão, entrega com pagamento e garantia. Status da OS e status financeiro são independentes. Compartilhamento de orçamento por PDF e link de WhatsApp com texto preenchido. Sem disparo automático de WhatsApp. Há também um painel Super Admin separado para o dono da plataforma (empresas, planos, assinaturas manuais).

## Capabilities and Constraints

- Menu: Início, Clientes, Ordens de serviço, Orçamentos, Precificação, Financeiro, Remarketing, Relatórios, Configurações.
- Dashboard é a primeira tela após login; filtros de período (hoje, 7 dias, 30 dias, mês atual, mês anterior, personalizado).
- Interface responsiva (celular, tablet, desktop), com estados de carregamento, vazio e erro, e confirmação em ações destrutivas.
- Fluxos curtos e pouca digitação: cadastro de cliente só com campos essenciais, OS em poucos passos.
- Indicadores financeiros com conceitos explícitos; faturamento nunca é apresentado como lucro; pendente nunca conta como recebido.
- Valores monetários em precisão decimal; datas em UTC, exibidas no fuso da empresa.
- Segurança e LGPD desde a modelagem: isolamento por tenant_id, preferências de comunicação, marketing só com consentimento.
- Fora do MVP: apps nativos, IA generativa, nota fiscal, integração bancária ou contábil, disparo automático de WhatsApp, estoque avançado, comissões, franquias, marketplace.
- Em aberto: pipeline de PDF, provedor de armazenamento de fotos, hospedagem.

## Brand Commitments

O nome "Super Herói dos PCs" e a logo enviada pelo usuário são marca própria e devem ser usados na construção. A logo é um wordmark sobre fundo preto: "SUPER HERÓI DOS" em prata cromado, itálico e largo; "PCS" em dourado metálico, maior, com brilho; raios elétricos azul-ciano e partículas em volta. Quanto o tema de herói deve aparecer na interface de trabalho além da logo não foi definido e permanece em aberto.

## Evidence on Hand

- Briefing técnico v1.0 completo (conteúdo desta solicitação), sem arquivo salvo no projeto.
- A logo foi enviada apenas como imagem anexada na conversa; nenhum arquivo está no disco. É preciso que o usuário forneça o arquivo (PNG, idealmente com fundo transparente ou SVG) para colocar no projeto.
- Não há depoimentos, clientes, métricas ou preços de assinatura. Os números do dashboard no briefing são ilustrativos e não podem ser tratados como dados reais.

## Product Principles

1. Cada função precisa reduzir trabalho, melhorar relacionamento, afinar preço, controlar o financeiro ou recuperar oportunidade; senão não entra.
2. Uma informação é cadastrada uma vez e alimenta todos os módulos dependentes.
3. Fluxos principais curtos, pensados primeiro para o celular na mão do técnico.
4. O número mostrado ao técnico tem de estar certo e ser explicado, principalmente preço, margem e lucro.
5. Consentimento e privacidade do cliente final não são presumidos.

## Accessibility & Inclusion

Nenhum padrão formal exigido. Público com familiaridade variável com tecnologia: rótulos diretos em português, alvos de toque adequados para uso no celular e contraste legível em uso externo.
