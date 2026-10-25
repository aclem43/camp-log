// Logs are dated by day - times only get in the way of comparing a start and
// end date picked on the same day.
export function startOfDay(date: Date) {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}
