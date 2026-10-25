import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { emptyDayLog, type DayLog, type DayLogs } from "./dayTracking"

export interface CycleSnapshot {
  period: boolean
  symptoms: string[]
  feelings: string[]
}

interface RemoteCycleRow extends CycleSnapshot {
  log_date: string
  updated_at: string
}

export type CycleSyncMeta = Record<string, number>

const cycleSyncMetaKey = "tideline-cycle-sync-meta"
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null

export function readCycleSyncMeta(): CycleSyncMeta {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(cycleSyncMetaKey) ?? "{}")
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
      ),
    )
  } catch {
    return {}
  }
}

export function writeCycleSyncMeta(meta: CycleSyncMeta): void {
  try {
    localStorage.setItem(cycleSyncMetaKey, JSON.stringify(meta))
  } catch {
    // Local sync timestamps are best-effort; cycle logs remain stored separately.
  }
}

export function recordCycleLogChanges(previous: DayLogs, next: DayLogs): void {
  const meta = readCycleSyncMeta()
  const dates = new Set([...Object.keys(previous), ...Object.keys(next)])
  let changed = false

  for (const date of dates) {
    const before = cycleSnapshot(previous[date])
    const after = cycleSnapshot(next[date])
    if (sameSnapshot(before, after)) continue
    meta[date] = Math.max(Date.now(), (meta[date] ?? 0) + 1)
    changed = true
  }

  if (changed) writeCycleSyncMeta(meta)
}

export function applyCycleSnapshots(
  current: DayLogs,
  snapshots: Record<string, CycleSnapshot>,
): DayLogs {
  const next = { ...current }
  let changed = false
  for (const [date, snapshot] of Object.entries(snapshots)) {
    const day = next[date] ?? emptyDayLog()
    if (
      day.period === snapshot.period &&
      [...day.symptoms].sort().join("\u0000") === snapshot.symptoms.join("\u0000") &&
      [...day.feelings].sort().join("\u0000") === snapshot.feelings.join("\u0000")
    ) continue
    next[date] = { ...day, ...snapshot }
    changed = true
  }
  return changed ? next : current
}

export async function syncCycleLogs(
  client: SupabaseClient,
  userId: string,
  localLogs: DayLogs,
  currentMeta: CycleSyncMeta,
): Promise<{ snapshots: Record<string, CycleSnapshot>; meta: CycleSyncMeta }> {
  const { data, error } = await client
    .from("cycle_logs")
    .select("log_date, period, symptoms, feelings, updated_at")
  if (error) throw error

  const remoteRows = (data ?? []) as RemoteCycleRow[]
  const remoteByDate = new Map(remoteRows.map((row) => [row.log_date, row]))
  const localByDate = new Map<string, CycleSnapshot>()

  for (const [date, day] of Object.entries(localLogs)) {
    const snapshot = cycleSnapshot(day)
    if (hasCycleData(snapshot) || date in currentMeta) localByDate.set(date, snapshot)
  }

  const snapshots: Record<string, CycleSnapshot> = {}
  const nextMeta = { ...currentMeta }
  const dates = new Set([...localByDate.keys(), ...remoteByDate.keys()])
  const uploads: Array<RemoteCycleRow & { user_id: string }> = []

  for (const date of dates) {
    const local = localByDate.get(date)
    const remote = remoteByDate.get(date)
    let merged: CycleSnapshot
    let stamp: number

    if (local && remote) {
      const localStamp = currentMeta[date] ?? 0
      const remoteStamp = Date.parse(remote.updated_at) || 0
      if (localStamp > remoteStamp) {
        merged = local
        stamp = localStamp
      } else if (localStamp === 0) {
        merged = mergeSnapshots(local, remote)
        stamp = remoteStamp
      } else {
        merged = remote
        stamp = remoteStamp
      }
    } else if (local) {
      merged = local
      stamp = currentMeta[date] || Date.now()
    } else if (remote) {
      merged = remote
      stamp = Date.parse(remote.updated_at) || Date.now()
    } else {
      continue
    }

    snapshots[date] = merged
    nextMeta[date] = stamp
    if (!remote || !sameSnapshot(merged, remote)) {
      const updatedAt = new Date(stamp || Date.now()).toISOString()
      uploads.push({
        user_id: userId,
        log_date: date,
        ...merged,
        updated_at: updatedAt,
      })
      nextMeta[date] = Date.parse(updatedAt)
    }
  }

  if (uploads.length > 0) {
    const { error: uploadError } = await client
      .from("cycle_logs")
      .upsert(uploads, { onConflict: "user_id,log_date" })
    if (uploadError) throw uploadError
  }

  return { snapshots, meta: nextMeta }
}

function cycleSnapshot(day: DayLog | undefined): CycleSnapshot {
  return {
    period: day?.period ?? false,
    symptoms: [...(day?.symptoms ?? [])].sort(),
    feelings: [...(day?.feelings ?? [])].sort(),
  }
}

function hasCycleData(snapshot: CycleSnapshot): boolean {
  return snapshot.period || snapshot.symptoms.length > 0 || snapshot.feelings.length > 0
}

function sameSnapshot(left: CycleSnapshot, right: CycleSnapshot): boolean {
  return left.period === right.period &&
    left.symptoms.join("\u0000") === right.symptoms.join("\u0000") &&
    left.feelings.join("\u0000") === right.feelings.join("\u0000")
}

function mergeSnapshots(left: CycleSnapshot, right: CycleSnapshot): CycleSnapshot {
  return {
    period: left.period || right.period,
    symptoms: [...new Set([...left.symptoms, ...right.symptoms])].sort(),
    feelings: [...new Set([...left.feelings, ...right.feelings])].sort(),
  }
}
