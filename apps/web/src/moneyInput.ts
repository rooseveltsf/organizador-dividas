export const moneyPattern = '[0-9]+([,.][0-9]{1,2})?';

export function parseMoneyInput(value: string) {
  const text = value.trim();
  return new RegExp('^' + moneyPattern + '$').test(text) ? Number(text.replace(',', '.')) : NaN;
}
