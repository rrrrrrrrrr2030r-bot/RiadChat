export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2).replace(/\.00$/, '')}T`;
  }
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2).replace(/\.00$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return value.toLocaleString('en-US');
}

export function formatFullGold(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Math.floor(value).toLocaleString('en-US');
}

export function formatDiamonds(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export function formatBigIntLikeString(rawDigits: string): string {
  const cleaned = rawDigits.replace(/[^\d]/g, '');
  if (!cleaned) return '0';
  try {
    return BigInt(cleaned).toLocaleString('en-US');
  } catch {
    return cleaned;
  }
}

export function computeAgencyBonusBigInt(rawDigits: string): {
  baseFormatted: string;
  bonusFormatted: string;
  totalFormatted: string;
  baseNumericValue: number;
  numericValue: number;
} {
  const cleaned = rawDigits.replace(/[^\d]/g, '');
  if (!cleaned) {
    return {
      baseFormatted: '0',
      bonusFormatted: '0',
      totalFormatted: '0',
      baseNumericValue: 0,
      numericValue: 0,
    };
  }
  try {
    const base = BigInt(cleaned);
    const bonus = (base * 25n) / 100n;
    const total = base + bonus;
    const baseNumericCapped = Number(base > 9_000_000_000_000_000n ? 9_000_000_000_000_000n : base);
    const numericCapped = Number(total > 9_000_000_000_000_000n ? 9_000_000_000_000_000n : total);
    return {
      baseFormatted: base.toLocaleString('en-US'),
      bonusFormatted: bonus.toLocaleString('en-US'),
      totalFormatted: total.toLocaleString('en-US'),
      baseNumericValue: baseNumericCapped,
      numericValue: numericCapped,
    };
  } catch {
    return {
      baseFormatted: '0',
      bonusFormatted: '0',
      totalFormatted: '0',
      baseNumericValue: 0,
      numericValue: 0,
    };
  }
}
