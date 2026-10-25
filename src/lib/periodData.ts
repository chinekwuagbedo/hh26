import { emptyDayLog, type DayLogs } from "./dayTracking"

export function parsePeriodDates(content: string, fileName: string): string[] {
  const normalizedName = fileName.toLowerCase()
  const trimmed = content.trim()
  if (!trimmed) throw new Error("The selected period file is empty.")

  const isJson = normalizedName.endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")
  const dates = isJson ? parseJsonDates(trimmed) : parseCsvDates(trimmed)
  const uniqueDates = [...new Set(dates)].sort()
  if (uniqueDates.length === 0) {
    throw new Error("No period dates were found. Check the file format and try again.")
  }
  return uniqueDates
}

export function mergePeriodDates(current: DayLogs, dates: readonly string[]): DayLogs {
  const next = { ...current }
  for (const date of dates) {
    const day = next[date] ?? emptyDayLog()
    if (!day.period) next[date] = { ...day, period: true }
  }
  return next
}

function parseJsonDates(content: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error("The selected JSON file is not valid JSON.")
  }

  if (Array.isArray(parsed)) {
    return parsed.flatMap((entry, index) => {
      if (typeof entry === "string") return [requireValidDate(entry, `item ${index + 1}`)]
      if (isRecord(entry) && entry.period === true) {
        return [requireValidDate(String(entry.date ?? ""), `item ${index + 1}`)]
      }
      return []
    })
  }

  if (!isRecord(parsed)) {
    throw new Error("JSON must contain a periodDates array or date-keyed day logs.")
  }

  if (Array.isArray(parsed.periodDates)) {
    return parsed.periodDates.map((date, index) =>
      requireValidDate(String(date), `periodDates item ${index + 1}`),
    )
  }

  const dayLogs = isRecord(parsed.dayLogs)
    ? parsed.dayLogs
    : isRecord(parsed.logs)
      ? parsed.logs
      : parsed
  return Object.entries(dayLogs).flatMap(([date, value]) => {
    if (value === true || (isRecord(value) && value.period === true)) {
      return [requireValidDate(date, date)]
    }
    return []
  })
}

function parseCsvDates(content: string): string[] {
  const rows = parseCsvRows(content)
  const headers = rows.shift()
  if (!headers) throw new Error("The selected CSV is empty.")

  const positions = new Map(headers.map((header, index) => [normalizeHeader(header), index]))
  const periodDateIndex = findColumn(positions, "perioddate", "periodstart", "startdate", "startofperiod")
  const dateIndex = findColumn(positions, "date", "logdate")
  const statusIndex = findColumn(positions, "period", "isperiod", "periodlogged", "bleeding")
  const dateColumn = periodDateIndex ?? dateIndex

  if (dateColumn === undefined || (periodDateIndex === undefined && statusIndex === undefined)) {
    throw new Error("CSV needs a Period Date column, or Date and Period columns.")
  }

  return rows.flatMap((row, index) => {
    const value = row[dateColumn]?.trim()
    if (!value) return []
    const date = requireValidDate(value, `CSV row ${index + 2}`)
    if (periodDateIndex !== undefined) return [date]

    const status = row[statusIndex!]?.trim().toLowerCase()
    if (["true", "yes", "y", "1", "period", "logged", "start"].includes(status)) {
      return [date]
    }
    if (["", "false", "no", "n", "0", "none"].includes(status)) return []
    throw new Error(`CSV row ${index + 2} has an unknown Period value.`)
  })
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === "," && !quoted) {
      row.push(field.trim())
      field = ""
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1
      row.push(field.trim())
      if (row.some((value) => value.length > 0)) rows.push(row)
      row = []
      field = ""
    } else {
      field += character
    }
  }

  if (quoted) throw new Error("The CSV has an unclosed quoted field.")
  row.push(field.trim())
  if (row.some((value) => value.length > 0)) rows.push(row)
  return rows
}

function findColumn(positions: Map<string, number>, ...names: string[]): number | undefined {
  return names.map((name) => positions.get(name)).find((index) => index !== undefined)
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function requireValidDate(value: string, row: string): string {
  const trimmed = value.trim()
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed)
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  const date = iso
    ? `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`
    : us
      ? `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`
      : ""
  const parsed = date ? new Date(`${date}T00:00:00Z`) : null
  if (!parsed || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${row} has an invalid date. Use YYYY-MM-DD or MM/DD/YYYY.`)
  }
  return date
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
