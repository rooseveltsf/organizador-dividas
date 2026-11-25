export function toCents(amount: number): number {
  // Desloca o ponto decimal antes do arredondamento para evitar erros como 1,005 -> 1,00.
  const [digits, exponent = '0'] = String(amount).split('e');
  return Math.round(Number(digits + 'e' + (Number(exponent) + 2)));
}

export function validMoneyCents(cents: number): boolean {
  // A partir de 2^46 reais a distância entre dois Floats pode superar um centavo.
  return Number.isSafeInteger(cents) && cents > 0 && cents < 2 ** 46 * 100;
}

export function installmentCents(totalCents: number, count: number, installmentNumber: number): number {
  return Math.floor(totalCents / count) + (installmentNumber <= totalCents % count ? 1 : 0);
}
