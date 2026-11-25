# 💰 Organizador de Dívidas & Finanças Pessoais

> Sistema completo de gestão financeira pessoal e controle de dívidas com suporte a múltiplos perfis, projeção de despesas fixas, cálculo dinâmico de parcelamentos e **leitura inteligente de contracheques (PDF)** com visualização lado a lado.

---

## 📌 Sumário

- [Visão Geral](#-visão-geral)
- [Arquitetura do Monorepo](#-arquitetura-do-monorepo)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Funcionalidades Principais](#-funcionalidades-principais)
  - [1. Gestão Multi-Perfil com Temas Dinâmicos](#1-gestão-multi-perfil-com-temas-dinâmicos)
  - [2. Dashboard Financeiro Mensal](#2-dashboard-financeiro-mensal)
  - [3. Controle Avançado de Dívidas e Parcelamentos](#3-controle-avançado-de-dívidas-e-parcelamentos)
  - [4. Importação Inteligente de Contracheque (PDF)](#4-importação-inteligente-de-contracheque-pdf)
  - [5. Compromissos futuros](#5-compromissos-futuros)
- [Estrutura de Diretórios](#-estrutura-de-diretórios)
- [Guia de Instalação e Execução](#-guia-de-instalação-e-execução)
  - [Pré-requisitos](#pré-requisitos)
  - [Passo a Passo](#passo-a-passo)
  - [Configuração e recuperação do PIN](#configuração-e-recuperação-do-pin)
  - [Scripts Disponíveis](#scripts-disponíveis)
- [Rotas da API REST](#-rotas-da-api-rest)
- [Design System & Estilização (Panda CSS)](#-design-system--estilização-panda-css)
- [Acessibilidade do frontend](#acessibilidade-do-frontend)
- [Licença](#-licença)

---

## 🔭 Visão Geral

O **Organizador de Dívidas** foi desenvolvido para solucionar a desorganização financeira pessoal familiar ou individual. Ele permite isolar as finanças por perfis de usuários com personalização visual própria (cores e identidade), além de oferecer previsibilidade orçamentária através do controle rigoroso de despesas fixas, assinaturas recorrentes, compras parceladas e entradas de salário.

Destaca-se pelo recurso de **Importação Inteligente de Contracheque (Holerite em PDF)**: o usuário faz o upload do documento, o sistema analisa o texto e as coordenadas espaciais das rubricas via `pdfjs-dist` e apresenta uma tela dividida (*split-screen*) com o PDF original à esquerda e a tabela editável à direita para conferência e gravação em lote.

---

## 🏗 Arquitetura do Monorepo

O projeto está estruturado em **npm workspaces**:

```
organizador-dividas/
├── apps/
│   ├── api/      # Backend REST em Node.js, Express, Prisma ORM e SQLite
│   └── web/      # Frontend SPA em React 18, Vite e Panda CSS
├── packages/
│   └── shared/   # Tipos TypeScript, interfaces DTO e schemas Zod compartilhados
└── package.json  # Scripts raiz e orquestração de workspaces
```

---

## 🚀 Tecnologias Utilizadas

### Frontend (`apps/web`)
- **React 18** com TypeScript
- **Vite 5** para inicialização e HMR ultrarrápido
- **Panda CSS**: Motor CSS-in-JS compilado em tempo de build com geração de tipos estáticos e *zero runtime overhead*
- **Lucide React**: Ícones consistentes e acessíveis
- **Context API**: Gerenciamento de estado global dividido por domínios (`ProfileContext` e `TransactionContext`)

### Backend (`apps/api`)
- **Node.js** com TypeScript e Express
- **Prisma ORM**: Modelagem de dados e migrations tipadas
- **SQLite**: Banco de dados relacional leve em arquivo local (`dev.db`)
- **pdfjs-dist**: Extração e análise espacial de coordenadas textuais em documentos PDF
- **Multer**: Processamento de uploads de arquivos em memória
- **Zod**: Validação estrita de contratos e payloads em tempo de execução
- **CORS** e **Dotenv**

### Compartilhado (`packages/shared`)
- Schemas Zod de criação, atualização e lote
- Interfaces TypeScript consumidas de ponta a ponta (eliminando divergências entre cliente e servidor)

---

## ✨ Funcionalidades Principais

### 1. Gestão Multi-Perfil com Temas Dinâmicos
- Criação de perfis independentes (ex: membros da família ou pessoa física/jurídica).
- Cada perfil possui **Cor Primária** e **Cor Secundária** em formato hexadecimal.
- Ao selecionar um perfil, variáveis CSS nativas (`--profile-primary`, `--profile-secondary`, `--profile-primary-soft`, etc.) são injetadas em `:root`, alterando instantaneamente botões, gráficos, avatares e destaques visuais.
- **PIN opcional.** Ative na criação ou nas configurações do perfil. Use quatro dígitos e confirme o PIN novo, inclusive se começar com zero. O cabeçalho permite bloquear o perfil. Alteração, remoção e exclusão de um perfil protegido exigem o PIN atual.
- **Exclusão de perfil.** Perfis sem PIN podem ser excluídos pela lista de perfis. Abra o Extrato para excluir um perfil protegido e confirme com o PIN atual. A exclusão remove os lançamentos vinculados.

### 2. Dashboard Financeiro Mensal
- **4 Cards de Métricas em Tempo Real**:
  1. **Saldo Livre:** Disponibilidade líquida prevista vs. realizada.
  2. **Receitas:** Total do mês com divisão de valores recebidos e pendentes.
  3. **Despesas Fixas & Cotidianas:** Total com status pago e a pagar.
  4. **Parcelamentos & Recorrências:** Volume de dívidas ativas no mês.
- **Navegação Temporal:** Seletor intuitivo de mês e ano.
- **Filtros Rápidos:** Abas para visualizar *Todas*, *Apenas Despesas* ou *Apenas Receitas*.
- **Alternância de Status de Liquidação:** Marque dívidas e receitas como pagas com 1 clique (atualização atômica do status e data de pagamento).

### 3. Controle Avançado de Dívidas e Parcelamentos
- Suporte a 4 categorias de transações:
  - `fixed` (Fixa): Aluguel, contas essenciais, salário base.
  - `recurring` (Recorrente): Assinaturas e mensalidades contínuas.
  - `installment` (Parcelada): Compras no cartão ou empréstimos com parcelas controladas.
  - `daily` (Cotidiana): Gastos variáveis e alimentação.
- **Calculadora Bidirecional de Parcelamento**:
  - Entrada pelo valor unitário da parcela (calcula a dívida total).
  - Entrada pelo valor total da compra (calcula o valor exato de cada parcela).
  - Controle de parcela inicial (ex: cadastrar compra que já está na parcela 4 de 10).
- **Projeção Futura Automática**: Ao criar despesas fixas ou parceladas, o backend gera automaticamente os lançamentos dos meses futuros interligados por `groupId`.
- **Exclusão Inteligente**: Opção de excluir apenas a parcela selecionada ou toda a série futura vinculada.

### 4. Importação Inteligente de Contracheque (PDF)
- **Upload Seguro:** Drag-and-drop com validação estrita para `.pdf` e limite de 5MB.
- **Visualização Split-Screen Lado a Lado**:
  - **Coluna da Esquerda (40%):** Iframe com o documento original carregado em memória (`URL.createObjectURL`), permitindo zoom, navegação de páginas e auditoria visual sem salvar arquivos temporários desnecessários no disco.
  - **Coluna da Direita (60%):** Painel de conferência e edição dos dados extraídos.
- **Extração Automática:**
  - Identificação de Razão Social da empresa e Mês de Referência.
  - Classificação de rubricas entre proventos (receitas) e deduções (despesas).
  - Detecção heurística de empréstimos consignados e parcelas (ex: `04/12`).
- **Dois Modos de Lançamento**:
  - **Modo 1 ("Apenas Salário Líquido"):** Cria uma única receita com o valor final creditado na conta.
  - **Modo 2 ("Detalhado"):** Tabela interativa com seleção múltipla, edição inline da descrição, valor, tipo e categoria, ajuste de parcelas e inclusão de itens manuais.
- **Projeção em Lote:** Definição da data de recebimento e replicação automática dos proventos e deduções fixas para 1, 6 ou 12 meses futuros via `POST /api/transactions/batch`.

### 5. Compromissos futuros

A visão abre no próximo mês civil. Escolha o perfil e navegue entre os meses. **Ver no extrato** abre o mês de vencimento e localiza o lançamento correspondente.

- O total previsto soma as despesas **fixas, recorrentes e parceladas** cadastradas no mês selecionado, incluindo as pagas. O valor em aberto soma as despesas dessas categorias com status pendente ou vencido. Receitas e despesas cotidianas ficam no extrato.
- A numeração da parcela vem de `currentInstallment` e `totalInstallments`. O valor e a quantidade de parcelas restantes consideram os registros em aberto com o mesmo `groupId` e perfil, cuja data de vencimento esteja em um mês posterior ao exibido. Um lançamento sem `groupId` aparece sem vínculo de série.
- A consulta usa `profileId`, `type=expense` e `startDate` no primeiro dia do próximo mês. Cada cálculo usa as datas, categorias, valores e situações atualmente gravadas, inclusive após edições ou exclusões individuais. O horizonte termina nos registros cadastrados.

---

## 📁 Estrutura de Diretórios

```
organizador-dividas/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # Modelo de dados Profile e Transaction
│   │   │   └── dev.db                    # Banco de dados SQLite local
│   │   ├── src/
│   │   │   ├── controllers/              # profileController, transactionController, payslipController
│   │   │   ├── routes/                   # Definição das rotas Express
│   │   │   ├── services/
│   │   │   │   └── payslipPdfParserService.ts  # Parser de PDF e heurísticas de folha
│   │   │   ├── prisma.ts                 # Instância compartilhada do PrismaClient
│   │   │   └── server.ts                 # Ponto de entrada do servidor Express
│   │   ├── .env                          # Variáveis de ambiente da API (PORT, DATABASE_URL)
│   │   └── package.json
│   │
│   └── web/
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/                   # Button, Card, Input, Select, Modal
│       │   │   ├── PayslipImportModal.tsx# Modal split-screen de importação de contracheque
│       │   │   └── TransactionForm.tsx   # Formulário completo de transações e parcelamentos
│       │   ├── contexts/
│       │   │   ├── ProfileContext.tsx    # Contexto e injeção de tema CSS
│       │   │   └── TransactionContext.tsx# Contexto de transações, filtros e mutações
│       │   ├── pages/
│       │   │   ├── Dashboard.tsx         # Dashboard principal com métricas e listagem
│       │   │   └── ProfileSelectScreen.tsx # Tela inicial de seleção e criação de perfis
│       │   ├── App.tsx                   # Roteador de estado do perfil ativo
│       │   └── main.tsx
│       ├── panda.config.ts               # Configuração do Design System e Tokens Panda CSS
│       ├── vite.config.ts                # Configuração do Vite e proxy reverso para API
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── src/
│       │   └── index.ts                  # Tipos, interfaces DTO e validações Zod
│       └── package.json
│
├── package.json                          # Workspace root
└── README.md                             # Documentação do projeto
```

---

## 🛠 Guia de Instalação e Execução

### Pré-requisitos
- **Node.js**: versão 18.x ou superior (recomendado 20.x LTS)
- **npm**: versão 9.x ou superior

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd organizador-dividas
   ```

2. **Instale todas as dependências do monorepo:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente da API:**
   Verifique o arquivo `apps/api/.env` (já pré-configurado por padrão):
   ```env
   PORT=3000
   DATABASE_URL="file:./dev.db"
   ```

4. **Atualize o esquema do SQLite local.** Pare a API e faça uma cópia do arquivo do banco antes de atualizar uma instalação existente.
   ```bash
   npm exec -w @organizador/api -- prisma db push
   ```
   O SQLite local distribuído com o projeto já contém tabelas e usa esse comando para atualizar o esquema. Em um banco que já acompanha o histórico do Prisma, aplique a migração `20261125000000_add_profile_pin` com `npm exec -w @organizador/api -- prisma migrate deploy`.
   *(Opcional)* Para abrir a interface visual do banco de dados:
   ```bash
   npm run prisma:studio -w @organizador/api
   ```

5. **Inicie os servidores em modo de desenvolvimento:**
   ```bash
   npm run dev
   ```
   Esse comando inicializará simultaneamente:
   - **Frontend:** [http://localhost:5173](http://localhost:5173)
   - **Backend API:** [http://localhost:3000](http://localhost:3000)

O frontend usa `/api` na mesma origem por padrão. No desenvolvimento e no
`npm run preview -w @organizador/web`, o Vite encaminha esse caminho à API
local. Se a API usar outra porta, defina `API_PROXY_TARGET` em
`apps/web/.env.local` com a origem correspondente, por exemplo
`http://localhost:3001`.

Em produção, configure o servidor web para encaminhar `/api` à API. Para
publicar o frontend e a API em origens separadas, defina
`VITE_API_BASE_URL=https://api.exemplo.com/api` no ambiente do build ou em
`apps/web/.env.production.local`.

### Configuração e recuperação do PIN

Gere um segredo de 32 bytes no ambiente local antes de ativar a proteção.

```bash
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

Adicione o valor retornado como `PROFILE_PIN_SECRET` ao `apps/api/.env` e reinicie a API. Guarde uma cópia desse segredo separada do SQLite. O servidor usa HMAC com o segredo e, em seguida, scrypt com um sal aleatório por PIN. O SQLite guarda o hash salgado. Perfis existentes começam sem PIN.

O limite é de cinco verificações por perfil. A quinta tentativa incorreta abre uma espera de cinco minutos. O contador fica no SQLite e é compartilhado entre desbloqueio, alteração, remoção e exclusão. A resposta `429` indica o tempo restante em `Retry-After`.

Após validar o PIN, a API emite um token aleatório que vale por oito horas e fica vinculado ao perfil. O SQLite guarda o hash do token. A interface guarda o token na aba, usa `Authorization: Bearer <token>` nas requisições e confirma a sessão com o servidor ao recarregar. O ID salvo no navegador lembra a seleção. Bloquear, sair ou trocar de perfil encerra a sessão da aba. Alterar ou remover o PIN revoga todas as sessões daquele perfil. Use HTTPS quando servir o app fora da máquina local.

Se perder o segredo, restaure a cópia de `PROFILE_PIN_SECRET`. Se esquecer o PIN ou perder o segredo sem uma cópia, o operador local pode remover a proteção do perfil diretamente no SQLite.

1. Pare a API e faça uma cópia de segurança do SQLite. Use o arquivo apontado por `DATABASE_URL`, que por padrão é `apps/api/prisma/dev.db`.
2. Abra o arquivo no cliente SQLite local e consulte `SELECT id, name FROM profiles;` para identificar o perfil.
3. Substitua `ID_DO_PERFIL` pelo ID escolhido e execute esta transação SQLite.

   ```sql
   BEGIN IMMEDIATE;
   DELETE FROM profile_sessions WHERE profileId = 'ID_DO_PERFIL';
   UPDATE profiles
      SET pinHash = NULL, pinAttempts = 0, pinAttemptUntil = NULL
    WHERE id = 'ID_DO_PERFIL';
   COMMIT;
   ```

4. Configure um segredo novo se o anterior foi perdido. Reinicie a API, abra o perfil e defina um novo PIN. Os lançamentos são preservados. Se trocou o segredo, faça a recuperação individual dos demais perfis que ainda usam o segredo anterior.

O procedimento requer acesso direto ao SQLite local. O operador deve proteger o arquivo e suas cópias, que contêm os lançamentos financeiros.

---

### Scripts Disponíveis

Na raiz do projeto (`package.json`), você pode executar:

| Comando | Descrição |
|---|---|
| `npm run dev` | Executa a API e o Frontend concorrentemente. |
| `npm run dev:all` | Executa o pacote `shared` em watch, a API e o Frontend. |
| `npm run dev:api` | Inicia somente a API com recarregamento a quente (`ts-node-dev`). |
| `npm run dev:web` | Inicia somente o Frontend Vite. |
| `npm run build` | Compila os contratos compartilhados, gera tokens do Panda CSS e builda a API e Frontend para produção. |
| `npm test` | Verifica proteção por PIN, regras financeiras e datas com SQLite temporário e porta HTTP efêmera. |
| `npm run clean` | Remove os diretórios `dist` de todos os workspaces. |

A suíte de auditoria usa Node.js 22.13 ou superior e o cliente Prisma gerado com `npm run prisma:generate -w @organizador/api`. O banco temporário é criado a partir do schema e removido ao fim da execução.

Para testar falhas, concorrência, PIN e navegação de compromissos futuros, rode `npm test` e `npm run build -w @organizador/web`.
Depois execute `node --test tests/api-reliability.browser.cjs`. A suíte usa um navegador Chromium local.
O fluxo de PIN usa a API real com SQLite temporário. Os cenários de falha e temporização usam respostas simuladas. Defina
`BROWSER_PATH` se o executável estiver fora dos caminhos padrão do teste.

---

## 📡 Rotas da API REST

A API roda por padrão na porta `3000` e atende nos prefixos `/` e `/api`:

### Perfis de Usuário
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/profiles` | Lista ID, identidade visual e `hasPin`. |
| `POST` | `/api/profiles` | Cria um perfil. Para protegê-lo, envie `pin` e `pinConfirmation`. |
| `GET` | `/api/profiles/:id` | Retorna os detalhes e o resumo financeiro do perfil. |
| `PUT` | `/api/profiles/:id` | Atualiza dados e cores do perfil. |
| `DELETE` | `/api/profiles/:id` | Exclui o perfil e seus lançamentos. Perfis protegidos exigem `currentPin`. |
| `GET` | `/api/profiles/:id/session` | Confirma o acesso e informa quando a sessão protegida expira. |
| `POST` | `/api/profiles/:id/session` | Valida `pin` e abre uma sessão para o perfil protegido. |
| `DELETE` | `/api/profiles/:id/session` | Revoga a sessão identificada pelo token. |
| `PUT` | `/api/profiles/:id/pin` | Define ou altera com `pin` e `pinConfirmation`. Envie `pin: null` para remover. Se já houver PIN, envie também `currentPin`. |

Rotas de dados de perfis protegidos exigem sessão válida para o perfil. Para adicionar rotas de planejamento em `/profiles/:id/planning`, use o router protegido em `apps/api/src/routes/profiles.ts`. Compromissos futuros usa a consulta protegida de transações.

### Transações & Dívidas
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/transactions?profileId={id}&month={m}&year={y}` | Lista transações do perfil filtradas por mês/ano. |
| `POST` | `/api/transactions` | Cria uma transação com suporte a repetição mensal e parcelamento. |
| `POST` | `/api/transactions/batch` | Criação em lote de transações (usado no contracheque) com projeção futura. |
| `PATCH`| `/api/transactions/:id/status` | Alterna status (`pending` / `paid` / `overdue`) e preenche `paymentDate`. |
| `PUT`  | `/api/transactions/:id` | Atualiza os dados de uma transação existente. |
| `PATCH` | `/api/transactions/:id` | Atualiza parcialmente os dados de uma transação existente. |
| `DELETE`| `/api/transactions/:id?deleteAll=true` | Exclui o selecionado e os futuros da série no mesmo perfil. Sem o parâmetro, exclui somente o selecionado. |

Para parcelamentos, os dois endpoints de criação recebem `amount` em reais. O padrão é o valor de cada parcela. Com `amountMode: "total"`, o valor representa a compra inteira e os centavos restantes vão para as primeiras parcelas da numeração original. Por exemplo, R$ 100,00 em três parcelas gera R$ 33,34, R$ 33,33 e R$ 33,33. As séries ficam limitadas a 120 parcelas ou meses.

Envie vencimentos e pagamentos como `YYYY-MM-DD`. A API também aceita datas ISO completas e usa o dia civil indicado no texto. A projeção usa o dia da parcela inicial e, nos meses mais curtos, o último dia do mês.

### Leitura de Contracheque (PDF)
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/payslip/parse?profileId={id}` | Verifica o acesso ao perfil e recebe o PDF no campo `file` (`multipart/form-data`). Retorna totais, rubricas e parcelas extraídas. |

### Health Check
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Verifica a saúde e tempo de atividade da API. |

---

## 🎨 Design System & Estilização (Panda CSS)

A aplicação web utiliza o **Panda CSS** para compilar estilos type-safe diretamente para classes utilitárias CSS:

- **Tokens Semânticos:** Cores de status financeiro padronizadas:
  - `income`: Tons verdes para receitas e entradas (`income.50` a `income.700`).
  - `expense`: Tons vermelhos para saídas, dívidas e deduções (`expense.50` a `expense.700`).
  - `warning`: Tons âmbar para parcelamentos e alertas.
  - `slate`: Tons neutros modernos para superfícies, bordas e tipografia.
- **Cores de perfil.** As cores personalizadas aparecem nos monogramas e nas amostras de paleta. O texto do monograma usa preto ou branco conforme a luminância do fundo. Botões, bordas, mensagens e indicadores de foco usam a paleta da interface.
- **Zero Runtime:** Não há injeção de CSS em runtime via JavaScript, proporcionando renderização suave e sem recálculos de layout (*jank*).

---

## Acessibilidade do frontend

### Verificações realizadas

- O build de produção do frontend passou com `npm run build -w @organizador/web`. Os fluxos abaixo foram exercitados no Edge (Chromium), com respostas simuladas da API, teclado automatizado e inspeção da árvore de acessibilidade.
- Na seleção de perfis, foram exercitados carregamento, erro com nova tentativa, busca sem resultados, criação com erro e sucesso, entrada, troca de perfil e exclusão. As amostras de cor testadas incluíram capas branca, cinza e escura com código hexadecimal abreviado.
- No painel, foram exercitados troca de mês, carregamento, erro e repetição da consulta, mês vazio, filtros sem resultados, situação de um lançamento e destino do foco quando a linha deixa de aparecer. A tabela manteve papéis e cabeçalhos na árvore de acessibilidade em tela estreita.
- Nos diálogos, foram verificados nome, foco inicial, Tab e Shift+Tab, Escape, bloqueio de rolagem da página e retorno do foco. No formulário, foram exercitados campos inválidos, associação das mensagens de erro, inclusão e edição. Na exclusão, foram exercitados cancelamento, erro, sucesso, solicitação de exclusão das parcelas futuras e retorno ao título do extrato quando o botão de origem desaparece.
- Na importação simulada, foram exercitados arquivo inválido, erro de leitura e nova tentativa, conferência, alternância entre documento e revisão, inclusão e remoção de rubrica, erros associados aos campos, erro no envio, conclusão e retorno do foco. O link para abrir o PDF em outra aba foi verificado na árvore de acessibilidade. A extração do PDF foi simulada.
- Em uma janela de 320 × 568 CSS px, foram verificados rolagem do formulário longo, visibilidade do foco e ausência de rolagem horizontal no formulário. Também foi verificada a rolagem da confirmação de importação a 320 × 260 CSS px. Com a preferência de movimento reduzido emulada, a animação do diálogo ficou praticamente instantânea.
- Para as combinações de cores verificadas, textos normais ficaram acima de 4,5:1 e bordas de campos e foco, acima de 3:1. A escolha entre preto e branco garante pelo menos 4,58:1 para o texto do monograma sobre qualquer cor hexadecimal válida.

### Validação com tecnologias assistivas

- Percorrer os fluxos com NVDA no Windows, VoiceOver no Safari para iOS ou macOS e TalkBack no Android. Conferir a fala de título e descrição dos diálogos, os campos obrigatórios e inválidos, os anúncios de carregamento e resultado e a navegação dos cabeçalhos das tabelas.
- Verificar o seletor nativo de cores, a escolha de arquivo e a leitura do PDF em outra aba com leitor de tela e teclado. Conferir também toque, ampliação e cores forçadas em dispositivos reais.

Os diálogos usam o padrão modal nativo e as mensagens de estado usam regiões de anúncio conforme a urgência. [Padrão de diálogo modal do WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) e [WCAG 2.2 sobre mensagens de estado](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

---

## 📄 Licença

Este projeto está licenciado sob a licença **ISC**. Consulte o arquivo [package.json](package.json) para mais informações.

