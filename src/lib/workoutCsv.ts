import type { DayLogs, ExerciseLog, WorkoutLog, WeightUnit } from "./dayTracking"
import { parseCsvRows } from "./myFitnessPalCsv"

export interface ImportedWorkout {
  date: string
  workout: WorkoutLog
}

interface WorkoutGroup {
  date: string
  name: string
  key: string
  exercises: ExerciseLog[]
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function parseDate(value: string): string | null {
  const text = value.trim()
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text)
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text)
  let date: string
  if (iso) {
    date = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`
  } else if (us) {
    const year = Number(us[3]) < 100 ? 2000 + Number(us[3]) : Number(us[3])
    date = `${year}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`
  } else {
    return null
  }

  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date
    ? date
    : null
}

function parseNumber(
  value: string | undefined,
  field: string,
  rowNumber: number,
): number | null {
  if (!value?.trim()) return null
  const number = Number(value.replace(/,/g, "").trim())
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`CSV row ${rowNumber} has an invalid ${field} value.`)
  }
  return number
}

function stableId(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function parseWorkoutCsv(csv: string): ImportedWorkout[] {
  const rows = parseCsvRows(csv)
  const headers = rows.shift()
  if (!headers) throw new Error("The selected CSV is empty.")

  const positions = new Map(
    headers.map((header, index) => [normalizeHeader(header), index]),
  )
  const findColumn = (...names: string[]) =>
    names.map((name) => positions.get(name)).find((index) => index !== undefined)
  const dateIndex = findColumn("date", "workoutdate", "logdate")
  const exerciseIndex = findColumn("exercise", "exercisename", "activity")
  if (dateIndex === undefined || exerciseIndex === undefined) {
    throw new Error("CSV needs Date and Exercise columns.")
  }

  const workoutIndex = findColumn("workout", "workoutname", "session", "sessionname")
  const typeIndex = findColumn("type", "exercisetype", "activitytype")
  const setsIndex = findColumn("sets")
  const repsIndex = findColumn("reps", "repetitions")
  const weightIndex = findColumn("weight")
  const unitIndex = findColumn("unit", "weightunit")
  const durationIndex = findColumn("minutes", "duration", "durationminutes")
  const distanceIndex = findColumn("miles", "distance", "distancemiles")
  const groups = new Map<string, WorkoutGroup>()

  for (const [index, row] of rows.entries()) {
    const exerciseName = row[exerciseIndex]?.trim()
    if (!exerciseName) continue
    const rowNumber = index + 2
    const date = parseDate(row[dateIndex] ?? "")
    if (!date) throw new Error(`CSV row ${rowNumber} has an invalid Date value.`)

    const workoutName = row[workoutIndex ?? -1]?.trim() || "Workout session"
    const groupKey = JSON.stringify([date, workoutName.toLowerCase()])
    let group = groups.get(groupKey)
    if (!group) {
      group = { date, name: workoutName, key: groupKey, exercises: [] }
      groups.set(groupKey, group)
    }

    const duration = parseNumber(
      durationIndex === undefined ? undefined : row[durationIndex],
      "Minutes",
      rowNumber,
    )
    const distance = parseNumber(
      distanceIndex === undefined ? undefined : row[distanceIndex],
      "Miles",
      rowNumber,
    )
    const rawType = row[typeIndex ?? -1]?.trim().toLowerCase()
    const isCardio = rawType
      ? rawType === "cardio"
      : duration !== null || distance !== null

    if (rawType && !["cardio", "strength", "lifting", "weightlifting", "weights"].includes(rawType)) {
      throw new Error(`CSV row ${rowNumber} has an unsupported Type value.`)
    }

    const exerciseId = `import-exercise-${stableId(`${group.key}|${group.exercises.length}`)}`
    if (isCardio) {
      const hasMeasurement =
        (duration !== null && duration > 0) ||
        (distance !== null && distance > 0)
      if (
        (duration !== null && (!Number.isInteger(duration) || duration < 1)) ||
        (distance !== null && distance < 0) ||
        !hasMeasurement
      ) {
        throw new Error(`CSV row ${rowNumber} needs a positive cardio duration or distance.`)
      }
      group.exercises.push({
        id: exerciseId,
        name: exerciseName,
        type: "cardio",
        durationMinutes: duration,
        distanceMiles: distance,
      })
      continue
    }

    const sets = parseNumber(
      setsIndex === undefined ? undefined : row[setsIndex],
      "Sets",
      rowNumber,
    )
    const reps = parseNumber(
      repsIndex === undefined ? undefined : row[repsIndex],
      "Reps",
      rowNumber,
    )
    const weight = parseNumber(
      weightIndex === undefined ? undefined : row[weightIndex],
      "Weight",
      rowNumber,
    )
    if (!sets || !Number.isInteger(sets) || !reps || !Number.isInteger(reps)) {
      throw new Error(`CSV row ${rowNumber} needs positive integer Sets and Reps values.`)
    }
    const rawUnit = row[unitIndex ?? -1]?.trim().toLowerCase() || "lb"
    const weightUnit: WeightUnit =
      rawUnit === "kg" || rawUnit === "kgs"
        ? "kg"
        : rawUnit === "lb" || rawUnit === "lbs"
          ? "lb"
          : (() => { throw new Error(`CSV row ${rowNumber} has an invalid Unit value.`) })()

    group.exercises.push({
      id: exerciseId,
      name: exerciseName,
      sets,
      reps,
      weight,
      weightUnit,
    })
  }

  const imported = [...groups.values()].map(({ date, name, key, exercises }) => ({
    date,
    workout: {
      id: `import-workout-${stableId(key)}`,
      name,
      exercises,
    },
  }))
  if (imported.length === 0) throw new Error("No dated workout rows were found in this CSV.")
  return imported
}

export function mergeImportedWorkouts(
  current: DayLogs,
  imported: readonly ImportedWorkout[],
): DayLogs {
  const next = { ...current }
  for (const { date, workout } of imported) {
    const day = next[date] ?? {
      period: false,
      symptoms: [],
      feelings: [],
      workouts: [],
      foods: [],
    }
    if (!day.workouts.some((existing) => existing.id === workout.id)) {
      next[date] = { ...day, workouts: [...day.workouts, workout] }
    }
  }
  return next
}