import { phaseFor, type Cycle, type Phase } from "./cycle"
import type { DayLogs, FoodLog } from "./dayTracking"
import { phaseInsight, type SessionMetric } from "./insights"

interface HealthMetric {
  id: string
  metricType: string
  date: string
  value: number
  unit: string
  source: string
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

function cycleStartsFromLogs(dayLogs: DayLogs): Cycle[] {
  const periodDays = Object.entries(dayLogs)
    .filter(([, log]) => log.period)
    .map(([date]) => date)
    .sort()
  return periodDays
    .filter((date, index) => index === 0 || periodDays[index - 1] !== shiftDate(date, -1))
    .map((startDate) => ({ startDate }))
}

function categoryFor(food: FoodLog): string {
  return food.category ?? "Other"
}

interface FoodPhaseBucket {
  foodCount: number
  loggedDays: Set<string>
  cycles: Set<string>
  categories: Map<string, number>
}

function foodCategoryInsight(dayLogs: DayLogs, cycles: Cycle[]): string | null {
  const buckets = new Map<Phase, FoodPhaseBucket>()
  for (const [date, day] of Object.entries(dayLogs)) {
    if (day.foods.length === 0) continue
    const phase = phaseFor(date, cycles)
    if (!phase) continue
    const cycleStart = shiftDate(date, -(phase.cycleDay - 1))
    const bucket = buckets.get(phase.phase) ?? {
      foodCount: 0,
      loggedDays: new Set<string>(),
      cycles: new Set<string>(),
      categories: new Map<string, number>(),
    }
    bucket.foodCount += day.foods.length
    bucket.loggedDays.add(date)
    bucket.cycles.add(cycleStart)
    for (const food of day.foods) {
      const category = categoryFor(food)
      bucket.categories.set(
        category,
        (bucket.categories.get(category) ?? 0) + 1,
      )
    }
    buckets.set(phase.phase, bucket)
  }

  const reliable = [...buckets.entries()].filter(
    ([, bucket]) => bucket.loggedDays.size >= 3 && bucket.cycles.size >= 2,
  )
  if (reliable.length < 2) return null

  let strongest:
    | { difference: number; category: string; high: Phase; low: Phase }
    | undefined
  for (const category of new Set(
    reliable.flatMap(([, bucket]) => [...bucket.categories.keys()]),
  )) {
    const rates = reliable.map(([phase, bucket]) => ({
      phase,
      rate: (bucket.categories.get(category) ?? 0) / bucket.foodCount,
    }))
    const high = rates.reduce((best, item) => (item.rate > best.rate ? item : best))
    const low = rates.reduce((best, item) => (item.rate < best.rate ? item : best))
    const difference = high.rate - low.rate
    if (difference >= 0.2 && (!strongest || difference > strongest.difference)) {
      strongest = { difference, category, high: high.phase, low: low.phase }
    }
  }

  if (!strongest) return null
  return `Your logged foods include a higher share of ${strongest.category.toLowerCase()} entries in the ${strongest.high} phase than the ${strongest.low} phase. This describes your logs, not a nutrition target.`
}

function dailyNutritionMetrics(
  dayLogs: DayLogs,
  healthMetrics: HealthMetric[],
  field: "proteinGrams" | "carbohydrateGrams" | "calories",
  healthType: string,
): SessionMetric[] {
  const sums = new Map<string, number>()
  const sourceByDate = new Set<string>()
  for (const [date, day] of Object.entries(dayLogs)) {
    const matchingFoods = day.foods.filter((food) => typeof food[field] === "number")
    if (!matchingFoods.length) continue
    sums.set(
      date,
      matchingFoods.reduce((sum, food) => sum + (food[field] ?? 0), 0),
    )
    sourceByDate.add(date)
  }

  for (const metric of healthMetrics) {
    if (metric.metricType !== healthType || sourceByDate.has(metric.date)) continue
    sums.set(metric.date, (sums.get(metric.date) ?? 0) + metric.value)
  }
  return [...sums]
    .filter(([, value]) => value > 0)
    .map(([date, value]) => ({ date, value }))
}

export function buildPersonalInsights(
  dayLogs: DayLogs,
  healthMetrics: HealthMetric[],
): { messages: string[]; cyclesLogged: number } {
  const cycles = cycleStartsFromLogs(dayLogs)
  if (cycles.length < 2) {
    return {
      cyclesLogged: cycles.length,
      messages: [
        "Keep logging period starts and workouts or meals. Personal patterns stay hidden until there is enough history across multiple cycles.",
      ],
    }
  }

  const messages: string[] = []
  const workouts = healthMetrics
    .filter(
      (metric) =>
        metric.metricType === "workout_duration_minutes" && metric.value > 0,
    )
    .map((metric) => ({ date: metric.date, value: metric.value }))
  const workoutInsight = phaseInsight(workouts, cycles, "workout duration")
  if (workoutInsight.enoughData) messages.push(workoutInsight.message)

  const exerciseSessions = new Map<string, SessionMetric[]>()
  for (const [date, day] of Object.entries(dayLogs)) {
    for (const workout of day.workouts) {
      for (const exercise of workout.exercises) {
        if (exercise.type === "cardio") continue
        if (
          exercise.weight === null ||
          exercise.weight <= 0 ||
          exercise.sets <= 0 ||
          exercise.reps <= 0
        ) {
          continue
        }
        const weightKg =
          exercise.weightUnit === "lb" ? exercise.weight * 0.45359237 : exercise.weight
        const metrics = exerciseSessions.get(exercise.name) ?? []
        metrics.push({
          date,
          value: weightKg * exercise.sets * exercise.reps,
        })
        exerciseSessions.set(exercise.name, metrics)
      }
    }
  }
  for (const [exerciseName, metrics] of exerciseSessions) {
    const insight = phaseInsight(metrics, cycles, `${exerciseName} training volume`)
    if (insight.enoughData) messages.push(insight.message)
    if (messages.length >= 3) break
  }

  const nutritionInputs = [
    {
      field: "proteinGrams" as const,
      metricType: "dietary_protein_grams",
      label: "logged protein",
    },
    {
      field: "carbohydrateGrams" as const,
      metricType: "dietary_carbohydrate_grams",
      label: "logged carbohydrates",
    },
    {
      field: "calories" as const,
      metricType: "dietary_energy_kcal",
      label: "logged food energy",
    },
  ]
  for (const input of nutritionInputs) {
    const metrics = dailyNutritionMetrics(
      dayLogs,
      healthMetrics,
      input.field,
      input.metricType,
    )
    const insight = phaseInsight(metrics, cycles, input.label)
    if (insight.enoughData) messages.push(insight.message)
    if (messages.length >= 3) break
  }

  if (messages.length < 3) {
    const foodInsight = foodCategoryInsight(dayLogs, cycles)
    if (foodInsight) messages.push(foodInsight)
  }
  if (messages.length === 0) {
    messages.push(
      "Your personal pattern is still taking shape. We wait for at least three logged sessions or food-days in multiple cycle phases across two cycles before comparing.",
    )
  }

  return { messages, cyclesLogged: cycles.length }
}
