/**
 * Start of the given day in UTC (00:00:00.000).
 */
export function startOfDayUTC(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

/**
 * End of the given day in UTC (23:59:59.999).
 */
export function endOfDayUTC(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(23, 59, 59, 999);
  return out;
}

/** @deprecated Use startOfDayUTC. Kept for backward compatibility. */
export const startOfDay = startOfDayUTC;

/** @deprecated Use endOfDayUTC. Kept for backward compatibility. */
export const endOfDay = endOfDayUTC;
