import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import {
  PayslipParseResult,
  PayslipExtractedItem,
  TransactionCategory,
} from '@organizador/shared';

const pdfRoot = dirname(require.resolve('pdfjs-dist/package.json'));
const pdfAssets = (directory: string) => join(pdfRoot, directory).replaceAll('\\', '/') + '/';

export interface TextFragment {
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface ParsedLine {
  y: number;
  fragments: TextFragment[];
  text: string;
}

/**
 * Converte strings monetárias no padrão brasileiro (ex: "1.234,56", "R$ 450,00", "250,90") em número
 */
export function parseBrazilianCurrency(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/[R$\s]/g, '').trim();

  // Caso: 1.234,56
  if (clean.includes('.') && clean.includes(',')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  }
  // Caso: 1234,56
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.'));
  }
  return parseFloat(clean) || 0;
}

/**
 * Retorna o 5º dia útil do mês seguinte no formato YYYY-MM-DD
 */
export function getNextMonthDate(refMonthStr?: string, day: number = 5): string {
  if (!refMonthStr || !refMonthStr.includes('-')) {
    const now = new Date();
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, day);
    const y = nextDate.getFullYear();
    const m = String(nextDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const parts = refMonthStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10); // 1 a 12

  // Em JavaScript Date, month 0 = Jan, portanto 'month' equivale ao próximo mês
  const nextDate = new Date(year, month, day);
  const nextY = nextDate.getFullYear();
  const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
  const nextD = String(day).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
}

const MONTH_NAMES: { [key: string]: string } = {
  janeiro: '01',
  jan: '01',
  fevereiro: '02',
  fev: '02',
  marco: '03',
  março: '03',
  mar: '03',
  abril: '04',
  abr: '04',
  maio: '05',
  mai: '05',
  junho: '06',
  jun: '06',
  julho: '07',
  jul: '07',
  agosto: '08',
  ago: '08',
  setembro: '09',
  set: '09',
  outubro: '10',
  out: '10',
  novembro: '11',
  nov: '11',
  dezembro: '12',
  dez: '12',
};

const INSTALLMENT_REGEX =
  /(?:parc(?:ela)?\.?|prest(?:a[cç][aã]o)?\.?)?\s*(\d{1,3})\s*[\/|\\]\s*(\d{1,3})/i;

export class PayslipPdfParserService {
  /**
   * Processa o buffer binário de um arquivo PDF de contracheque
   * e extrai de forma estruturada as fontes de renda, deduções e totais.
   */
  public static async parse(pdfBuffer: Buffer): Promise<PayslipParseResult> {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
      cMapUrl: pdfAssets('cmaps'),
      cMapPacked: true,
      iccUrl: pdfAssets('iccs'),
      standardFontDataUrl: pdfAssets('standard_fonts'),
      wasmUrl: pdfAssets('wasm'),
    });

    const doc = await loadingTask.promise;
    const allLines: ParsedLine[] = [];

    // 1. Extração espacial dos fragmentos de texto por página
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();

      const linesMap: { [key: string]: { y: number; fragments: TextFragment[] } } = {};

      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          const trimmed = item.str.trim();
          if (!trimmed) continue;

          const y = Math.round(item.transform[5] * 10) / 10;
          const foundY = Object.keys(linesMap).find((k) => Math.abs(Number(k) - y) <= 2.8);
          const key = foundY || String(y);

          if (!linesMap[key]) {
            linesMap[key] = { y: Number(key), fragments: [] };
          }

          linesMap[key].fragments.push({
            text: item.str.trim(),
            x: Math.round(item.transform[4] * 10) / 10,
            y,
            width: item.width,
            height: item.height,
          });
        }
      }

      // Ordena linhas por Y descendente (do topo ao rodapé)
      const sortedPageLines = Object.values(linesMap).sort((a, b) => b.y - a.y);

      for (const line of sortedPageLines) {
        // Ordena fragmentos por X ascendente (da esquerda para a direita)
        line.fragments.sort((a, b) => a.x - b.x);
        allLines.push({
          y: line.y,
          fragments: line.fragments,
          text: line.fragments.map((f) => f.text).join(' '),
        });
      }
    }

    // 2. Isolamento da 1ª Via (Deduplicação de holerites com 2 vias na mesma página)
    // Em contracheques brasileiros clássicos, a página é dividida em 2 vias idênticas.
    // Assim que ultrapassamos o rodapé da 1ª via (onde há 'Salário Base' ou 'Valor Líquido'),
    // se reaparece um cabeçalho de empresa ('CNPJ:', 'Folha Mensal', 'Código Nome do Funcionário'), encerra a 1ª via.
    const viaLines: ParsedLine[] = [];
    let passedFirstViaFooter = false;

    for (const l of allLines) {
      const lower = l.text.toLowerCase();
      if (
        passedFirstViaFooter &&
        (lower.includes('cnpj:') ||
          lower.includes('folha mensal') ||
          lower.includes('código nome do funcionário') ||
          (lower.includes('recibo') && lower.includes('pagamento')))
      ) {
        break; // Interrompe a leitura na fronteira da 2ª via para evitar duplicação!
      }

      viaLines.push(l);

      if (lower.includes('salário base') || lower.includes('salario base') || lower.includes('valor líquido') || lower.includes('valor liquido')) {
        passedFirstViaFooter = true;
      }
    }

    const rawTextPreview = viaLines.map((l) => l.text).join('\n');

    // 3. Identificação do Empregador (Razão Social)
    let employerName: string | undefined;
    for (const line of viaLines.slice(0, 8)) {
      const upper = line.text.toUpperCase();
      if (
        upper.includes('LTDA') ||
        upper.includes('S.A') ||
        upper.includes('S/A') ||
        upper.includes('EIRELI') ||
        upper.includes('EPP') ||
        upper.includes('ME') ||
        upper.includes('INSTITUTO') ||
        upper.includes('HOSPITAL') ||
        upper.includes('PREFEITURA')
      ) {
        employerName = line.text.trim();
        break;
      }
    }

    // 4. Identificação do Mês de Referência (Competência)
    // Dá prioridade estrita para "Folha Mensal", "Competência", "Mês/Ano"
    // e EXCLUI explicitamente linhas de data de admissão ("Admissão: 25/01/2021")
    let referenceMonth: string | undefined;

    for (const line of viaLines.slice(0, 15)) {
      if (line.text.toLowerCase().includes('admissão') || line.text.toLowerCase().includes('admissao')) {
        continue; // Ignora linha de admissão para não capturar ano incorreto!
      }

      // Ex: "Folha Mensal Julho de 2026" ou "Julho de 2026"
      const matchMonthName = line.text.match(
        /(?:folha\s+mensal|compet[eê]ncia|per[ií]odo|m[eê]s|ref(?:\.|er[eê]ncia)?)?\s*([a-zç]+)\s+de\s+(\d{4})/i
      );
      if (matchMonthName) {
        const monthKey = matchMonthName[1].toLowerCase();
        if (MONTH_NAMES[monthKey]) {
          referenceMonth = `${matchMonthName[2]}-${MONTH_NAMES[monthKey]}`;
          break;
        }
      }

      // Ex: "Competência: 07/2026" ou "07/2026"
      const matchMonthNum = line.text.match(
        /(?:folha\s+mensal|compet[eê]ncia|per[ií]odo|m[eê]s|ref(?:\.|er[eê]ncia)?)\s*[:=]?\s*(0[1-9]|1[0-2])[\/\-](\d{4})/i
      );
      if (matchMonthNum) {
        referenceMonth = `${matchMonthNum[2]}-${matchMonthNum[1].padStart(2, '0')}`;
        break;
      }
    }

    // Fallback de competência caso não encontrada com rótulos
    if (!referenceMonth) {
      for (const line of viaLines.slice(0, 10)) {
        if (line.text.toLowerCase().includes('admissão') || line.text.toLowerCase().includes('admissao')) {
          continue;
        }
        const genericMatch = line.text.match(/\b(0[1-9]|1[0-2])[\/\-](20\d{2})\b/);
        if (genericMatch) {
          referenceMonth = `${genericMatch[2]}-${genericMatch[1]}`;
          break;
        }
      }
    }

    // 5. Detecção das Coordenadas X das Colunas da Tabela
    let refX: number | null = null;
    let vencX: number | null = null;
    let descX: number | null = null;

    for (const line of viaLines) {
      for (const frag of line.fragments) {
        const lower = frag.text.toLowerCase();
        if (lower === 'referência' || lower === 'referencia') {
          refX = frag.x;
        } else if (lower === 'vencimentos' || lower === 'proventos') {
          vencX = frag.x;
        } else if (lower === 'descontos') {
          descX = frag.x;
        }
      }
      if (refX !== null && vencX !== null && descX !== null) {
        break;
      }
    }

    // Posições de fallback padrão baseadas no layout convencional de contracheque
    const effectiveRefX = refX || 290;
    const effectiveVencX = vencX || 370;
    const effectiveDescX = descX || 454;

    // 6. Extração das Rubricas da Tabela
    const items: PayslipExtractedItem[] = [];
    let inTableRegion = false;
    let hasAdvancePayment = false;
    let advanceAmount = 0;

    for (const line of viaLines) {
      const lower = line.text.toLowerCase();

      // Início da tabela de rubricas
      if (lower.includes('código') && lower.includes('descrição')) {
        inTableRegion = true;
        continue;
      }

      // Fim da tabela de rubricas ao atingir os totais
      if (
        lower.includes('total de vencimentos') ||
        lower.includes('total vencimentos') ||
        lower.includes('total de proventos') ||
        lower.includes('total proventos') ||
        lower.includes('valor líquido') ||
        lower.includes('valor liquido') ||
        lower.includes('salário base') ||
        lower.includes('salario base')
      ) {
        inTableRegion = false;
        continue;
      }

      if (!inTableRegion) continue;

      const frags = line.fragments;
      if (frags.length < 2) continue;

      // 1º fragmento como código da rubrica (ex: "1", "256", "218")
      let rawCode: string | undefined;
      if (/^\d{1,5}$/.test(frags[0].text)) {
        rawCode = frags[0].text;
      }

      let reference = '';
      let vencValue: number | null = null;
      let descValue: number | null = null;
      const descFrags: string[] = [];

      for (const f of frags) {
        if (rawCode && f === frags[0]) continue;

        const isRef = f.x >= effectiveRefX - 25 && f.x < effectiveVencX - 20;
        const isVenc = f.x >= effectiveVencX - 20 && f.x < effectiveDescX - 20;
        const isDesc = f.x >= effectiveDescX - 20 && f.x < 530;

        if (isRef) {
          // Coleta texto da coluna Referência (ex: "220:00", "50,00", "8,08")
          reference = f.text;
        } else if (isVenc) {
          const val = parseBrazilianCurrency(f.text);
          if (val > 0) vencValue = val;
        } else if (isDesc) {
          const val = parseBrazilianCurrency(f.text);
          if (val > 0) descValue = val;
        } else if (f.x < effectiveRefX - 25) {
          descFrags.push(f.text);
        }
      }

      let description = descFrags.join(' ').trim();
      if (!description && (vencValue || descValue)) {
        description = `Rubrica ${rawCode || ''}`.trim();
      }

      if (!description && !vencValue && !descValue) continue;

      // Detecta parcelamentos de empréstimos consignados
      let suggestedCategory: TransactionCategory = 'fixed';
      let currentInstallment: number | undefined;
      let totalInstallments: number | undefined;

      const instMatch = line.text.match(INSTALLMENT_REGEX);
      const isConsignado =
        description.toLowerCase().includes('consignado') ||
        description.toLowerCase().includes('consignação') ||
        description.toLowerCase().includes('empréstimo') ||
        description.toLowerCase().includes('emprestimo');

      if (instMatch) {
        suggestedCategory = 'installment';
        currentInstallment = parseInt(instMatch[1], 10);
        totalInstallments = parseInt(instMatch[2], 10);
      } else if (isConsignado) {
        suggestedCategory = 'installment';
      }

      // SE for Vencimento / Provento (Receita do Mês)
      if (vencValue !== null) {
        items.push({
          tempId: randomUUID(),
          rawCode,
          description,
          reference: reference || undefined,
          amount: Math.round(vencValue * 100) / 100,
          type: 'income',
          suggestedCategory,
          currentInstallment,
          totalInstallments,
          selected: true, // Vencimentos vêm selecionados por padrão!
        });
      }

      // SE for Desconto em Folha
      if (descValue !== null) {
        const lowerDesc = description.toLowerCase();
        // Inteligência para Adiantamento Salarial / Quinzena:
        // No Brasil, o adiantamento salarial aparece descontado no holerite porque
        // o funcionário já o recebeu na quinzena (dia 20). Para fins de finanças pessoais,
        // trata-se de uma ENTRADA (Receita) recebida no dia 20!
        const isAdiantamento =
          lowerDesc.includes('adiantamento') ||
          lowerDesc.includes('vale') ||
          rawCode === '218';

        if (isAdiantamento) {
          hasAdvancePayment = true;
          advanceAmount = descValue;

          const advanceDate = referenceMonth ? `${referenceMonth}-20` : undefined;

          items.push({
            tempId: randomUUID(),
            rawCode,
            description: description || 'Adiantamento Salarial (Quinzena)',
            reference: reference || undefined,
            amount: Math.round(descValue * 100) / 100,
            type: 'income', // Reconhece como ENTRADA de dinheiro no dia 20!
            suggestedCategory: 'fixed',
            isAdvance: true,
            suggestedDate: advanceDate,
            selected: true, // Adiantamento vem selecionado como receita!
          });
        } else {
          // Outros descontos (INSS, Plano de Saúde, Empréstimo):
          // Como o usuário pediu especificamente "pegue apenas as receitas e não os descontos",
          // os descontos normais são mantidos na lista para transparência,
          // porém com selected: false (desmarcados por padrão).
          items.push({
            tempId: randomUUID(),
            rawCode,
            description,
            reference: reference || undefined,
            amount: Math.round(descValue * 100) / 100,
            type: 'expense',
            suggestedCategory,
            currentInstallment,
            totalInstallments,
            isAdvance: false,
            selected: false, // Descontos desmarcados por padrão!
          });
        }
      }
    }

    // 7. Extração dos Totais Oficiais do Rodapé
    let grossAmount = 0;
    let totalDeductions = 0;
    let netAmount = 0;

    for (let i = 0; i < viaLines.length; i++) {
      const l = viaLines[i];
      const lower = l.text.toLowerCase();

      // Linha "Total de Vencimentos" e "Total de Descontos"
      if (
        (lower.includes('total de vencimentos') || lower.includes('total vencimentos') || lower.includes('total proventos')) &&
        (lower.includes('total de descontos') || lower.includes('total descontos'))
      ) {
        // Os valores podem estar na mesma linha ou na linha imediatamente abaixo
        const sameLineMatches = l.text.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/g);
        if (sameLineMatches && sameLineMatches.length >= 2) {
          grossAmount = parseBrazilianCurrency(sameLineMatches[0]);
          totalDeductions = parseBrazilianCurrency(sameLineMatches[1]);
        } else if (viaLines[i + 1]) {
          const nextMatches = viaLines[i + 1].text.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/g);
          if (nextMatches && nextMatches.length >= 2) {
            grossAmount = parseBrazilianCurrency(nextMatches[0]);
            totalDeductions = parseBrazilianCurrency(nextMatches[1]);
          }
        }
      }

      // Linha "Valor Líquido"
      if (lower.includes('valor líquido') || lower.includes('valor liquido') || lower.includes('líquido a receber') || lower.includes('liquido a receber')) {
        const netMatches = l.text.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
        if (netMatches) {
          netAmount = parseBrazilianCurrency(netMatches[1]);
        }
      }
    }

    // Fallbacks calculados a partir das rubricas caso os campos do rodapé não tenham sido identificados
    const sumIncomes = Math.round(
      items.filter((i) => i.type === 'income' && !i.isAdvance).reduce((acc, i) => acc + i.amount, 0) * 100
    ) / 100;

    const sumExpenses = Math.round(
      items.filter((i) => i.type === 'expense').reduce((acc, i) => acc + i.amount, 0) * 100
    ) / 100;

    if (!grossAmount) {
      grossAmount = sumIncomes;
    }
    if (!totalDeductions) {
      totalDeductions = sumExpenses + (hasAdvancePayment ? advanceAmount : 0);
    }
    if (!netAmount) {
      netAmount = Math.round(Math.max(0, grossAmount - totalDeductions) * 100) / 100;
    }

    // Datas sugeridas de recebimento
    const advanceDate = referenceMonth ? `${referenceMonth}-20` : undefined;
    const netBalanceDate = referenceMonth ? getNextMonthDate(referenceMonth, 5) : undefined;

    return {
      employerName,
      referenceMonth,
      grossAmount: Math.round(grossAmount * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
      hasAdvancePayment,
      advanceAmount: Math.round(advanceAmount * 100) / 100,
      advanceDate,
      netBalanceDate,
      items,
      rawTextPreview,
    };
  }
}
