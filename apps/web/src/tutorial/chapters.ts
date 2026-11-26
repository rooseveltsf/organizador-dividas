import type { GuideScene } from './GuideContext';

export type Lesson = {
  id: string;
  title: string;
  text: string;
  target: string;
  scene?: Partial<Omit<GuideScene, 'today' | 'installment' | 'shopping' | 'payslip' | 'recover'>>;
};

type Chapter = { id: string; title: string; steps: Lesson[] };

export const cover: Chapter = { id: 'capa', title: 'Capa do exemplo', steps: [
  { id: 'entrar', title: 'Entrar no perfil Caderno de exemplo', text: 'Abra a capa para entrar no caderno de demonstração. Tudo o que você experimentar aqui fica no exemplo.', target: '#enter-guide-profile', scene: { access: 'cover', light: 'absent' } },
] };

const chapters: Chapter[] = [
  { id: 'lancamentos', title: 'Anotar e corrigir lançamentos', steps: [
    { id: 'nova-despesa', title: 'Nova despesa', text: 'Este botão abre a ficha para anotar uma conta. Vamos registrar a conta de luz de R$ 148,32, com vencimento no dia 10.', target: '[data-guide="expense"]', scene: { light: 'absent' } },
    { id: 'anotar-luz', title: 'Salvar lançamento', text: 'Confira a descrição, o valor, a data e a categoria da conta de luz e escolha “Salvar lançamento” para colocá-la no extrato. “Cancelar” fecha a ficha sem salvar.', target: '.transaction-actions', scene: { panel: 'light', light: 'absent' } },
    { id: 'dar-baixa', title: 'Marcar como pago', text: 'No extrato, encontre a conta de luz de R$ 148,32 e use o visto para dar baixa depois do pagamento. Se precisar desfazer a baixa, use “Marcar como pendente”.', target: '[data-guide="light"] .settle-button', scene: { light: 'pending' } },
    { id: 'paga', title: 'Conta de luz paga', text: 'A conta continua no extrato. O valor saiu de ‘A pagar’ e passou para ‘Pago’.', target: '[data-guide="light"]', scene: { light: 'paid' } },
    { id: 'receita', title: 'Nova receita', text: 'Escolha “Nova receita” para anotar uma entrada, como um trabalho extra, com descrição, valor, data de recebimento e categoria. Ao receber, use “Marcar como recebido” no extrato ou “Marcar como a receber” para desfazer a baixa.', target: '[data-guide="income"]' },
    { id: 'categorias', title: 'Categoria', text: 'Uma ida ao mercado é cotidiana, o aluguel é fixo, uma assinatura é recorrente e um celular em prestações é parcelado. Em “Fixa” ou “Recorrente”, a quantidade de meses inclui o primeiro lançamento.', target: '[data-guide="category"]', scene: { panel: 'expense' } },
    { id: 'parcelas', title: 'Por parcela ou Pela compra inteira', text: 'Informe o valor de uma prestação em “Por parcela” ou o total em “Pela compra inteira”, que divide o valor entre as parcelas. “Parcela atual” informa por onde começar e “Total de parcelas” indica onde a série termina.', target: '.transaction-mode', scene: { panel: 'installment' } },
    { id: 'filtros', title: 'Busca, filtros e Limpar filtros', text: 'A busca por descrição e os filtros de tipo e situação ajudam a achar um lançamento no mês aberto. Se a lista ficar vazia, “Limpar filtros” volta a mostrar todos os lançamentos daquele mês.', target: '.ledger-tools, .ledger-filters, [data-guide="filters"]', scene: { filters: true } },
    { id: 'editar', title: 'Editar Celular', text: 'O lápis abre “Editar Celular” para corrigir valor, data ou número da parcela. “Salvar alterações” corrige apenas a ocorrência aberta.', target: '[aria-label="Editar Celular"]' },
    { id: 'excluir', title: 'Excluir lançamento?', text: 'A lixeira “Excluir Celular” abre a confirmação. Você pode excluir só a parcela escolhida ou excluí-la junto com as futuras da mesma série, mantendo as anteriores.', target: '[data-guide="delete-series"]', scene: { panel: 'delete-series' } },
    { id: 'tentar-novamente', title: 'Tentar carregar o mês novamente', text: 'Se o mês não carregar, o botão “Tentar carregar” mostra o nome do mês e consulta seus lançamentos de novo. Depois que a consulta funcionar, o extrato volta a exibir as linhas do mês.', target: '[data-guide="retry-statement"]', scene: { retry: true } },
  ] },
  { id: 'perfil', title: 'Meu perfil e meu PIN', steps: [
    { id: 'criar', title: 'Criar meu perfil', text: 'Na primeira utilização, “Criar meu perfil” abre a ficha para dar um nome e escolher as cores da capa. Quando já há perfis, a mesma ação se chama “Criar perfil”.', target: '[data-guide="create-profile"]', scene: { access: 'empty' } },
    { id: 'previa', title: 'Prévia na seleção de perfis', text: 'Escreva o nome, escolha as cores e confira como sua capa aparece na prévia. “Criar e entrar” salva o perfil e abre o caderno.', target: '.directory-preview', scene: { access: 'empty', panel: 'create' } },
    { id: 'buscar', title: 'Buscar perfil por nome', text: 'Quando há vários perfis, digite parte do nome para filtrar as capas. “Entrar no perfil Caderno de exemplo” abre o caderno escolhido.', target: '[aria-label="Buscar perfil por nome"]', scene: { access: 'directory' } },
    { id: 'trocar', title: 'Trocar perfil', text: 'Use “Trocar perfil” no extrato para voltar à seleção de capas. Nas outras abas, escolha outro nome no seletor “Perfil”.', target: '[data-guide="switch-profile"]' },
    { id: 'engrenagem', title: 'Configurações do perfil', text: 'A engrenagem abre as configurações do PIN do perfil. Para adicionar essa proteção opcional, digite e confirme quatro dígitos e escolha “Salvar PIN”.', target: '[aria-label="Configurações do perfil"]' },
    { id: 'alterar', title: 'Salvar PIN ou Remover PIN', text: 'Digite o PIN atual e confirme o novo PIN de quatro dígitos para alterar a proteção. Para retirá-la, escolha “Remover PIN” e depois “Confirmar remoção”; o PIN deste exemplo é 1234.', target: '[data-guide="pin-actions"]', scene: { access: 'protected', panel: 'pin' } },
    { id: 'bloquear', title: 'Bloquear perfil', text: 'O cadeado aparece quando há PIN e fecha o acesso ao perfil. Para reabrir, escolha a capa e informe os quatro dígitos.', target: '[aria-label="Bloquear perfil"]', scene: { access: 'protected' } },
    { id: 'desbloquear', title: 'Desbloquear', text: 'Digite 1234 no exemplo e use “Desbloquear” para entrar novamente. “Cancelar” volta para a seleção de perfis.', target: '[data-guide="unlock-profile"]', scene: { access: 'unlock' } },
    { id: 'lixeira', title: 'Excluir perfil Caderno de exemplo', text: 'A lixeira abre o aviso de exclusão do perfil. Leia quais lançamentos serão apagados antes de confirmar.', target: '[aria-label="Excluir perfil Caderno de exemplo"], [data-guide="delete-profile"]' },
    { id: 'excluir', title: 'Confirmar exclusão do perfil', text: 'Excluir o perfil apaga os lançamentos vinculados a ele. Em um perfil protegido, confirme com o PIN atual, que neste exemplo é 1234.', target: '[data-guide="delete-profile"]', scene: { access: 'protected', panel: 'delete-profile' } },
    { id: 'tentar-novamente', title: 'Tentar carregar os perfis novamente', text: 'Quando a seleção de perfis não carregar, use este botão para consultar a lista novamente. As capas aparecem quando os perfis estiverem disponíveis.', target: '[data-guide="profile-retry"]', scene: { access: 'cover', retry: true } },
  ] },
  { id: 'mes', title: 'Ler o mês', steps: [
    { id: 'navegar', title: 'Mês anterior e Próximo mês', text: 'As setas mudam o mês exibido. O resumo e o extrato passam a mostrar os lançamentos do período escolhido.', target: '[aria-label="Navegação mensal"]' },
    { id: 'resumo', title: 'Resultado previsto e realizado', text: 'O previsto soma o que está anotado para o mês: entradas menos saídas. O realizado mostra o que já entrou menos o que já foi pago.', target: '.statement-main' },
    { id: 'detalhar', title: 'Detalhar despesas e diferença em aberto', text: 'Abra o detalhe para conferir quanto ainda falta pagar por grupo de despesa. No resumo, confira “A receber” e “A pagar”; a diferença em aberto compara os dois valores.', target: '.expense-breakdown summary' },
  ] },
  { id: 'futuro', title: 'Compromissos futuros', steps: [
    { id: 'meses', title: 'Navegação dos compromissos por mês', text: 'Use as setas para consultar as despesas fixas, recorrentes e parceladas cadastradas para cada mês futuro. “Mês anterior” fica indisponível no primeiro mês futuro.', target: '[aria-label="Navegação dos compromissos por mês"]', scene: { view: 'future' } },
    { id: 'aberto', title: 'Em aberto no mês e por categoria', text: 'O total em aberto soma as despesas do mês que ainda faltam pagar, e o quadro por categoria mostra de onde ele vem. A indicação “Parcela 2 de 4”, por exemplo, diz qual prestação vence nesse mês e quantas existem no total.', target: '.commitments-summary', scene: { view: 'future' } },
    { id: 'extrato', title: 'Ver no extrato', text: 'Use “Ver no extrato” na parcela do celular. O aplicativo abre o mês do vencimento e localiza a linha para você conferir ou editar.', target: '[aria-label^="Ver no extrato · Celular"]', scene: { view: 'future' } },
    { id: 'tentar-novamente', title: 'Tentar novamente', text: 'Se os compromissos não carregarem, “Tentar novamente” consulta os dados outra vez. Quando carregar, você poderá voltar a navegar pelos meses.', target: '[data-guide="future-retry"]', scene: { view: 'future', retry: true } },
  ] },
  { id: 'compras', title: 'Lista de compras', steps: [
    { id: 'adicionar', title: 'Adicionar item', text: 'Abra a ficha para anotar o nome, o preço estimado e as condições de pagamento. Se ainda não souber algum detalhe, deixe o campo opcional em branco e use “Salvar item”.', target: '[data-guide="shopping-add"]', scene: { view: 'shopping' } },
    { id: 'editar', title: 'Editar item', text: '“Editar” reabre as condições do item para atualizar o preço estimado, a data ou o número de parcelas. As mudanças aparecem na lista depois de “Salvar item”.', target: '.shopping-form', scene: { view: 'shopping', panel: 'shopping-edit' } },
    { id: 'arquivar', title: 'Arquivar e Arquivados', text: 'Use “Arquivar” para tirar um item da lista principal. Abra “Arquivados” para consultá-lo novamente.', target: '[data-guide="shopping-archive"]', scene: { view: 'shopping' } },
    { id: 'calculadora', title: 'Abrir na Calculadora', text: 'Este botão leva a estimativa e as condições para “Simular compra”. Você pode ajustar os valores para comparar o efeito da compra no orçamento.', target: '[data-guide="shopping-simulate"]', scene: { view: 'shopping' } },
    { id: 'corrigir', title: 'Corrigir valor e concluir', text: 'Quando a estimativa está completa, “Corrigir valor e concluir” permite informar o preço real antes de registrar a compra. Confira o valor e use “Confirmar compra” para gerar os lançamentos.', target: '[data-guide="shopping-correct"], .shopping-form', scene: { view: 'shopping' } },
    { id: 'vista', title: 'Marcar como comprado à vista', text: 'Concluir a compra gera lançamentos no extrato. Use “Marcar como comprado” na Luminária à vista para criar uma despesa e depois confira “Ver no Extrato”.', target: '[data-guide="shopping-cash"]', scene: { view: 'shopping' } },
    { id: 'parcelado', title: 'Marcar como comprado em parcelas', text: 'No Fone parcelado, “Marcar como comprado” registra a série no extrato. Se faltarem dados, a confirmação pede que você informe o valor real, a forma de pagamento e as datas aplicáveis.', target: '[data-guide="shopping-installments"]', scene: { view: 'shopping' } },
    { id: 'condicoes', title: 'Confirmar compra com dados pendentes', text: 'Ao marcar a Mochila como comprada, preencha o preço e as condições que ainda faltam. “Confirmar compra” leva as despesas ao extrato depois que os campos obrigatórios estiverem completos.', target: '.shopping-form', scene: { view: 'shopping', panel: 'shopping-incomplete' } },
    { id: 'tentar-novamente', title: 'Tentar novamente', text: 'Use “Tentar novamente” quando os itens não carregarem. A lista volta a mostrar as compras planejadas, compradas e arquivadas quando a consulta funcionar.', target: '[data-guide="shopping-retry"]', scene: { view: 'shopping', retry: true } },
  ] },
  { id: 'simulacao', title: 'Simular compra', steps: [
    { id: 'oferta', title: 'Valor total da oferta e Forma de pagamento', text: 'Informe o preço total e escolha “À vista” ou “Parcelada”. Ajuste a data do pagamento ou, se parcelar, o primeiro vencimento e a quantidade de parcelas.', target: '.purchase-fields', scene: { view: 'purchase' } },
    { id: 'testar', title: 'Testar outro valor', text: 'Você pode testar outros valores aqui. Simular não registra uma despesa.', target: 'input[name="total"]', scene: { view: 'purchase', projection: true } },
    { id: 'sobra', title: 'Sobra mensal projetada', text: 'Compare as colunas “Sem a compra” e “Com a compra” para ver quanto sobraria mês a mês. Os avisos indicam meses com informações incompletas ou séries cuja continuidade precisa ser conferida.', target: '.purchase-results', scene: { view: 'purchase', projection: true } },
    { id: 'premissas', title: 'Margem e premissas opcionais', text: 'A margem sinaliza os meses em que sobraria menos do que você quer reservar. Para recorrências, use “Premissa na simulação” para considerar apenas o que já está cadastrado ou projetar a continuidade.', target: '.purchase-details summary', scene: { view: 'purchase', projection: true } },
    { id: 'nova', title: 'Nova simulação', text: '“Nova simulação” limpa a oferta e libera o formulário para testar outros valores. Simular não registra uma despesa.', target: '[data-guide="reset-simulation"]', scene: { view: 'purchase', projection: true } },
    { id: 'tentar-novamente', title: 'Tentar novamente', text: 'Se o orçamento não carregar, use “Tentar novamente” para consultar os lançamentos. A calculadora mantém os valores que você digitou enquanto refaz a consulta.', target: '[data-guide="simulation-retry"]', scene: { view: 'purchase', projection: true, retry: true } },
  ] },
  { id: 'contracheque', title: 'Importar contracheque', steps: [
    { id: 'arquivo', title: 'Arquivo · Selecionar PDF', text: 'Em “Importar contracheque”, use “Selecionar PDF” para ler um documento com texto selecionável de até 5 MB. Aqui o botão carrega o contracheque fictício.', target: '.payslip-drop', scene: { panel: 'pdf-file' } },
    { id: 'conferencia', title: 'Conferência · Escolher lançamentos', text: 'Compare a competência e os valores lidos com o documento. Uma rubrica é uma linha do contracheque, como salário ou desconto, e “Escolher lançamentos” abre a revisão desses valores.', target: '[data-guide="pdf-next"]', scene: { panel: 'pdf-review' } },
    { id: 'documento', title: 'Documento original e Trocar PDF', text: 'Use “Trocar PDF” para escolher outro documento se a leitura estiver incorreta. Em um PDF de várias páginas, “Anterior” e “Próxima” percorrem a prévia no desktop; na web, use os controles do leitor do navegador.', target: '.payslip-document-bar', scene: { panel: 'pdf-document' } },
    { id: 'lancamentos', title: 'Lançamentos · Salário líquido ou Rubricas detalhadas', text: '“Salário líquido” registra o que você recebe e “Rubricas detalhadas” deixa escolher entradas e descontos linha por linha. Confira descrição, valor e data de cada lançamento antes de prosseguir.', target: '.payslip-modes', scene: { panel: 'pdf-entries' } },
    { id: 'revisar', title: 'Revisar importação', text: 'Em rubricas parceladas, confira a parcela atual e o total; para fixas e recorrentes, ajuste a repetição quando disponível. Se “Revisar importação” estiver indisponível, selecione pelo menos um lançamento e corrija os campos destacados.', target: '[data-guide="pdf-next"]', scene: { panel: 'pdf-deductions' } },
    { id: 'confirmar', title: 'Confirmação · Confirmar e registrar', text: '“Confirmar e registrar” é o botão que grava os lançamentos no extrato do perfil no uso normal. Aqui você pode confirmar e conferir o recibo no Caderno de exemplo.', target: '[data-guide="pdf-next"]', scene: { panel: 'pdf-confirm' } },
  ] },
];

const windows: Chapter = { id: 'windows', title: 'Recursos do Windows', steps: [
  { id: 'dados', title: 'Dados → Importar banco da versão web…', text: 'No menu “Dados” da janela, “Importar banco da versão web…” traz uma base SQLite da versão web. “Importar contracheque” lê um PDF e prepara lançamentos no perfil aberto.', target: '[data-guide="windows-menu"]' },
  { id: 'selecionar', title: 'Selecionar banco SQLite', text: 'Escolha o arquivo .db, .sqlite ou .sqlite3 para preparar uma cópia. Se a base web tiver perfis protegidos, a tela pede o segredo da instalação web e os PINs correspondentes.', target: '[data-guide="windows-choose"]' },
  { id: 'ativar', title: 'Ativar base importada', text: 'Este botão torna a cópia a base em uso e mantém a base anterior guardada. No menu “Dados”, “Sair” fecha o aplicativo.', target: '[data-guide="windows-activate"]' },
] };

export const guideChapters = __ORGANIZADOR_DESKTOP__ ? [...chapters, windows] : chapters;
export const guideRoute = [cover, ...guideChapters].flatMap(chapter => chapter.steps.map((lesson, index) => ({ chapter, lesson, index })));
export const lessonPosition = (chapterId: string, stepId: string) =>
  guideRoute.findIndex(({ chapter, lesson }) => chapter.id === chapterId && lesson.id === stepId);
