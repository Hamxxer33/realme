const DAY = 24 * 60 * 60 * 1000;

/** Parses a YYYY-MM-DD string as a local calendar date (no timezone shift). */
export function parseDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(y, mo, d);
  return date.getFullYear() === y && date.getMonth() === mo && date.getDate() === d ? date : null;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);

/** Anniversary-on-Feb-29 falls back to Feb 28 in non-leap years. */
function anniversaryIn(year: number, start: Date) {
  const d = new Date(year, start.getMonth(), start.getDate());
  return d.getMonth() === start.getMonth() ? d : new Date(year, start.getMonth() + 1, 0);
}

export function relationshipStats(anniversary: string, today = new Date()) {
  const start = parseDate(anniversary);
  if (!start || start > today) return null;
  let next = anniversaryIn(today.getFullYear(), start);
  if (startOfDay(next) < startOfDay(today)) next = anniversaryIn(today.getFullYear() + 1, start);
  return {
    daysTogether: daysBetween(start, today),
    daysUntilAnniversary: daysBetween(today, next),
    years: next.getFullYear() - start.getFullYear(),
  };
}
