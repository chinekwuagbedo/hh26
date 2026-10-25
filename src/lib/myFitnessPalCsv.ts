import type { DayLogs, FoodCategory, FoodLog, MealType } from "./dayTracking"

export interface ImportedFood {
  date: string
  food: FoodLog
}

export function parseCsvRows(csv: string): string[][] {
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

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function parseDate(value: string): string | null {
  const text = value.trim()
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text)
  if (iso) {
    return validateDate(
      `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`,
    )
  }

  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text)
  if (us) {
    const year = Number(us[3]) < 100 ? 2000 + Number(us[3]) : Number(us[3])
    return validateDate(
      `${year}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`,
    )
  }
  return null
}

function validateDate(value: string): string | null {
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : value
}

function parseNumber(
  value: string | undefined,
  field: string,
  rowNumber: number,
): number | null {
  if (!value?.trim()) return null
  const normalized = value.replace(/,/g, "").trim()
  const number = Number(normalized)
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`CSV row ${rowNumber} has an invalid ${field} value.`)
  }
  return number
}

export function inferFoodCategory(name: string): FoodCategory {
  const food = name.toLowerCase()
  if (/chicken|turkey|beef|pork|fish|salmon|tuna|egg|tofu|tempeh|bean|lentil|protein/.test(food)) {
    return "Protein"
  }
  if (/rice|bread|pasta|oat|cereal|potato|tortilla|quinoa|noodle/.test(food)) {
    return "Carbohydrate"
  }
  if (/fruit|apple|banana|berry|orange|vegetable|broccoli|spinach|salad|carrot/.test(food)) {
    return "Fruit & vegetables"
  }
  if (/milk|yogurt|cheese|dairy|kefir/.test(food)) return "Dairy"
  if (/oil|avocado|nut|almond|peanut butter|butter|seed/.test(food)) return "Fats"
  if (/cake|cookie|candy|chocolate|ice cream|dessert|chips|crisp/.test(food)) {
    return "Treat"
  }
  return "Other"
}

function normalizeMeal(value: string | undefined): MealType {
  const meal = value?.trim().toLowerCase()
  if (meal === "breakfast") return "Breakfast"
  if (meal === "lunch") return "Lunch"
  if (meal === "dinner") return "Dinner"
  return "Snack"
}

function stableId(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function parseMyFitnessPalCsv(csv: string): ImportedFood[] {
  const rows = parseCsvRows(csv)
  const headers = rows.shift()
  if (!headers) throw new Error("The selected CSV is empty.")

  const positions = new Map(
    headers.map((header, index) => [normalizeHeader(header), index]),
  )
  const findColumn = (...names: string[]) =>
    names.map((name) => positions.get(name)).find((index) => index !== undefined)
  const dateIndex = findColumn("date", "logdate")
  const foodIndex = findColumn("food", "foodname", "description", "item")
  if (dateIndex === undefined || foodIndex === undefined) {
    throw new Error(
      "CSV needs Date and Food columns. Export the food diary from MyFitnessPal and try again.",
    )
  }

  const mealIndex = findColumn("meal", "mealtype")
  const caloriesIndex = findColumn("calories", "energy")
  const carbohydrateIndex = findColumn("carbohydrates", "carbs", "carbohydrate")
  const proteinIndex = findColumn("protein", "proteing")
  const fatIndex = findColumn("fat", "fatg", "totalfat")
  const occurrences = new Map<string, number>()
  const imported: ImportedFood[] = []

  for (const [index, row] of rows.entries()) {
    const name = row[foodIndex]?.trim()
    const date = parseDate(row[dateIndex] ?? "")
    if (!name) continue
    if (!date) throw new Error(`CSV row ${index + 2} has an invalid Date value.`)

    const meal = normalizeMeal(mealIndex === undefined ? undefined : row[mealIndex])
    const calories = parseNumber(
      caloriesIndex === undefined ? undefined : row[caloriesIndex],
      "Calories",
      index + 2,
    )
    const carbohydrateGrams = parseNumber(
      carbohydrateIndex === undefined ? undefined : row[carbohydrateIndex],
      "Carbohydrates",
      index + 2,
    )
    const proteinGrams = parseNumber(
      proteinIndex === undefined ? undefined : row[proteinIndex],
      "Protein",
      index + 2,
    )
    const fatGrams = parseNumber(
      fatIndex === undefined ? undefined : row[fatIndex],
      "Fat",
      index + 2,
    )
    const key = [
      date,
      meal,
      name.toLowerCase(),
      calories,
      carbohydrateGrams,
      proteinGrams,
      fatGrams,
    ].join("|")
    const occurrence = occurrences.get(key) ?? 0
    occurrences.set(key, occurrence + 1)

    imported.push({
      date,
      food: {
        id: `mfp-${stableId(`${key}|${occurrence}`)}`,
        name,
        meal,
        note: "Imported from MyFitnessPal",
        category: inferFoodCategory(name),
        calories,
        proteinGrams,
        carbohydrateGrams,
        fatGrams,
        source: "myfitnesspal",
      },
    })
  }

  if (imported.length === 0) {
    throw new Error("No dated food rows were found in this CSV.")
  }
  return imported
}

export function mergeImportedFoods(
  current: DayLogs,
  imported: readonly ImportedFood[],
): DayLogs {
  const next = { ...current }
  for (const { date, food } of imported) {
    const day = next[date] ?? {
      period: false,
      symptoms: [],
      feelings: [],
      workouts: [],
      foods: [],
    }
    if (!day.foods.some((existing) => existing.id === food.id)) {
      next[date] = { ...day, foods: [...day.foods, food] }
    }
  }
  return next
}
