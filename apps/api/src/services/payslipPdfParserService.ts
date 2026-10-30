import { randomUUID } from 'node:crypto';
import {
  PayslipParseResult,
  PayslipExtractedItem,
  TransactionCategory,
} from '@organizador/shared';

// Helper seguro para carregar pdfjs-dist em CommonJS
async function getPdfjs(): Promise<any> {
  const dynamicImport = new Function('specifier', 'return import(specifier)');
  return dynamicImport('pdfjs-dist/legacy/build/pdf.mjs');
}

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

const INCOME_KEYWORDS = [
  'salario',
  'salário',
  'base',
  'provento',
  'vencimento',
  'hora extra',
  'horas extras',
  'adicional',
  'noturno',
  'insalubridade',
  'periculosidade',
  'gratificacao',
  'gratificação',
  'comissao',
  'comissão',
  '13',
  'decimo terceiro',
  'décimo terceiro',
  'ferias',
  'férias',
  'dsr',
  'premio',
  'prêmio',
  'abono',
  'diaria',
  'diária',
  'bonificacao',
  'bonificação',
  'produtividade',
  'anuênio',
  'anuenio',
  'triênio',
  'trienio',
  'quinquênio',
  'quinquenio',
  'ajuda de custo',
  'auxilio',
  'auxílio',
];

const EXPENSE_KEYWORDS = [
  'inss',
  'irrf',
  'imposto de renda',
  'previdencia',
  'previdência',
  'vale transporte',
  'vt',
  'vale refeicao',
  'vale alimentação',
  'vale alimentacao',
  'vale refeição',
  'vr',
  'va',
  'plano de saude',
  'plano de saúde',
  'odonto',
  'odontologico',
  'odontológico',
  'unimed',
  'bradesco saude',
  'sulamerica',
  'amil',
  'coparticipacao',
  'coparticipação',
  'sindicato',
  'sindical',
  'contribuicao',
  'contribuição',
  'mensalidade',
  'falta',
  'faltas',
  'atraso',
  'atrasos',
  'consignado',
  'consignacao',
  'consignação',
  'emprestimo',
  'empréstimo',
  'pensao',
  'pensão',
  'adiantamento',
  'farmacia',
  'farmácia',
  'seguro de vida',
  'desconto',
];

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

export class PayslipPdfParserService {
  /**
   * Processa o buffer binário de um arquivo PDF de contracheque
   * e extrai de forma estruturada as fontes de renda, deduções e totais.
   */
  public static async parse(pdfBuffer: Buffer): Promise<PayslipParseResult> {
    const pdfjs = await getPdfjs();

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    });

    const doc = await loadingTask.promise;
    const allLines: ParsedLine[] = [];

    // 1. Extração espacial dos fragmentos de texto por página
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();

      const fragments: TextFragment[] = [];

      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          const trimmed = item.str.trim();
          if (!trimmed) continue;

          fragments.push({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height,
          });
        }
      }

      // 2. Reconstrução de Linhas Tabulares (Tolerância Y de 3 pontos)
      // Agrupa fragmentos horizontais próximos e ordena cada linha por X crescente
      fragments.sort((a, b) => b.y - a.y); // Do topo para a base da página

      const pageLines: ParsedLine[] = [];

      for (const frag of fragments) {
        let line = pageLines.find((l) => Math.abs(l.y - frag.y) <= 3);
        if (!line) {
          line = {
            y: frag.y,
            fragments: [],
            text: '',
          };
          pageLines.push(line);
        }
        line.fragments.push(frag);
      }

      // Ordena fragmentos da esquerda para a direita (coordenada X)
      for (const line of pageLines) {
        line.fragments.sort((a, b) => a.x - b.x);
        line.text = line.fragments.map((f) => f.text.trim()).join(' ');
      }

      // Ordena as linhas do topo para o rodapé
      pageLines.sort((a, b) => b.y - a.y);
      allLines.push(...pageLines);
    }

    const rawTextPreview = allLines.map((l) => l.text).join('\n');

    // 3. Detecção de Coordenadas X das Colunas de Vencimentos e Descontos
    let proventosHeaderX: number | null = null;
    let descontosHeaderX: number | null = null;

    for (const line of allLines) {
      for (const frag of line.fragments) {
        const lower = frag.text.toLowerCase();
        if (
          lower.includes('vencimento') ||
          lower.includes('provento') ||
          lower.includes('crédito') ||
          lower.includes('credito')
        ) {
          proventosHeaderX = frag.x;
        } else if (
          lower.includes('desconto') ||
          lower.includes('débito') ||
          lower.includes('debito') ||
          lower.includes('dedução') ||
          lower.includes('deducao')
        ) {
          descontosHeaderX = frag.x;
        }
      }
      if (proventosHeaderX !== null && descontosHeaderX !== null) {
        break;
      }
    }

    // Ponto médio divisor caso as duas colunas tenham sido localizadas
    const columnSplitX =
      proventosHeaderX !== null && descontosHeaderX !== null
        ? (proventosHeaderX + descontosHeaderX) / 2
        : null;

    // 4. Detecção de Empregador e Mês de Referência (Competência)
    let employerName: string | undefined;
    let referenceMonth: string | undefined;

    // Busca Mês de Referência (YYYY-MM)
    const monthRegexPattern =
      /(?:compet[eê]ncia|m[eê]s(?:\/ano)?|per[ií]odo|ref(?:\.|er[eê]ncia)?)\s*[:=]?\s*(\d{1,2})[\/\-](\d{4})/i;
    const monthNamePattern =
      /(?:compet[eê]ncia|m[eê]s(?:\/ano)?|per[ií]odo|ref(?:\.|er[eê]ncia)?)\s*[:=]?\s*([a-zç]+)[\/\s]+(?:de\s+)?(\d{4})/i;
    const genericMonthYearPattern = /\b(0[1-9]|1[0-2])[\/\-](20\d{2})\b/;

    for (const line of allLines.slice(0, 20)) {
      const matchComp = line.text.match(monthRegexPattern);
      if (matchComp) {
        const m = matchComp[1].padStart(2, '0');
        const y = matchComp[2];
        referenceMonth = `${y}-${m}`;
        break;
      }

      const matchName = line.text.match(monthNamePattern);
      if (matchName) {
        const monthKey = matchName[1].toLowerCase();
        if (MONTH_NAMES[monthKey]) {
          referenceMonth = `${matchName[2]}-${MONTH_NAMES[monthKey]}`;
          break;
        }
      }

      const matchGeneric = line.text.match(genericMonthYearPattern);
      if (matchGeneric && !referenceMonth) {
        referenceMonth = `${matchGeneric[2]}-${matchGeneric[1]}`;
      }
    }

    // Busca Nome da Empresa/Empregador no topo do documento
    const employerLabelPattern = /(?:empresa|empregador|raz[aã]o\s+social)\s*[:=]?\s*(.+)/i;
    for (const line of allLines.slice(0, 10)) {
      const matchEmp = line.text.match(employerLabelPattern);
      if (matchEmp) {
        employerName = matchEmp[1].trim();
        break;
      }
    }

    if (!employerName && allLines.length > 0) {
      // Tenta usar a primeira ou segunda linha não vazia que contenha características de razão social
      for (const line of allLines.slice(0, 4)) {
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
    }

    // 5. Extração de Itens da Tabela (Rubricas)
    const items: PayslipExtractedItem[] = [];
    const CURRENCY_REGEX = /\b(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\b/g;
    const INSTALLMENT_REGEX = /(?:parc(?:ela)?\.?|prest(?:a[cç][aã]o)?\.?)?\s*(\d{1,3})\s*[\/|\\]\s*(\d{1,3})/i;

    // Linhas que não são rubricas (cabeçalhos, rodapés de totais, dados cadastrais)
    const isIgnoreLine = (text: string): boolean => {
      const lower = text.toLowerCase();
      if (
        lower.includes('código') ||
        lower.includes('codigo') ||
        lower.includes('descrição') ||
        lower.includes('referência') ||
        lower.includes('total de vencimentos') ||
        lower.includes('total vencimentos') ||
        lower.includes('total de proventos') ||
        lower.includes('total proventos') ||
        lower.includes('total descontos') ||
        lower.includes('total de descontos') ||
        lower.includes('valor líquido') ||
        lower.includes('liquido a receber') ||
        lower.includes('líquido a receber') ||
        lower.includes('salário base') && lower.includes('sal. contr.') || // rodapés de bases de cálculo
        lower.includes('base cálculo') ||
        lower.includes('base calculo') ||
        lower.includes('fgts do mês') ||
        lower.includes('fgts do mes')
      ) {
        return true;
      }
      return false;
    };

    for (const line of allLines) {
      if (isIgnoreLine(line.text)) continue;

      // Localiza fragmentos que contêm valores monetários
      const monetaryFragments: { frag: TextFragment; value: number; raw: string }[] = [];

      for (const frag of line.fragments) {
        const matches = frag.text.match(CURRENCY_REGEX);
        if (matches) {
          for (const rawVal of matches) {
            const val = parseBrazilianCurrency(rawVal);
            if (val > 0) {
              monetaryFragments.push({ frag, value: val, raw: rawVal });
            }
          }
        }
      }

      if (monetaryFragments.length === 0) continue;

      // Extrai código da rubrica se presente (ex: primeiro fragmento numérico com 3 a 5 dígitos)
      let rawCode: string | undefined;
      const firstFrag = line.fragments[0];
      if (firstFrag && /^\d{1,5}$/.test(firstFrag.text.trim())) {
        rawCode = firstFrag.text.trim();
      }

      // Identifica fragmentos que compõem a descrição da rubrica
      const nonMonetaryFragments = line.fragments.filter((f) => {
        if (rawCode && f.text.trim() === rawCode) return false;
        return !f.text.match(CURRENCY_REGEX);
      });

      let description = nonMonetaryFragments
        .map((f) => f.text.trim())
        .filter((t) => t.length > 0)
        .join(' ')
        .trim();

      if (!description) {
        description = `Rubrica ${rawCode || 'Diversa'}`;
      }

      // Detecção de Parcelamento (Empréstimo Consignado)
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

      // Para cada valor monetário encontrado na linha, determina se é Provento ou Desconto
      for (const { frag, value } of monetaryFragments) {
        let type: 'income' | 'expense' = 'income';

        // Análise semântica por palavras-chave
        const lowerDesc = description.toLowerCase();
        const hasIncomeKeyword = INCOME_KEYWORDS.some((kw) => lowerDesc.includes(kw));
        const hasExpenseKeyword = EXPENSE_KEYWORDS.some((kw) => lowerDesc.includes(kw));

        if (hasExpenseKeyword && !hasIncomeKeyword) {
          type = 'expense';
        } else if (hasIncomeKeyword && !hasExpenseKeyword) {
          type = 'income';
        } else if (columnSplitX !== null) {
          // Classificação espacial pela coordenada X da coluna
          type = frag.x < columnSplitX ? 'income' : 'expense';
        } else if (descontosHeaderX !== null && Math.abs(frag.x - descontosHeaderX) < 60) {
          type = 'expense';
        } else if (proventosHeaderX !== null && Math.abs(frag.x - proventosHeaderX) < 60) {
          type = 'income';
        } else {
          // Fallback padrão se não houver indicadores claros
          type = hasExpenseKeyword ? 'expense' : 'income';
        }

        items.push({
          tempId: randomUUID(),
          rawCode,
          description,
          amount: Math.round(value * 100) / 100,
          type,
          suggestedCategory,
          currentInstallment,
          totalInstallments,
          selected: true,
        });
      }
    }

    // 6. Extração e Validação dos Totais (Rodapé)
    let grossAmount = 0;
    let totalDeductions = 0;
    let netAmount = 0;

    const GROSS_REGEX =
      /(?:total\s+(?:de\s+)?(?:vencimentos?|proventos?)|sal[aá]rio\s+bruto|bruto)\s*[:=]?\s*(?:r\$\s*)?([\d.,]+)/i;
    const DEDUCTIONS_REGEX =
      /(?:total\s+(?:de\s+)?descontos?|dedu[cç][oõ]es)\s*[:=]?\s*(?:r\$\s*)?([\d.,]+)/i;
    const NET_REGEX =
      /(?:l[ií]quido(?:\s+a\s+receber)?|valor\s+l[ií]quido|total\s+l[ií]quido)\s*[:=]?\s*(?:r\$\s*)?([\d.,]+)/i;

    for (const line of allLines) {
      if (!grossAmount) {
        const m = line.text.match(GROSS_REGEX);
        if (m) grossAmount = parseBrazilianCurrency(m[1]);
      }
      if (!totalDeductions) {
        const m = line.text.match(DEDUCTIONS_REGEX);
        if (m) totalDeductions = parseBrazilianCurrency(m[1]);
      }
      if (!netAmount) {
        const m = line.text.match(NET_REGEX);
        if (m) netAmount = parseBrazilianCurrency(m[1]);
      }
    }

    // Cálculo das somas a partir das rubricas extraídas para validação e fallback
    const sumIncomes = Math.round(
      items.filter((i) => i.type === 'income').reduce((acc, i) => acc + i.amount, 0) * 100
    ) / 100;

    const sumExpenses = Math.round(
      items.filter((i) => i.type === 'expense').reduce((acc, i) => acc + i.amount, 0) * 100
    ) / 100;

    // Se os campos do rodapé não foram identificados pelos rótulos, adota os valores calculados
    if (!grossAmount && sumIncomes > 0) {
      grossAmount = sumIncomes;
    }
    if (!totalDeductions && sumExpenses > 0) {
      totalDeductions = sumExpenses;
    }
    if (!netAmount) {
      netAmount = Math.round(Math.max(0, grossAmount - totalDeductions) * 100) / 100;
    }

    return {
      employerName,
      referenceMonth,
      grossAmount: Math.round(grossAmount * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
      items,
      rawTextPreview,
    };
  }
}

