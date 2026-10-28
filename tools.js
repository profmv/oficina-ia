/** Summary: Pure, bounded learning calculators; estimates are not observed outcomes. */
export function unitEconomics({ attempts, accepted, cash, humanMinutes, hourlyValue }) {
  const values = [attempts, accepted, cash, humanMinutes, hourlyValue].map(Number);
  if (values.some(v => !Number.isFinite(v) || v < 0)) throw new Error('Use valores numericos finitos e nao negativos.');
  if (!Number.isInteger(values[0]) || !Number.isInteger(values[1]) || values[1] > values[0]) throw new Error('Aceites e tentativas devem ser inteiros; aceites nao podem superar tentativas.');
  const [trials, successes, money, minutes, rate] = values;
  const valuedTime = minutes / 60 * rate;
  return { attempts: trials, accepted: successes, cash: money, valuedTime, total: money + valuedTime, perAccepted: successes ? (money + valuedTime) / successes : null, acceptanceRate: trials ? successes / trials : null };
}
export function confusionMetrics({ tp, fp, fn, tn }) {
  const values = [tp, fp, fn, tn].map(Number);
  if (values.some(v => !Number.isSafeInteger(v) || v < 0)) throw new Error('Os quatro valores precisam ser inteiros nao negativos.');
  const [truePositive, falsePositive, falseNegative, trueNegative] = values;
  const total = values.reduce((a, b) => a + b, 0);
  return { total, precision: truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : null, recall: truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : null, accuracy: total ? (truePositive + trueNegative) / total : null };
}
export function formatDuration(minutes) {
  const n = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(n / 60), rest = Math.round(n % 60);
  return hours ? `${hours}h${rest ? ` ${rest}min` : ''}` : `${rest}min`;
}
