import { useState } from "react"
import { playUiSound, readSoundEnabled, setSoundEnabled } from "../lib/soundEffects"

export function SoundToggle() {
  const [enabled, setEnabled] = useState(readSoundEnabled)

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    setSoundEnabled(next)
    if (next) playUiSound("click")
  }

  return (
    <button
      aria-label={enabled ? "Mute sound" : "Enable sound"}
      aria-pressed={enabled}
      className="sound-toggle"
      onClick={toggle}
      title={enabled ? "Mute sound" : "Enable sound"}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 10v4h4l5 4V6l-5 4H4Z" />
        {enabled ? <path d="M16 9a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12" /> : <path d="m16 9 5 6m0-6-5 6" />}
      </svg>
    </button>
  )
}
