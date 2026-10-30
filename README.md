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
- [Estrutura de Diretórios](#-estrutura-de-diretórios)
- [Guia de Instalação e Execução](#-guia-de-instalação-e-execução)
  - [Pré-requisitos](#pré-requisitos)
  - [Passo a Passo](#passo-a-passo)
  - [Scripts Disponíveis](#scripts-disponíveis)
- [Rotas da API REST](#-rotas-da-api-rest)
- [Design System & Estilização (Panda CSS)](#-design-system--estilização-panda-css)
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

4. **Execute as migrações do banco de dados (Prisma):**
   ```bash
   npm run prisma:migrate -w @organizador/api
   ```
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
| `npm run clean` | Remove os diretórios `dist` de todos os workspaces. |

---

## 📡 Rotas da API REST

A API roda por padrão na porta `3000` e atende nos prefixos `/` e `/api`:

### Perfis de Usuário
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/profiles` | Lista todos os perfis cadastrados. |
| `POST` | `/api/profiles` | Cria um novo perfil (`name`, `primaryColor`, `secondaryColor`). |
| `GET` | `/api/profiles/:id` | Retorna os detalhes de um perfil por ID. |
| `PUT` | `/api/profiles/:id` | Atualiza dados e cores do perfil. |
| `DELETE` | `/api/profiles/:id` | Remove o perfil e todas as suas transações vinculadas em cascata. |

### Transações & Dívidas
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/transactions?profileId={id}&month={m}&year={y}` | Lista transações do perfil filtradas por mês/ano. |
| `POST` | `/api/transactions` | Cria uma transação com suporte a repetição mensal e parcelamento. |
| `POST` | `/api/transactions/batch` | Criação em lote de transações (usado no contracheque) com projeção futura. |
| `PATCH`| `/api/transactions/:id/status` | Alterna status (`pending` / `paid` / `overdue`) e preenche `paymentDate`. |
| `PUT`  | `/api/transactions/:id` | Atualiza os dados de uma transação existente. |
| `DELETE`| `/api/transactions/:id?deleteAll=true` | Exclui a transação (ou todas as parcelas da série com `deleteAll=true`). |

### Leitura de Contracheque (PDF)
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/payslip/parse` | Recebe arquivo PDF no campo `file` (`multipart/form-data`) e retorna totais, rubricas e parcelas extraídas. |

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
- **Variáveis Dinâmicas de Perfil:** Os tokens `brand.primary`, `brand.primaryHover`, `brand.primarySoft` e `brand.secondary` mapeiam dinamicamente para as variáveis CSS da sessão ativa, garantindo identidade visual sem reprocessamento de CSS.
- **Zero Runtime:** Não há injeção de CSS em runtime via JavaScript, proporcionando renderização suave e sem recálculos de layout (*jank*).

---

## 📄 Licença

Este projeto está licenciado sob a licença **ISC**. Consulte o arquivo [package.json](package.json) para mais informações.

