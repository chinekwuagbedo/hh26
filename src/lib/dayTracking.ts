export type WeightUnit = "lb" | "kg"
export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack"
export type FoodCategory =
  | "Protein"
  | "Carbohydrate"
  | "Fruit & vegetables"
  | "Dairy"
  | "Fats"
  | "Treat"
  | "Other"

interface StrengthExerciseLog {
  id: string
  name: string
  type?: undefined
  sets: number
  reps: number
  weight: number | null
  weightUnit: WeightUnit
}

interface CardioExerciseLog {
  id: string
  name: string
  type: "cardio"
  durationMinutes: number | null
  distanceMiles: number | null
}

export type ExerciseLog = StrengthExerciseLog | CardioExerciseLog

export interface WorkoutLog {
  id: string
  name: string
  exercises: ExerciseLog[]
}

export interface FoodLog {
  id: string
  name: string
  meal: MealType
  note: string
  category?: FoodCategory
  calories?: number | null
  proteinGrams?: number | null
  carbohydrateGrams?: number | null
  fatGrams?: number | null
  source?: "manual" | "myfitnesspal" | "edamam" | "fooddata"
  externalId?: string
}

export interface DayLog {
  period: boolean
  symptoms: string[]
  feelings: string[]
  workouts: WorkoutLog[]
  foods: FoodLog[]
}

export type DayLogs = Record<string, DayLog>

export function emptyDayLog(): DayLog {
  return {
    period: false,
    symptoms: [],
    feelings: [],
    workouts: [],
    foods: [],
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isExerciseLog(value: unknown): value is ExerciseLog {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.id !== "string" || typeof candidate.name !== "string") return false
  if (candidate.type === "cardio") {
    const isOptionalMeasurement = (key: "durationMinutes" | "distanceMiles") =>
      key in candidate &&
      (candidate[key] === null ||
        (typeof candidate[key] === "number" &&
          Number.isFinite(candidate[key]) &&
          candidate[key] >= 0))
    const hasMeasurement =
      (typeof candidate.durationMinutes === "number" &&
        candidate.durationMinutes > 0) ||
      (typeof candidate.distanceMiles === "number" &&
        candidate.distanceMiles > 0)
    return (
      isOptionalMeasurement("durationMinutes") &&
      isOptionalMeasurement("distanceMiles") &&
      hasMeasurement
    )
  }
  return (
    typeof candidate.sets === "number" &&
    typeof candidate.reps === "number" &&
    (typeof candidate.weight === "number" || candidate.weight === null) &&
    (candidate.weightUnit === "lb" || candidate.weightUnit === "kg")
  )
}

function isWorkoutLog(value: unknown): value is WorkoutLog {
  if (typeof value !== "object" || value === null) return false
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "exercises" in value &&
    Array.isArray(value.exercises) &&
    value.exercises.every(isExerciseLog)
  )
}

function isFoodLog(value: unknown): value is FoodLog {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  const isOptionalNumber = (key: string) =>
    !(key in candidate) ||
    candidate[key] === null ||
    (typeof candidate[key] === "number" && Number.isFinite(candidate[key]))
  const isOptionalCategory = () =>
    !("category" in value) ||
    [
      "Protein",
      "Carbohydrate",
      "Fruit & vegetables",
      "Dairy",
      "Fats",
      "Treat",
      "Other",
    ].includes(String(value.category))
  const isOptionalSource = () =>
    !("source" in value) ||
    value.source === "manual" ||
    value.source === "myfitnesspal" ||
    value.source === "edamam" ||
    value.source === "fooddata"
  const isOptionalExternalId = () =>
    !("externalId" in value) ||
    (typeof value.externalId === "string" && value.externalId.length > 0)

  return (
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "meal" in value &&
    ["Breakfast", "Lunch", "Dinner", "Snack"].includes(String(value.meal)) &&
    "note" in value &&
    typeof value.note === "string" &&
    isOptionalCategory() &&
    isOptionalSource() &&
    isOptionalExternalId() &&
    isOptionalNumber("calories") &&
    isOptionalNumber("proteinGrams") &&
    isOptionalNumber("carbohydrateGrams") &&
    isOptionalNumber("fatGrams")
  )
}

function isDayLog(value: unknown): value is DayLog {
  if (typeof value !== "object" || value === null) return false
  return (
    "period" in value &&
    typeof value.period === "boolean" &&
    "symptoms" in value &&
    isStringArray(value.symptoms) &&
    "feelings" in value &&
    isStringArray(value.feelings) &&
    "workouts" in value &&
    Array.isArray(value.workouts) &&
    value.workouts.every(isWorkoutLog) &&
    "foods" in value &&
    Array.isArray(value.foods) &&
    value.foods.every(isFoodLog)
  )
}

export function parseDayLogs(serialized: string | null): DayLogs {
  if (serialized === null) return {}

  const parsed: unknown = JSON.parse(serialized)
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Saved day logs have an invalid format.")
  }

  const logs: DayLogs = {}
  for (const [date, value] of Object.entries(parsed)) {
    if (!isDayLog(value)) {
      throw new Error(`Saved day log for ${date} has an invalid format.`)
    }
    logs[date] = value
  }
  return logs
}
