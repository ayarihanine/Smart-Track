export function getShiftRange(shiftStart: string, shiftEnd: string) {
  const now = new Date()
  const [startH, startM] = shiftStart.split(':').map(Number)
  const [endH, endM] = shiftEnd.split(':').map(Number)

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const shiftStartMinutes = startH * 60 + startM
  const shiftEndMinutes = endH * 60 + endM

  let startDate = new Date(now)
  if (currentMinutes < shiftStartMinutes) {
    startDate.setDate(startDate.getDate() - 1)
  }
  startDate.setHours(startH, startM, 0, 0)

  const endDate = new Date(startDate)
  endDate.setHours(endH, endM, 0, 0)

  return { start: startDate.toISOString(), end: endDate.toISOString() }
}
