/**
 * Benchmark aggregation (TV1). The collector produces samples (TV5); this module
 * turns them into the numbers a report row may show.
 *
 * It returns the candidate statistics instead of choosing one: which statistic
 * a benchmark declares is a protocol decision that is still open
 * (`docs/01-requirements/mvp-acceptance.md` §2), so nothing here bakes in a
 * preference.
 */

export interface ValueSummary {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly median: number;
  readonly p95: number;
}

/** Nearest-rank percentile over an ascending array: index `ceil(p * n) - 1`. */
function percentile(sorted: readonly number[], p: number): number {
  const index = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)]!;
}

/**
 * Summarises one measured value across samples.
 *
 * `null` for an empty input — a run with no samples has no statistic, and
 * writing `0` would be the same lie INV-1 forbids for GPU timing.
 * Non-finite values throw: a sample is a measurement, not a placeholder.
 */
export function summarize(values: readonly number[]): ValueSummary | null {
  for (const value of values) {
    if (!Number.isFinite(value)) {
      throw new TypeError('summarize: every value must be a finite number');
    }
  }
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;

  return {
    count: sorted.length,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    median,
    p95: percentile(sorted, 0.95),
  };
}
