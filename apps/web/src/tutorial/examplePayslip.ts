import type { PayslipParseResult } from '@organizador/shared';

export type PayslipExample = { file: File; data: PayslipParseResult };

function makePdf(pages: string[][]) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pages.map((_, i) => 4 + i * 2 + ' 0 R').join(' ') + '] >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  pages.forEach((lines, i) => {
    const stream = lines.map((line, row) => 'BT /F1 14 Tf 42 ' + (545 - row * 30) + ' Td (' + line + ') Tj ET\n').join('');
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 450 600] /Resources << /Font << /F1 3 0 R >> >> /Contents ' +
      (5 + i * 2) + ' 0 R >>', '<< /Length ' + stream.length + ' >>\nstream\n' + stream + 'endstream');
  });
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => {
    const offset = pdf.length;
    pdf += (i + 1) + ' 0 obj\n' + object + '\nendobj\n';
    return String(offset).padStart(10, '0') + ' 00000 n \n';
  });
  const xref = pdf.length;
  pdf += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n' + offsets.join('') +
    'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return new File([pdf], 'contracheque-de-exemplo.pdf', { type: 'application/pdf' });
}

export function examplePayslip(month: string): PayslipExample {
  const date = month + '-05';
  const period = month.slice(5) + '/' + month.slice(0, 4);
  const lines = ['Empresa de Exemplo', 'Contracheque ficticio - ' + period, '001 Salario: R$ 2.500,00',
    '002 Desconto parcelado (2 de 4): R$ 150,00', 'Valor liquido: R$ 2.350,00'];
  return {
    file: makePdf([lines, ['Contracheque ficticio - ' + period, 'Anexo: desconto parcelado', 'Parcela 2 de 4: R$ 150,00']]),
    data: { employerName: 'Empresa de Exemplo', referenceMonth: month, grossAmount: 2500, totalDeductions: 150,
      netAmount: 2350, netBalanceDate: date, rawTextPreview: lines.join('\n'), items: [
        { tempId: 'salary', rawCode: '001', description: 'Salário', amount: 2500, type: 'income',
          suggestedCategory: 'fixed', suggestedDate: date, selected: true },
        { tempId: 'deduction', rawCode: '002', description: 'Desconto parcelado', amount: 150, type: 'expense',
          suggestedCategory: 'installment', suggestedDate: date, currentInstallment: 2, totalInstallments: 4, selected: true },
      ] },
  };
}
