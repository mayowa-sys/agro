export function koboToNaira(kobo: bigint | number | string): number {
  return Number(kobo) / 100;
}
export function formatNaira(
  kobo: bigint | number | string,
  opts: { compact?: boolean; showSign?: boolean } = {}
): string {
  const naira = koboToNaira(kobo);
  const abs = Math.abs(naira);
  const sign = naira < 0 ? '−' : opts.showSign && naira > 0 ? '+' : '';
  if (opts.compact) {
    if (abs >= 1_000_000) return `${sign}₦${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}₦${(abs / 1_000).toFixed(0)}k`;
    return `${sign}₦${abs.toFixed(0)}`;
  }
  return `${sign}₦${abs.toLocaleString('en-NG')}`;
}

export function formatPhone(phone: string): string {
  if (phone.startsWith('+234'))
    return phone.replace(/(\+234)(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
  if (phone.startsWith('0'))
    return phone.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
  return phone;
}

export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 0 && diff <= 7) return `in ${diff} days`;
  if (diff < 0 && diff >= -7) return `${Math.abs(diff)} days ago`;
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function nairaToKobo(naira: number): bigint {
  return BigInt(Math.round(naira * 100));
}
