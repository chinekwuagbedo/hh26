export type UiSound = "click" | "tab"

type AudioName = UiSound | "startup" | "music"

const soundPreferenceKey = "tideline-sound-enabled"
const sources: Record<AudioName, string> = {
  click: new URL("../../assets/click sound.wav", import.meta.url).href,
  tab: new URL("../../assets/tab_transition.wav", import.meta.url).href,
  startup: new URL("../../assets/compressed_better_startup.flac", import.meta.url).href,
  music: new URL("../../assets/compressed_better_background music_4.flac", import.meta.url).href,
}
const players = new Map<AudioName, HTMLAudioElement>()
let enabled = readSoundEnabled()
let soundtrackStarted = false

export function readSoundEnabled(): boolean {
  try {
    return localStorage.getItem(soundPreferenceKey) !== "off"
  } catch {
    return true
  }
}

function getPlayer(name: AudioName): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null
  let player = players.get(name)
  if (!player) {
    player = new Audio(sources[name])
    player.preload = name === "music" ? "none" : "auto"
    player.volume = name === "music" ? 0.16 : name === "startup" ? 0.55 : 0.4
    players.set(name, player)
  }
  return player
}

function startSoundtrack(): void {
  if (!enabled || soundtrackStarted) return
  const startup = getPlayer("startup")
  const music = getPlayer("music")
  if (!startup || !music) return

  soundtrackStarted = true
  music.loop = true
  startup.onended = () => {
    startup.onended = null
    if (enabled) void music.play().catch(() => {})
  }
  void startup.play().catch(() => {
    if (enabled) void music.play().catch(() => {})
  })
}

export function setSoundEnabled(next: boolean): void {
  enabled = next
  try {
    localStorage.setItem(soundPreferenceKey, next ? "on" : "off")
  } catch {
    // Audio preference remains available for the current session.
  }

  if (!next) {
    for (const player of players.values()) {
      player.pause()
      player.currentTime = 0
    }
    soundtrackStarted = false
    return
  }

  startSoundtrack()
}

export function playUiSound(name: UiSound): void {
  if (!enabled) return
  startSoundtrack()
  const player = getPlayer(name)
  if (!player) return
  player.pause()
  player.currentTime = 0
  void player.play().catch(() => {})
}
