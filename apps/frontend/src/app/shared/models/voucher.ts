/** Buono fisico emesso da Blackjack o Cavallo: non è un punto in classifica. */
export interface BonusVoucher {
  id: number;
  code: string;
  playerName: string;
  label: string;
  delivered: boolean;
  issuedAt?: number;
  deliveredAt?: number;
}

/** Il codice si mostra sempre a quattro cifre, anche quando inizia per zero. */
export function voucherCode(code: string | number): string {
  return String(code ?? '').padStart(4, '0');
}
