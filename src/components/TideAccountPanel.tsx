import { useEffect, useRef, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import type { DayLogs } from "../lib/dayTracking"
import {
  applyCycleSnapshots,
  readCycleSyncMeta,
  supabase,
  syncCycleLogs,
  writeCycleSyncMeta,
  type CycleSyncMeta,
} from "../lib/tideCloud"

interface LocalProfile {
  name: string
  id: string
}

interface TideAccountPanelProps {
  profile: LocalProfile
  dayLogs: DayLogs
  onApplyRemote: (dayLogs: DayLogs, meta: CycleSyncMeta) => void
  onLinked: (profile: LocalProfile) => void
}

const pendingTideIdKey = "tideline-pending-tide-id"
const pendingNameKey = "tideline-pending-profile-name"

export function TideAccountPanel({
  profile,
  dayLogs,
  onApplyRemote,
  onLinked,
}: TideAccountPanelProps) {
  const [tideId, setTideId] = useState(profile.id)
  const [email, setEmail] = useState("")
  const [session, setSession] = useState<Session | null>(null)
  const [connectedUserId, setConnectedUserId] = useState("")
  const [connectedTideId, setConnectedTideId] = useState("")
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const latestLogs = useRef(dayLogs)
  const latestName = useRef(profile.name)
  const onApplyRemoteRef = useRef(onApplyRemote)
  const onLinkedRef = useRef(onLinked)
  const activeUserId = useRef("")

  useEffect(() => {
    latestLogs.current = dayLogs
    latestName.current = profile.name
    onApplyRemoteRef.current = onApplyRemote
    onLinkedRef.current = onLinked
  }, [dayLogs, onApplyRemote, onLinked, profile.name])

  useEffect(() => {
    const client = supabase
    if (!client) return
    let mounted = true

    const connectSession = async (nextSession: Session | null) => {
      if (!nextSession) {
        activeUserId.current = ""
        if (mounted) {
          setSession(null)
          setConnectedUserId("")
          setConnectedTideId("")
        }
        return
      }
      if (activeUserId.current === nextSession.user.id) return
      activeUserId.current = nextSession.user.id
      if (mounted) setSession(nextSession)

      try {
        const pendingTideId = localStorage.getItem(pendingTideIdKey)?.trim().toUpperCase()
        if (pendingTideId) {
          const pendingName = localStorage.getItem(pendingNameKey) ?? latestName.current
          const { error: claimError } = await client.rpc("claim_tide_profile", {
            requested_tide_id: pendingTideId,
            requested_display_name: pendingName,
          })
          if (claimError) throw claimError
        }

        const { data: savedProfile, error: profileError } = await client
          .from("tide_profiles")
          .select("tide_id, display_name")
          .eq("user_id", nextSession.user.id)
          .maybeSingle()
        if (profileError) throw profileError
        if (!savedProfile) {
          throw new Error("This email is not linked to a Tide ID yet. Enter your ID and request a new email link.")
        }
        if (pendingTideId && savedProfile.tide_id !== pendingTideId) {
          throw new Error("This email is linked to a different Tide ID.")
        }

        const synced = await syncCycleLogs(
          client,
          nextSession.user.id,
          latestLogs.current,
          readCycleSyncMeta(),
        )
        onApplyRemoteRef.current(applyCycleSnapshots(latestLogs.current, synced.snapshots), synced.meta)
        onLinkedRef.current({
          id: savedProfile.tide_id,
          name: savedProfile.display_name || latestName.current,
        })
        writeCycleSyncMeta(synced.meta)
        localStorage.removeItem(pendingTideIdKey)
        localStorage.removeItem(pendingNameKey)
        if (mounted) {
          setConnectedTideId(savedProfile.tide_id)
          setConnectedUserId(nextSession.user.id)
          setStatus("Period data is synced securely.")
          setError("")
        }
      } catch (connectError) {
        activeUserId.current = ""
        if (mounted) {
          setConnectedUserId("")
          setError(connectError instanceof Error ? connectError.message : "Could not connect this Tide ID.")
        }
      }
    }

    const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      window.setTimeout(() => void connectSession(nextSession), 0)
    })
    void client.auth.getSession().then(({ data }) => connectSession(data.session))

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client || !session || !connectedUserId || connectedUserId !== session.user.id) return
    const timeout = window.setTimeout(() => {
      setStatus("Syncing period data…")
      void syncCycleLogs(client, session.user.id, dayLogs, readCycleSyncMeta())
        .then((synced) => {
          onApplyRemoteRef.current(applyCycleSnapshots(dayLogs, synced.snapshots), synced.meta)
          writeCycleSyncMeta(synced.meta)
          setStatus("Period data is synced securely.")
          setError("")
        })
        .catch((syncError: unknown) => {
          setError(syncError instanceof Error ? syncError.message : "Could not sync period data.")
          setStatus("")
        })
    }, 700)
    return () => window.clearTimeout(timeout)
  }, [connectedUserId, dayLogs, session])

  const requestSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    const normalizedTideId = tideId.trim().toUpperCase()
    if (!/^TIDE-[A-Z0-9-]{4,24}$/.test(normalizedTideId)) {
      setError("Enter a valid Tide ID, such as TIDE-1A2B3C4D.")
      return
    }

    setBusy(true)
    setError("")
    setStatus("")
    try {
      localStorage.setItem(pendingTideIdKey, normalizedTideId)
      localStorage.setItem(pendingNameKey, profile.name)
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      })
      if (signInError) throw signInError
      setStatus("Check your email for a secure sign-in link. Open it on this device to finish syncing.")
    } catch (signInError) {
      localStorage.removeItem(pendingTideIdKey)
      localStorage.removeItem(pendingNameKey)
      setError(signInError instanceof Error ? signInError.message : "Could not send a sign-in link.")
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    if (!supabase) return
    setBusy(true)
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) setError(signOutError.message)
    else setStatus("Signed out. This device keeps its local logs.")
    setBusy(false)
  }

  return (
    <section className="tide-account-panel reveal-card" aria-labelledby="tide-account-title">
      <p className="eyebrow">CROSS-DEVICE ACCESS</p>
      <h2 id="tide-account-title">Sync period data</h2>
      <p className="tide-account-copy">
        Verify your email to sync period dates, symptoms, and feelings. Food and workout logs stay on this device.
      </p>
      {supabase && connectedUserId ? (
        <div className="tide-account-connected">
          <p><strong>{connectedTideId}</strong> · {session?.user.email}</p>
          <p className="tide-account-status" role="status">{status}</p>
          <button className="period-toggle" disabled={busy} onClick={() => void signOut()} type="button">
            Sign out
          </button>
        </div>
      ) : supabase ? (
        <form className="tide-account-form" onSubmit={(event) => void requestSignIn(event)}>
          <label>
            <span>Tide ID</span>
            <input
              autoComplete="username"
              value={tideId}
              onChange={(event) => setTideId(event.currentTarget.value)}
              required
            />
          </label>
          <label>
            <span>Email for verification</span>
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />
          </label>
          <button className="period-toggle" disabled={busy} type="submit">
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      ) : null}
      {status && !connectedUserId && <p className="tide-account-status" role="status">{status}</p>}
      {error && <p className="tide-account-error" role="alert">{error}</p>}
    </section>
  )
}
