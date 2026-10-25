export function money(value: number) {
  return Math.round(value).toLocaleString("en-US")
}

export function quantityLabel(kg: number) {
  if (kg >= 1000 && kg % 1000 === 0) return `${(kg / 1000).toLocaleString("en-US")} t`
  if (kg >= 1000) return `${(kg / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} t`
  return `${money(kg)} kg`
}

export function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-")
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${names[Number(month) - 1]} ${year}`
}
