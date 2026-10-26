// Logs are dated by day - times only get in the way of comparing a start and
// end date picked on the same day.
export function startOfDay(date: Date) {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}

// "1/3/2026 – 4/3/2026", or just the start for a one-day log.
export function formatDateRange(start?: Date, end?: Date) {
  if (!start)
    return ''
  if (!end || startOfDay(end).getTime() === startOfDay(start).getTime())
    return start.toLocaleDateString()
  return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`
}
