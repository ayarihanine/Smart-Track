export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function getTodayBounds(): { start: Date; end: Date } {
  const today = getTodayDateString();
  const start = new Date(`${today}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function getRangeBounds(range: 'today' | 'week' | 'month'): { start: string; end: string } {
  const { start, end } = getTodayBounds();
  const rangeStart = new Date(start);
  if (range === 'week') rangeStart.setUTCDate(rangeStart.getUTCDate() - 7);
  else if (range === 'month') rangeStart.setUTCDate(1);
  return { start: rangeStart.toISOString(), end: end.toISOString() };
}
