# Caderno de Dívidas

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
- [Aplicativo desktop para Windows](#aplicativo-desktop-para-windows)
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

O **Caderno de Dívidas** foi desenvolvido para solucionar a desorganização financeira pessoal familiar ou individual. Ele permite isolar as finanças por perfis de usuários com personalização visual própria (cores e identidade), além de oferecer previsibilidade orçamentária através do controle rigoroso de despesas fixas, assinaturas recorrentes, compras parceladas e entradas de salário.

Destaca-se pelo recurso de **Importação Inteligente de Contracheque (Holerite em PDF)**: o usuário faz o upload do documento, o sistema analisa o texto e as coordenadas espaciais das rubricas via `pdfjs-dist` e apresenta uma tela dividida (*split-screen*) com o PDF original à esquerda e a tabela editável à direita para conferência e gravação em lote.

---

## 🏗 Arquitetura do Monorepo

O projeto está estruturado em **npm workspaces**:

```
caderno-dividas/
├── apps/
│   ├── api/      # Backend REST em Node.js, Express, Prisma ORM e SQLite
│   ├── web/      # Frontend SPA em React 18, Vite e Panda CSS
│   └── desktop/  # Electron, migração local e instalador NSIS
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
  - **Coluna da Esquerda (40%):** prévia do documento original em memória. O navegador web usa o visualizador de PDF do próprio navegador. O Electron renderiza as páginas na mesma janela com PDF.js.
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

### 6. Simular compra

Informe o total real da oferta, a forma de pagamento e as datas da compra. O nome é opcional. A simulação consulta os lançamentos do perfil e atualiza a comparação mensal no navegador, sem gravar lançamentos.

- A tabela começa no mês atual e cobre três meses ou até o último vencimento, se ele for posterior. A sobra mensal projetada usa receitas menos despesas previstas, agrupadas pelo mês do lançamento como no Extrato. As liquidações aparecem em detalhes separados.
- O parcelamento segue a distribuição de centavos e o calendário do cadastro. A tela destaca o menor resultado, o primeiro mês negativo e os valores abaixo de uma margem opcional. Quando faltam dados no horizonte, os destaques priorizam os meses com cobertura.
- A seção de encerramentos mostra quando parcelas conhecidas deixam de pesar na projeção e permite consultar os registros no Extrato. O fim dos lançamentos de uma recorrência sinaliza cobertura insuficiente nos meses seguintes. As premissas opcionais de fim ou continuidade aparecem separadas dos valores cadastrados.

### 7. Lista de compras

Cadastre os itens no perfil, com preço estimado e condições de pagamento opcionais. **Abrir na Calculadora** preenche uma simulação com os dados do item.

**Marcar como comprado** usa as condições preenchidas ou pede os dados necessários. Use **Corrigir valor e concluir** para registrar um preço real diferente da estimativa. A compra à vista entra como paga e as parcelas entram como pendentes. **Ver no Extrato** abre o lançamento vinculado. Arquivar preserva os lançamentos da compra.

---

## 📁 Estrutura de Diretórios

```
caderno-dividas/
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

## Aplicativo desktop para Windows

O instalador NSIS é para Windows x64 e instala por usuário. Abra **Caderno de Dívidas** pelo menu Iniciar ou pelo atalho da área de trabalho. O aplicativo empacotado usa o Chromium e o Node.js do Electron e funciona offline. Nesta entrega, o instalador é **sem assinatura digital**. O Windows pode mostrar um aviso de editor desconhecido.

### Compilar e testar

Na máquina de desenvolvimento, use Windows x64, Node.js 24 LTS e npm. A instalação das dependências e o primeiro empacotamento baixam o Electron e as ferramentas NSIS.

```powershell
npm ci
npm run desktop:dev     # Compila e abre no Electron com dados de desenvolvimento
npm run desktop:build   # Compila React, Express, Prisma, contratos e Electron
npm run desktop:dist    # Gera dist/desktop/Caderno-de-Dividas-1.0.0-Windows-x64-Setup.exe
npm run test:desktop    # Testa os SQLs utilizados pelo instalador com bancos temporários
npm test               # Testa os contratos e os fluxos financeiros existentes
```

Para rodar o teste do binário compilado, defina `$env:DESKTOP_TEST_EXECUTABLE` para o caminho do `.exe` instalado e execute `node --test tests/desktop-package.browser.cjs`. O teste cria uma pasta temporária separada e usa apenas dados fictícios.

O desktop serve a interface e `/api` no mesmo endereço de loopback, com porta escolhida pelo sistema. O Electron inicializa o Express em um `utilityProcess` e libera a janela quando o Prisma está conectado. Os comandos web abaixo continuam disponíveis.

### Dados e importação da versão web

- O Caderno de Dívidas usa a pasta de dados histórica para abrir os perfis e lançamentos das instalações anteriores. A base inicial fica em `%APPDATA%\Organizador de Dívidas\bases\principal\organizador.sqlite`. A versão de desenvolvimento usa `%APPDATA%\Organizador de Dívidas (Desenvolvimento)`. Para uma validação isolada, inicie o executável com `--user-data-dir="C:\caminho\de teste"`.
- Use **Dados → Importar banco da versão web… → Selecionar banco SQLite**. Escolha o arquivo original. Se a instalação web usa WAL, selecione o banco na pasta onde estão seus arquivos auxiliares. O aplicativo faz uma cópia consistente e valida sua integridade e seu schema.
- Para cada perfil protegido, informe seu PIN de quatro dígitos e o `PROFILE_PIN_SECRET` original da versão web. Corrija a configuração se a validação falhar. Após **Ativar base importada**, desbloqueie o perfil novamente. A importação descarta as sessões da cópia e reinicia seus contadores de tentativas.
- Cada importação fica em `bases\importacao-*`. O arquivo `base-ativa.txt` indica qual pasta está selecionada. A base web original e a base desktop anterior ficam em seus locais. O `pin-secret.bin` de cada base é protegido pelo `safeStorage` do Electron na conta Windows que o gravou. Preserve o segredo original da versão web em local seguro enquanto precisar recuperar ou repetir a importação.

### Backup e recuperação

Antes de migrar uma base existente, o app guarda um snapshot SQLite consistente na subpasta `backups` da base. Os SQLs originais são aplicados em ordem depois do schema histórico de `8a4fd12`. O inicializador reconhece schemas conhecidos criados diretamente pelo Prisma e registra as migrações já refletidas no schema. Uma falha de migração reverte a transação e mantém o snapshot.

Para um backup manual, encerre o app e copie toda a pasta `%APPDATA%\Organizador de Dívidas`. Ela contém a seleção ativa, as bases e seus arquivos `pin-secret.bin`. Restaure na mesma conta Windows.

Para recuperar após falha, aguarde o app encerrar e guarde uma cópia da pasta de dados. Na pasta da base afetada, mova `organizador.sqlite` e seus arquivos `-wal` e `-shm`, se existirem, para uma pasta de recuperação. Copie o snapshot escolhido de `backups` para `organizador.sqlite` e mantenha o `pin-secret.bin` da mesma base. Abra novamente com uma versão compatível. Para voltar à base desktop anterior após uma importação, edite `base-ativa.txt` com o nome da pasta desejada em `bases`, por exemplo `principal`, sempre com o app fechado.

## 🛠 Guia de Instalação e Execução

### Pré-requisitos
- **Node.js**: versão 22.13 ou superior para a versão web, com Node.js 24 LTS recomendado para gerar o aplicativo desktop.
- **npm**: versão 9.x ou superior

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone <URL_DO_REPOSITORIO> caderno-dividas
   cd caderno-dividas
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
   O SQLite local distribuído com o projeto já contém tabelas e usa esse comando para atualizar o esquema. Em um banco que já acompanha o histórico do Prisma, aplique as migrações pendentes com `npm exec -w @organizador/api -- prisma migrate deploy`.
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

