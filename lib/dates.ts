export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayBounds(): { start: Date; end: Date } {
  const now = new Date();
  // Start = local midnight of today
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  // End = local midnight of tomorrow
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

export function getRangeBounds(range: 'today' | 'week' | 'month'): { start: string; end: string } {
  const { start, end } = getTodayBounds();
  const rangeStart = new Date(start);
  if (range === 'week') rangeStart.setDate(rangeStart.getDate() - 7);
  else if (range === 'month') rangeStart.setDate(1);
  return { start: rangeStart.toISOString(), end: end.toISOString() };
}
