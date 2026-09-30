export type TFn = (key: string, fallback?: string) => string;

export function fitBadgeLabel(badge: unknown, t: TFn): string {
  const raw = badge === null || badge === undefined ? '' : String(badge);
  if (!raw) return '';
  const probe = raw.toLowerCase();
  const hit =
    probe.includes('strong')     ? { emoji: '🟢', key: 'fit.label.strong',      en: 'Strong Fit' } :
    probe.includes('conditional')? { emoji: '🟡', key: 'fit.label.conditional', en: 'Conditional Fit' } :
    probe.includes('low')        ? { emoji: '🔴', key: 'fit.label.low',         en: 'Low Fit' } :
    probe.includes('integrity')  ? { emoji: '⚠️', key: 'fit.label.integrity',   en: 'Integrity Flag' } :
    probe.includes('locked')     ? { emoji: '🔒', key: 'fit.label.locked',      en: 'Locked' } :
    null;
  if (!hit) return raw;   // unrecognised value: render it unchanged (no behaviour change)
  return `${hit.emoji} ${t(hit.key, hit.en)}`;
}
