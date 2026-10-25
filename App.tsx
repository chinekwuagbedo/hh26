import { mergeImportedWorkouts, parseWorkoutCsv, type ImportedWorkout } from "./src/lib/workoutCsv"
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"
import { Draggable } from "gsap/Draggable"
import { Physics2DPlugin } from "gsap/Physics2DPlugin"
import { createPortal } from "react-dom"
import { TideAccountPanel } from "./src/components/TideAccountPanel"
import { SoundToggle } from "./src/components/SoundToggle"
import { OceanAscii } from "./src/components/OceanAscii"
import {
  getNutrient,
  searchFoodData,
  type FoodSearchResult,
} from "./src/lib/foodDataApi"
import { phaseFor, type Cycle as CyclePeriod } from "./src/lib/cycle"
import {
  emptyDayLog,
  parseDayLogs,
  type DayLog,
  type DayLogs,
  type FoodLog as TrackedFood,
  type WorkoutLog,
} from "./src/lib/dayTracking"
import {
  mergeImportedFoods,
  parseMyFitnessPalCsv,
  type ImportedFood,
} from "./src/lib/myFitnessPalCsv"
import { buildPersonalInsights } from "./src/lib/personalInsights"
import { mergePeriodDates, parsePeriodDates } from "./src/lib/periodData"
import { playUiSound } from "./src/lib/soundEffects"
import {
  recordCycleLogChanges,
  writeCycleSyncMeta,
  type CycleSyncMeta,
} from "./src/lib/tideCloud"

type Tab = "today" | "training" | "food" | "cycle" | "me"

const tabs: { id: Tab; label: string }[] = [
  { id: "today", label: "today" },
  { id: "training", label: "training" },
  { id: "food", label: "food" },
  { id: "cycle", label: "cycle" },
  { id: "me", label: "me" },
]
const fishCatalog = [
  {
    id: "yams",
    label: "Yams",
    src: new URL("./assets/Yams2.png", import.meta.url).href,
  },
  {
    id: "anglerfish",
    label: "Anglerfish",
    src: new URL("./assets/Angkefrish.png", import.meta.url).href,
  },
  {
    id: "sardine",
    label: "Sardine",
    src: new URL("./assets/Sardine-trimmed.png", import.meta.url).href,
  },
  {
    id: "goldfish",
    label: "Goldfish",
    src: new URL("./assets/Goldfish-trimmed.png", import.meta.url).href,
  },
  {
    id: "salmon",
    label: "Salmon",
    src: new URL("./assets/Salmon-trimmed.png", import.meta.url).href,
  },
  {
    id: "tuna",
    label: "Tuna",
    src: new URL("./assets/Tuna-trimmed.png", import.meta.url).href,
  },
  {
    id: "marlin",
    label: "Marlin",
    src: new URL("./assets/Marlin.png", import.meta.url).href,
  },
  {
    id: "shrimp",
    label: "Shrimp",
    src: new URL("./assets/Shrimp-trimmed.png", import.meta.url).href,
  },
  {
    id: "angelfish",
    label: "Angelfish",
    src: new URL("./assets/Angelfish.png", import.meta.url).href,
  },
  {
    id: "seahorse",
    label: "Seahorse",
    src: new URL("./assets/Seahorse.png", import.meta.url).href,
  },
] as const
type FishSpecies = (typeof fishCatalog)[number]["id"]
const fishVariants = [
  { id: "gold", label: "Gold" },
  { id: "coral", label: "Coral" },
  { id: "violet", label: "Violet" },
  { id: "lagoon", label: "Lagoon" },
] as const
type FishVariant = (typeof fishVariants)[number]["id"]
const rockImage = new URL("./assets/Rock-trimmed.png", import.meta.url).href
const footerCoralImage = new URL("./assets/Coral 1.png", import.meta.url).href
const pearlImage = new URL("./assets/orb_sm.png", import.meta.url).href
const auroraCoralImage = new URL("./assets/aurora_coral.png", import.meta.url).href
const chibiAvatarImage = new URL("./assets/Chibi.png", import.meta.url).href
const userAvatarImage = new URL("./assets/users.jpg", import.meta.url).href
const starterFish: CollectedFish = {
  id: "starter-sardine",
  species: "sardine",
  earnedFor: "Your first fish",
}
const mermaidParts = [
  { name: "rock", className: "mermaid-rock", src: new URL("./assets/Rock.png", import.meta.url).href },
  { name: "hair-back", className: "mermaid-hair-back", src: new URL("./assets/mermaid/Hair back.png", import.meta.url).href },
  { name: "tail-bottom", className: "mermaid-tail-bottom", src: new URL("./assets/mermaid/Tail bottom.png", import.meta.url).href },
  { name: "tail-fin", className: "mermaid-tail-fin", src: new URL("./assets/mermaid/Tail fin.png", import.meta.url).href },
  { name: "tail-top", className: "mermaid-tail-top", src: new URL("./assets/mermaid/Tail top.png", import.meta.url).href },
  { name: "left-arm", className: "mermaid-arm mermaid-arm-left", src: new URL("./assets/mermaid/Left arm.png", import.meta.url).href },
  { name: "right-arm-bottom", className: "mermaid-arm mermaid-arm-right-bottom", src: new URL("./assets/mermaid/Right arm bottom.png", import.meta.url).href },
  { name: "torso", className: "mermaid-torso", src: new URL("./assets/mermaid/Torso.png", import.meta.url).href },
  { name: "right-arm-top", className: "mermaid-arm mermaid-arm-right-top", src: new URL("./assets/mermaid/Right arm top.png", import.meta.url).href },
  { name: "head", className: "mermaid-head", src: new URL("./assets/mermaid/Head.png", import.meta.url).href },
  { name: "eye-whites", className: "mermaid-eye-whites", src: new URL("./assets/mermaid/Eye whutes.png", import.meta.url).href },
  { name: "pupils", className: "mermaid-pupils", src: new URL("./assets/mermaid/Eyes.png", import.meta.url).href },
  { name: "hair-bangs", className: "mermaid-hair-bangs", src: new URL("./assets/mermaid/Hair bangs.png", import.meta.url).href },
] as const

interface CollectedFish {
  id: string
  species: FishSpecies
  earnedFor: string
  variant?: FishVariant
  nickname?: string
}

function fishDisplayName(fish: CollectedFish) {
  const species = fishCatalog.find(({ id }) => id === fish.species)
  const variant = fishVariants.find(({ id }) => id === fish.variant)
  return variant && species
    ? `${variant.label} ${species.label.toLowerCase()}`
    : species?.label ?? "Fish"
}

function fishPositionSeed(id: string) {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619)
  }
  return hash >>> 0
}

function seededFishValue(seed: number, salt: number) {
  const value = Math.sin(seed + salt * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function faceFish(fish: HTMLElement, horizontalDirection: number) {
  if (Math.abs(horizontalDirection) < 0.5) return
  const fishArt = fish.querySelector<HTMLElement>(".fish-art")
  if (!fishArt) return
  const facing = horizontalDirection > 0 ? -1 : 1
  if (Number(gsap.getProperty(fishArt, "scaleX")) === facing) return
  gsap.to(fishArt, {
    scaleX: facing,
    duration: 0.14,
    ease: "power1.out",
    overwrite: "auto",
  })
}

function swimFishAround(fish: HTMLElement, water: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  const minX = -fish.offsetLeft
  const minY = -fish.offsetTop
  const maxX = water.clientWidth - fish.offsetLeft - fish.offsetWidth
  const maxY = water.clientHeight - fish.offsetTop - fish.offsetHeight
  const targetX = gsap.utils.random(minX, Math.max(minX, maxX))
  const currentX = Number(gsap.getProperty(fish, "x")) || 0
  faceFish(fish, targetX - currentX)
  gsap.to(fish, {
    x: targetX,
    y: gsap.utils.random(minY, Math.max(minY, maxY)),
    duration: gsap.utils.random(2.8, 5.5),
    ease: "sine.inOut",
    onComplete: () => swimFishAround(fish, water),
  })
}

gsap.registerPlugin(ScrollTrigger, useGSAP, Draggable, Physics2DPlugin)

function CurvedBubbleText({
  text,
  className,
  align = "center",
  curveDepth = 0.42,
  maxChars = 38,
  fontSize = 16,
}: {
  text: string
  className?: string
  align?: "center" | "start"
  curveDepth?: number
  maxChars?: number
  fontSize?: number
}) {
  const id = useId().replace(/:/g, "")
  const svgRef = useRef<SVGSVGElement>(null)
  const [svgWidth, setSvgWidth] = useState(320)
  const lines = useMemo(() => {
    const result: string[] = []
    let line = ""
    for (const piece of text.trim().split(/\s+/)) {
      const next = line ? `${line} ${piece}` : piece
      if (next.length > maxChars && line) {
        result.push(line)
        line = piece
      } else {
        line = next
      }
    }
    if (line) result.push(line)
    return result.length ? result : [""]
  }, [maxChars, text])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width)
      if (width > 0) setSvgWidth((current) => current === width ? current : width)
    })
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  const lineHeight = Math.max(fontSize * 2.1, 20)
  const pathStart = svgWidth * 0.02
  const pathEnd = svgWidth * 0.98
  return (
    <svg
      className={`curved-bubble-text${className ? ` ${className}` : ""}`}
      ref={svgRef}
      role="img"
      aria-label={text}
      viewBox={`0 0 ${svgWidth} ${lines.length * lineHeight}`}
      preserveAspectRatio="none"
      style={{ height: `${lines.length * lineHeight}px` }}
    >
      <defs>
        {lines.map((_, index) => {
          const y = index * lineHeight + lineHeight * 0.7
          return (
            <path
              key={`${id}-path-${index}`}
              id={`${id}-path-${index}`}
              d={`M ${pathStart} ${y} Q ${svgWidth / 2} ${y - lineHeight * curveDepth} ${pathEnd} ${y}`}
            />
          )
        })}
      </defs>
      {lines.map((lineText, index) => (
        <text key={`${id}-text-${index}`} fontSize={fontSize}>
          <textPath
            href={`#${id}-path-${index}`}
            textAnchor={align === "start" ? "start" : "middle"}
            startOffset={align === "start" ? "0%" : "50%"}
          >
            {lineText}
          </textPath>
        </text>
      ))}
    </svg>
  )
}

type SurfaceBubble = {
  x: number
  y: number
  radius: number
  speed: number
  drift: number
  phase: number
  alpha: number
}

const surfaceWaveLayers = [
  { color: "rgba(255,255,255,.22)", width: 2 },
  { color: "rgba(240,255,242,.3)", width: 3 },
  { color: "rgba(255,255,255,.18)", width: 1.5 },
]

function HeroSurface() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const hero = canvas?.parentElement
    const context = canvas?.getContext("2d")
    if (!canvas || !hero || !context) return

    const orb = new Image()
    orb.src = new URL("./assets/orb_sm.png", import.meta.url).href
    const bubbles: SurfaceBubble[] = []
    let width = 0
    let height = 0
    let time = 0
    let lastBubble = 0
    let lastSurge = 0
    let frame = 0
    let visible = true
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const waveY = (x: number, layer: number) => {
      const energy = 1.45
      return height * (0.12 + layer * 0.09)
        + Math.sin(x * 0.009 + time * (1.1 + layer * 0.17) + layer) * (9 - layer) * energy
        + Math.cos(x * 0.021 - time * 1.35 + layer * 1.8) * 5 * energy
        + Math.sin(x * 0.038 + time * 2.2) * 2.5 * energy
    }

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = bounds.width
      height = bounds.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      bubbles.length = 0
      for (let index = 0; index < 16; index += 1) {
        bubbles.push({
          x: width * (0.3 + Math.random() * 0.4),
          y: Math.random() * height,
          radius: 5 + Math.random() * 8,
          speed: 0.25 + Math.random() * 0.5,
          drift: (Math.random() - 0.5) * 0.2,
          phase: Math.random() * Math.PI * 2,
          alpha: 0.45 + Math.random() * 0.45,
        })
      }
    }

    const addSurge = (x: number) => {
      const crest = waveY(x, 1)
      for (let index = 0; index < 6 && bubbles.length < 38; index += 1) {
        bubbles.push({
          x: x + (Math.random() - 0.5) * 42,
          y: crest + 15 + Math.random() * 48,
          radius: 5 + Math.random() * 9,
          speed: 0.65 + Math.random() * 1.15,
          drift: (Math.random() - 0.5) * 0.7,
          phase: Math.random() * Math.PI * 2,
          alpha: 0.62 + Math.random() * 0.35,
        })
      }
    }

    const draw = (timestamp: number) => {
      if (!visible) return
      context.clearRect(0, 0, width, height)
      if (!reducedMotion) time += 0.022

      for (let layerIndex = 0; layerIndex < surfaceWaveLayers.length; layerIndex += 1) {
        const layer = surfaceWaveLayers[layerIndex]
        context.beginPath()
        for (let x = 0; x <= width + 12; x += 12) {
          const y = waveY(x, layerIndex)
          if (x === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        }
        context.strokeStyle = layer.color
        context.lineWidth = layer.width
        context.lineCap = "round"
        context.stroke()
      }

      if (!reducedMotion && timestamp - lastBubble > 720 && bubbles.length < 30) {
        bubbles.push({
          x: width * (0.3 + Math.random() * 0.4),
          y: height * (0.48 + Math.random() * 0.45),
          radius: 5 + Math.random() * 8,
          speed: 0.35 + Math.random() * 0.7,
          drift: (Math.random() - 0.5) * 0.28,
          phase: Math.random() * Math.PI * 2,
          alpha: 0.4 + Math.random() * 0.5,
        })
        lastBubble = timestamp
      }
      if (!reducedMotion && timestamp - lastSurge > 5800) {
        addSurge(width * (0.38 + Math.random() * 0.24))
        lastSurge = timestamp
      }

      for (let index = bubbles.length - 1; index >= 0; index -= 1) {
        const bubble = bubbles[index]
        bubble.phase += 0.035
        bubble.x += bubble.drift + Math.sin(bubble.phase) * 0.3
        if (!reducedMotion) bubble.y -= bubble.speed
        if (bubble.y < -bubble.radius * 2) {
          bubbles.splice(index, 1)
          continue
        }
        context.globalAlpha = bubble.alpha
        if (orb.complete && orb.naturalWidth > 0) {
          context.drawImage(
            orb,
            bubble.x - bubble.radius,
            bubble.y - bubble.radius,
            bubble.radius * 2,
            bubble.radius * 2,
          )
        } else {
          context.beginPath()
          context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2)
          context.strokeStyle = "rgba(255,255,255,.7)"
          context.lineWidth = 1.5
          context.stroke()
        }
      }
      context.globalAlpha = 1
      if (!reducedMotion) frame = window.requestAnimationFrame(draw)
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(hero)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && frame === 0 && !reducedMotion) frame = window.requestAnimationFrame(draw)
      if (!visible && frame !== 0) {
        window.cancelAnimationFrame(frame)
        frame = 0
      }
      if (visible && reducedMotion) draw(0)
    })
    intersectionObserver.observe(hero)
    if (reducedMotion) draw(0)
    else frame = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
    }
  }, [])

  return <canvas aria-hidden="true" className="hero-surface" ref={canvasRef} />
}

function TravelingShoal({ fish }: { fish: CollectedFish[] }) {
  const uniqueFish = useMemo(
    () => fish.filter(
      (entry, index, collection) =>
        collection.findIndex(
          (item) => item.species === entry.species && item.variant === entry.variant,
        ) === index,
    ),
    [fish],
  )
  const positions = useMemo(() => {
    const columns = Math.max(1, Math.ceil(Math.sqrt(uniqueFish.length)))
    const rows = Math.max(1, Math.ceil(uniqueFish.length / columns))
    const slots = Array.from({ length: uniqueFish.length }, (_, index) => index).sort(
      (a, b) => fishPositionSeed(uniqueFish[a].id) - fishPositionSeed(uniqueFish[b].id),
    )

    return uniqueFish.map((entry, index) => {
      const columnWidth = 100 / columns
      const rowHeight = 100 / rows
      const positionSlot = slots[index]
      const seed = fishPositionSeed(entry.id)
      const topPercent = (Math.floor(positionSlot / columns) + 0.12 + seededFishValue(seed, 2) * 0.66) * rowHeight
      return {
        left: `${((positionSlot % columns) + 0.12 + seededFishValue(seed, 1) * 0.66) * columnWidth}%`,
        top: `${topPercent}%`,
        depth: 0.25 + Math.min(1, topPercent / 100) * 0.75,
        animationDelay: `${seededFishValue(seed, 3) * -8}s`,
        animationDuration: `${3.5 + seededFishValue(seed, 4) * 4.5}s`,
      }
    })
  }, [uniqueFish])

  const shoalRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const shoal = shoalRef.current
      const scrollArea = shoal?.parentElement
      if (!shoal || !scrollArea) return

      const motion = gsap.matchMedia()
      motion.add("(prefers-reduced-motion: no-preference)", () => {
        shoal.querySelectorAll<HTMLElement>(".traveling-fish-depth").forEach((layer) => {
          const depth = Number(layer.dataset.parallaxDepth ?? 0.5)
          const fishArt = layer.querySelector<HTMLElement>(".traveling-fish")

          gsap.to(layer, {
            y: -320 * depth,
            ease: "none",
            scrollTrigger: {
              trigger: scrollArea,
              start: "top top",
              end: "bottom bottom",
              scrub: 1,
            },
          })

          if (fishArt) {
            gsap.to(fishArt, {
              "--depth-scale": 0.7 + 0.3 * depth,
              "--depth-blur": `${(1 - depth) * 1.5}px`,
              opacity: 0.12 + 0.16 * depth,
              ease: "none",
              scrollTrigger: {
                trigger: scrollArea,
                start: "top top",
                end: "bottom bottom",
                scrub: 1,
              },
            })
          }
        })
      })

      return () => motion.revert()
    },
    { scope: shoalRef, dependencies: [uniqueFish], revertOnUpdate: true },
  )

  return (
    <div className="traveling-shoal" aria-hidden="true" ref={shoalRef}>
      {uniqueFish.map((entry, index) => {
        const species = fishCatalog.find(({ id }) => id === entry.species)
        if (!species) return null
        const lane = index % 5
        const position = positions[index]
        return (
          <div
            className="traveling-fish-depth"
            key={entry.id}
            data-parallax-depth={position.depth}
            style={{
              left: position.left,
              top: position.top,
            }}
          >
            <div
              className={`traveling-fish traveling-fish-${lane + 1}${entry.variant ? ` traveling-fish-variant-${entry.variant}` : ""}`}
              style={{
                animationDelay: position.animationDelay,
                animationDuration: position.animationDuration,
              }}
            >
              <img src={species.src} alt="" draggable={false} loading="lazy" />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InteractiveFish({
  className,
  label,
  onHold,
  onSwim,
  src,
  swimDelay = 0,
}: {
  className: string
  label: string
  onHold: () => void
  onSwim: () => void
  src: string
  swimDelay?: number
}) {
  const fishRef = useRef<HTMLButtonElement>(null)
  const fishArtRef = useRef<HTMLImageElement>(null)
  const holdTimeoutRef = useRef<number | null>(null)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const holdTriggeredRef = useRef(false)

  const cancelHold = () => {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
  }
  const startHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    holdTriggeredRef.current = false
    cancelHold()
    holdTimeoutRef.current = window.setTimeout(() => {
      holdTimeoutRef.current = null
      holdTriggeredRef.current = true
      onHold()
    }, 550)
  }
  const trackHoldMovement = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = pointerStartRef.current
    if (!start) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
      cancelHold()
      pointerStartRef.current = null
    }
  }
  const endPress = () => {
    cancelHold()
    pointerStartRef.current = null
  }

  const startSwimming = () => {
    if (!fishArtRef.current) return
    gsap.to(fishArtRef.current, {
      y: -6,
      rotation: 6,
      duration: 1.4,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      x: gsap.utils.random(-8, 8),
      delay: swimDelay,
    })
  }

  useGSAP(
    () => {
      startSwimming()
    },
    { scope: fishRef },
  )

  const moveFish = () => {
    const fish = fishRef.current
    const wrapper = fish?.parentElement
    const water = wrapper?.parentElement
    if (!fish || !wrapper || !water) return
    onSwim()

    const rect = fish.getBoundingClientRect()
    const ripple = document.createElement("span")
    ripple.className = "fish-tap-ripple"
    ripple.setAttribute("aria-hidden", "true")
    ripple.style.left = `${rect.width / 2}px`
    ripple.style.top = `${rect.height / 2}px`
    fish.append(ripple)

    gsap.fromTo(
      ripple,
      { scale: 0.2, autoAlpha: 0.82 },
      {
        scale: 3.8,
        autoAlpha: 0,
        duration: 0.8,
        ease: "power2.out",
        onComplete: () => ripple.remove(),
      },
    )
    gsap.killTweensOf(wrapper)
    const minX = -wrapper.offsetLeft
    const minY = -wrapper.offsetTop
    const maxX = water.clientWidth - wrapper.offsetLeft - wrapper.offsetWidth
    const maxY = water.clientHeight - wrapper.offsetTop - wrapper.offsetHeight
    const targetX = gsap.utils.random(minX, Math.max(minX, maxX))
    faceFish(wrapper, targetX - (Number(gsap.getProperty(wrapper, "x")) || 0))
    gsap.to(wrapper, {
      x: targetX,
      y: gsap.utils.random(minY, Math.max(minY, maxY)),
      duration: 0.9,
      ease: "power2.inOut",
      onComplete: () => {
        Draggable.get(wrapper)?.update(true)
        swimFishAround(wrapper, water)
      },
    })
  }

  return (
    <button
      aria-label={label}
      className={`fish-interaction ${className}`}
      onClick={() => {
        if (holdTriggeredRef.current) {
          holdTriggeredRef.current = false
          return
        }
        moveFish()
      }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerCancel={endPress}
      onPointerDown={startHold}
      onPointerMove={trackHoldMovement}
      onPointerUp={endPress}
      onPointerEnter={() => {
        const fishArt = fishArtRef.current
        const wrapper = fishRef.current?.parentElement
        if (fishArt) gsap.getTweensOf(fishArt).forEach((tween) => tween.pause())
        if (wrapper) gsap.getTweensOf(wrapper).forEach((tween) => tween.pause())
      }}
      onPointerLeave={() => {
        endPress()
        const fishArt = fishArtRef.current
        const wrapper = fishRef.current?.parentElement
        if (fishArt) gsap.getTweensOf(fishArt).forEach((tween) => tween.resume())
        if (wrapper) gsap.getTweensOf(wrapper).forEach((tween) => tween.resume())
      }}
      ref={fishRef}
      type="button"
    >
      <img
        alt=""
        aria-hidden="true"
        className="fish-art"
        draggable={false}
        loading="lazy"
        ref={fishArtRef}
        src={src}
      />
    </button>
  )
}

function ShoalGarden({
  fish,
  onRenameFish,
}: {
  fish: CollectedFish[]
  onRenameFish: (fishId: string, nickname: string) => void
}) {
  const waterRef = useRef<HTMLDivElement>(null)
  const [fishNotice, setFishNotice] = useState<{ id: string; species: string } | null>(null)
  const [selectedFish, setSelectedFish] = useState<CollectedFish | null>(null)
  const [nicknameDraft, setNicknameDraft] = useState("")

  const openFishDetails = (entry: CollectedFish) => {
    setSelectedFish(entry)
    setNicknameDraft(entry.nickname ?? "")
  }

  useEffect(() => {
    if (!fishNotice) return
    const timeout = window.setTimeout(() => setFishNotice(null), 2200)
    return () => window.clearTimeout(timeout)
  }, [fishNotice])

  useGSAP(
    () => {
      const water = waterRef.current
      if (!water) return

      const velocityByFish = new WeakMap<HTMLElement, {
        x: number
        y: number
        time: number
        velocityX: number
        velocityY: number
      }>()
      const draggables = Array.from(
        water.querySelectorAll<HTMLElement>(".shoal-fish-wrap"),
      ).flatMap((element) =>
        Draggable.create(element, {
          type: "x,y",
          bounds: water,
          edgeResistance: 0.8,
          zIndexBoost: false,
          onDragStart: function (this: Draggable) {
            gsap.killTweensOf(this.target)
            this.applyBounds(water)
            this.target.classList.add("is-grabbed")
          },
          onDrag: function (this: Draggable) {
            if (!(this.target instanceof HTMLElement)) return
            const now = performance.now()
            const previous = velocityByFish.get(this.target)
            if (previous) {
              const elapsed = Math.max((now - previous.time) / 1000, 0.001)
              const sampleX = (this.x - previous.x) / elapsed
              const sampleY = (this.y - previous.y) / elapsed
              faceFish(this.target, sampleX)
              velocityByFish.set(this.target, {
                x: this.x,
                y: this.y,
                time: now,
                velocityX: gsap.utils.clamp(-700, 700, previous.velocityX * 0.35 + sampleX * 0.65),
                velocityY: gsap.utils.clamp(-500, 500, previous.velocityY * 0.35 + sampleY * 0.65),
              })
            } else {
              velocityByFish.set(this.target, {
                x: this.x,
                y: this.y,
                time: now,
                velocityX: 0,
                velocityY: 0,
              })
            }
          },
          onDragEnd: function (this: Draggable) {
            if (!(this.target instanceof HTMLElement)) return
            const target = this.target
            const velocity = velocityByFish.get(target)
            target.classList.remove("is-grabbed")
            if (velocity) faceFish(target, velocity.velocityX)
            if (!velocity) {
              swimFishAround(target, water)
              return
            }

            const parent = target.parentElement
            if (!parent) return
            const minX = -target.offsetLeft
            const minY = -target.offsetTop
            const maxX = parent.clientWidth - target.offsetLeft - target.offsetWidth
            const maxY = parent.clientHeight - target.offsetTop - target.offsetHeight
            const speed = Math.hypot(velocity.velocityX, velocity.velocityY)
            if (speed < 75) {
              swimFishAround(target, water)
              return
            }

            gsap.to(target, {
              duration: 1.5,
              physics2D: {
                velocity: speed * 0.32,
                angle: (Math.atan2(velocity.velocityY, velocity.velocityX) * 180) / Math.PI,
                gravity: 0,
                friction: 0.2,
              },
              modifiers: {
                x: (value) => String(gsap.utils.clamp(minX, maxX, Number.parseFloat(value))),
                y: (value) => String(gsap.utils.clamp(minY, maxY, Number.parseFloat(value))),
              },
              ease: "none",
              onComplete: () => swimFishAround(target, water),
            })
          },
        }),
      )

      draggables.forEach((draggable) => {
        if (draggable.target instanceof HTMLElement) {
          swimFishAround(draggable.target, water)
        }
      })

      return () => draggables.forEach((draggable) => draggable.kill())
    },
    { scope: waterRef, dependencies: [fish], revertOnUpdate: true },
  )

  return (
    <section className="shoal-garden reveal-card" aria-labelledby="shoal-title">
      <div className="shoal-heading">
        <div>
          <p className="eyebrow"><CurvedBubbleText text="YOUR GROWING SHOAL" align="start" curveDepth={0.48} maxChars={24} fontSize={10} /></p>
          <h2 id="shoal-title"><CurvedBubbleText text="Little things add up" align="start" maxChars={28} fontSize={20} /></h2>
        </div>
        <span className="shoal-count"><CurvedBubbleText text={`${fish.length} fish`} maxChars={12} fontSize={12} /></span>
      </div>
      <p className="shoal-note"><CurvedBubbleText text="Every new log brings a new friend into your water." align="start" maxChars={42} fontSize={12} /></p>
      <div
        className="shoal-water"
        aria-label={`${fish.length} collected fish. Drag a fish to move or toss it.`}
        ref={waterRef}
        onPointerDown={(event) => {
          if (event.target instanceof Element && event.target.closest(".shoal-fish-wrap")) return
          playUiSound("tab")
          const bounds = event.currentTarget.getBoundingClientRect()
          const waterStyle = getComputedStyle(event.currentTarget)
          const scaleX = event.currentTarget.offsetWidth / bounds.width
          const scaleY = event.currentTarget.offsetHeight / bounds.height
          const originX = (event.clientX - bounds.left) * scaleX
            - Number.parseFloat(waterStyle.borderLeftWidth)
          const originY = (event.clientY - bounds.top) * scaleY
            - Number.parseFloat(waterStyle.borderTopWidth)
          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

          for (let index = 0; index < 5; index += 1) {
            const bubble = document.createElement("span")
            const size = gsap.utils.random(7, 15)
            bubble.className = "shoal-tap-bubble"
            bubble.setAttribute("aria-hidden", "true")
            bubble.style.left = `${originX - size / 2}px`
            bubble.style.top = `${originY - size / 2}px`
            bubble.style.width = `${size}px`
            bubble.style.height = `${size}px`
            event.currentTarget.append(bubble)

            if (reducedMotion) {
              bubble.style.opacity = ".75"
              window.setTimeout(() => bubble.remove(), 650)
              continue
            }

            gsap.fromTo(
              bubble,
              { scale: 0.55, opacity: 0.9 },
              {
                x: gsap.utils.random(-16, 16),
                y: -gsap.utils.random(45, 85),
                scale: 1.1,
                opacity: 0,
                delay: 0.1 + index * 0.045,
                duration: gsap.utils.random(0.8, 1.25),
                ease: "power1.out",
                onComplete: () => bubble.remove(),
              },
            )
          }
        }}
        style={{ height: `${Math.max(190, Math.ceil(fish.length / 5) * 76 + 40)}px` }}
      >
        {fish.map((catchEntry, index) => {
          const species = fishCatalog.find(({ id }) => id === catchEntry.species)
          if (!species) return null
          const speciesName = fishDisplayName(catchEntry)
          const displayName = catchEntry.nickname?.trim() || speciesName
          const accessibleName = catchEntry.nickname
            ? `${displayName}, ${speciesName}`
            : speciesName
          const column = index % 5
          const row = Math.floor(index / 5)
          const sizeVariant = Math.floor(seededFishValue(fishPositionSeed(catchEntry.id), 6) * 4) + 1
          return (
            <div
              className="shoal-fish-wrap"
              key={catchEntry.id}
              style={{
                left: `${column * 20 + 2}%`,
                top: `${row * 76 + 16}px`,
              }}
            >
              <InteractiveFish
                className={`shoal-fish shoal-fish-${species.id} shoal-fish-size-${sizeVariant}${catchEntry.variant ? ` shoal-fish-variant-${catchEntry.variant}` : ""}`}
                label={`Tap to swim or hold to rename ${accessibleName}`}
                onHold={() => openFishDetails(catchEntry)}
                onSwim={() => setFishNotice({ id: createLocalId(), species: displayName })}
                src={species.src}
                swimDelay={(index % 5) * 0.28}
              />
            </div>
          )
        })}
        {fishNotice && (
          <p className="shoal-fish-notice" key={fishNotice.id} role="status" aria-live="polite">
            {fishNotice.species} swims away
          </p>
        )}
        <span className="shoal-bubble shoal-bubble-one" aria-hidden="true" />
        <span className="shoal-bubble shoal-bubble-two" aria-hidden="true" />
        <span className="shoal-bubble shoal-bubble-three" aria-hidden="true" />
        <span className="shoal-bubble shoal-bubble-four" aria-hidden="true" />
        <span className="shoal-bubble shoal-bubble-five" aria-hidden="true" />
        <span className="shoal-bubble shoal-bubble-six" aria-hidden="true" />
      </div>
      {selectedFish && (
        createPortal(<div className="fish-name-backdrop">
          <form
            aria-labelledby="fish-name-title"
            aria-modal="true"
            className="fish-name-dialog"
            onKeyDown={(event) => {
              if (event.key === "Escape") setSelectedFish(null)
            }}
            onSubmit={(event) => {
              event.preventDefault()
              const nickname = nicknameDraft.trim()
              if (!nickname) return
              onRenameFish(selectedFish.id, nickname)
              setSelectedFish(null)
            }}
            role="dialog"
          >
            <p className="eyebrow">YOUR SHOAL</p>
            <h2 id="fish-name-title">Meet your {fishDisplayName(selectedFish)}</h2>
            <label htmlFor="fish-nickname">Give this fish a name</label>
            <input
              autoFocus
              id="fish-nickname"
              maxLength={32}
              onChange={(event) => setNicknameDraft(event.target.value)}
              placeholder="Fish name"
              value={nicknameDraft}
            />
            <div className="fish-name-actions">
              <button className="fish-name-cancel" onClick={() => setSelectedFish(null)} type="button">Cancel</button>
              <button className="fish-name-save" disabled={!nicknameDraft.trim()} type="submit">Save name</button>
            </div>
          </form>
        </div>, document.body)
      )}
    </section>
  )
}

function Icon({
  name,
  size = 22,
}: {
  name: Tab | "wave" | "bolt" | "moon" | "plus" | "check"
  size?: number
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {name === "today" && (
        <>
          <circle cx="12" cy="12" r="7.5" {...common} />
          <path
            d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4"
            {...common}
          />
        </>
      )}
      {name === "training" && (
        <>
          <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" {...common} />
        </>
      )}
      {name === "cycle" && (
        <>
          <circle cx="12" cy="13" r="7.5" {...common} />
          <path d="M8 3h8M9 2v3M15 2v3M8.5 11h7M8.5 15h4" {...common} />
        </>
      )}
      {name === "food" && (
        <>
          <path d="M5 12c4-5 10-5 14 0-4 5-10 5-14 0Z" {...common} />
          <path d="M8 12h.01M12 9.5c1.5 1 3 1 4.5 0" {...common} />
        </>
      )}
      {name === "me" && (
        <>
          <circle cx="12" cy="8" r="3.2" {...common} />
          <path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6" {...common} />
        </>
      )}
      {name === "wave" && (
        <path
          d="M2 14c3-5 6 5 10 0s7 5 10 0M2 9c3-5 6 5 10 0s7 5 10 0"
          {...common}
        />
      )}
      {name === "bolt" && (
        <path d="M13.5 2 6 13h6l-1.5 9L18 10h-6l1.5-8Z" {...common} />
      )}
      {name === "moon" && (
        <path
          d="M19.5 15.5A8.5 8.5 0 0 1 8.5 4.5a8.5 8.5 0 1 0 11 11Z"
          {...common}
        />
      )}
      {name === "plus" && <path d="M12 5v14M5 12h14" {...common} />}
      {name === "check" && <path d="m5 12 4.5 4.5L19 7" {...common} />}
    </svg>
  )
}

function Oracle() {
  return (
    <div
      className="oracle mermaid-art"
      role="img"
      aria-label="Mermaid oracle resting on an ocean rock"
    >
      {mermaidParts.map((part) => (
        <img
          alt=""
          aria-hidden="true"
          className={`mermaid-part ${part.className}`}
          draggable={false}
          key={part.name}
          src={part.src}
        />
      ))}
    </div>
  )
}

const namiGreetings = [
  "I’m listening for little currents in your logs.",
  "Bubbles up! A meal, mood, or movement note helps me spot patterns.",
  "I brought my tiniest oracle shell. Ask me something about your day.",
  "Your shoal gets brighter every time you check in.",
  "Gentle tide rule: observe first, pressure never.",
]

function Today({
  name,
  dayLogs,
  fish,
  onRenameFish,
  onQuickAction,
}: {
  name: string
  dayLogs: DayLogs
  fish: CollectedFish[]
  onRenameFish: (fishId: string, nickname: string) => void
  onQuickAction: (target: "period" | "food" | "workout") => void
}) {
  const [question, setQuestion] = useState("")
  const titleCopyRef = useRef<HTMLSpanElement>(null)
  const titleRippleRef = useRef<HTMLSpanElement>(null)
  const titleRippleActiveRef = useRef(false)
  const suggestedExercises = suggestExercisesFromHistory(dayLogs, localDateKey(new Date()))
  const personalInsights = buildPersonalInsights(dayLogs, [])
  const hasCheckIns = Object.values(dayLogs).some(
    (day) =>
      day.period ||
      day.foods.length > 0 ||
      day.workouts.length > 0 ||
      day.symptoms.length > 0 ||
      day.feelings.length > 0,
  )
  const namiTip = hasCheckIns
    ? personalInsights.cyclesLogged >= 2 &&
      !personalInsights.messages[0].includes("still taking shape")
      ? "Aha, the currents are gossiping! I spotted a little pattern in your logs. Look below for my tiny tide-note."
      : personalInsights.cyclesLogged < 2
        ? "I’m collecting clues in my shell. A couple more period starts will help me trace your tide."
        : "I’ve got bubbles, but not a pattern just yet. Keep logging whatever feels useful; no rush."
    : "My shell is quiet so far. Add a meal, movement note, or cycle day and I’ll start following your current."
  const [answer, setAnswer] = useState(
    "Ask me what your cycle, food, or training logs might be showing. I’ll use the entries saved on this device.",
  )
  const [namiThinking, setNamiThinking] = useState(false)
  const [namiGreetingIndex, setNamiGreetingIndex] = useState(0)
  const nudgeNami = () => {
    playUiSound("click")
    const todayLog = dayLogs[localDateKey(new Date())] ?? emptyDayLog()
    const prompt = namiGreetings[namiGreetingIndex % namiGreetings.length]
    const detail = todayLog.foods.length || todayLog.workouts.length
      ? ` You’ve already saved ${todayLog.foods.length + todayLog.workouts.length} food or training ${todayLog.foods.length + todayLog.workouts.length === 1 ? "entry" : "entries"} today.`
      : " No food or workout entries are saved for today yet."
    setAnswer(`${prompt}${detail}`)
    setNamiGreetingIndex((current) => current + 1)
  }
  const askOracle = (prompt: string) => {
    const fallbackAnswer = () => {
      const text = prompt.toLowerCase()
      const today = localDateKey(new Date())
      const log = dayLogs[today] ?? emptyDayLog()
      const phase = phaseFor(today, loggedCycleStarts(dayLogs))
      const insights = buildPersonalInsights(dayLogs, [])

      if (text.includes("insight") || text.includes("pattern")) {
        return insights.messages[0]
      }
      if (text.includes("cycle") || text.includes("period") || text.includes("phase")) {
        return phase
          ? `Your current estimate is the ${phase.phase} phase, day ${phase.cycleDay} of a ${phase.cycleLen}-day cycle. Cycle timing is an estimate based on the period days you logged.`
          : "I don’t have enough logged period starts to estimate a cycle phase yet. You can add a period day in Cycle; the estimate will update from your entries."
      }
      if (text.includes("food") || text.includes("crav") || text.includes("eat")) {
        return log.foods.length
          ? `You’ve logged ${log.foods.length} ${log.foods.length === 1 ? "food" : "foods"} today: ${log.foods.map((food) => food.name).join(", ")}. ${insights.messages[0]}`
          : "There aren’t any foods logged today yet, so I can’t compare your food patterns. Add meals over time to build a personal insight."
      }
      if (text.includes("train") || text.includes("workout") || text.includes("recover")) {
        return log.workouts.length
          ? `You’ve logged ${log.workouts.length} workout${log.workouts.length === 1 ? "" : "s"} today. ${phase ? `Your current cycle estimate is ${phase.phase.toLowerCase()}. ` : ""}${insights.messages[0]}`
          : `No workouts are logged today yet. ${phase ? `Your current cycle estimate is ${phase.phase.toLowerCase()}. ` : ""}${insights.messages[0]}`
      }
      if (text.includes("feel") || text.includes("energy") || text.includes("symptom")) {
        const notes = [...log.feelings, ...log.symptoms]
        return notes.length
          ? `Today you noted ${notes.join(", ").toLowerCase()}.${phase ? ` Your current cycle estimate is ${phase.phase.toLowerCase()}.` : ""} These are your own check-ins, not a diagnosis.`
          : "You haven’t added feelings or symptoms for today yet. Once you log a check-in, I can reflect it back alongside your cycle estimate."
      }
      return `I can help you explore your logged cycle, food, feelings, and training. ${insights.messages[0]}`
    }

    setQuestion("")
    if (namiThinking) return
    setNamiThinking(true)
    setAnswer("Nami is reading the currents in your saved logs…")
    void fetch("/api/nami", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: prompt,
        context: buildNamiContext(dayLogs),
      }),
    })
      .then(async (response) => {
        const result: unknown = await response.json().catch(() => ({}))
        if (!response.ok) {
          const message =
            typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
              ? result.error
              : "Nami could not reach the AI current."
          throw new Error(message)
        }
        if (
          typeof result !== "object" ||
          result === null ||
          !("answer" in result) ||
          typeof result.answer !== "string"
        ) {
          throw new Error("Nami surfaced without an answer.")
        }
        setAnswer(result.answer)
      })
      .catch(() => setAnswer(fallbackAnswer()))
      .finally(() => setNamiThinking(false))
  }
  return (
    <main className="screen today-screen page-section" id="today">
      <header>
        <div>
          <p className="eyebrow">YOUR DAILY CURRENT</p>
          <h1
            aria-label={`Welcome to the Red Sea, ${name}`}
            className="liquid-title"
            onPointerMove={(event) => {
              if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
              const bounds = event.currentTarget.getBoundingClientRect()
              const pointerX = (event.clientX - bounds.left) / bounds.width
              const pointerY = (event.clientY - bounds.top) / bounds.height
              const text = titleCopyRef.current
              const ripple = titleRippleRef.current
              const letters = text?.querySelectorAll<HTMLElement>(".liquid-title-char")
              if (!text || !ripple || !letters?.length) return

              const centers = Array.from(letters, (letter) => {
                const letterBounds = letter.getBoundingClientRect()
                return {
                  x: letterBounds.left + letterBounds.width / 2,
                  y: letterBounds.top + letterBounds.height / 2,
                }
              })
              letters.forEach((letter, index) => {
                const center = centers[index]
                const deltaX = center.x - event.clientX
                const deltaY = center.y - event.clientY
                const distance = Math.hypot(deltaX, deltaY)
                const influence = gsap.utils.clamp(0, 1, 1 - distance / 170)
                const angle = Math.atan2(deltaY, deltaX)
                gsap.to(letter, {
                  x: Math.cos(angle) * influence * 8,
                  y: Math.sin(angle) * influence * 8 - influence * 3,
                  rotation: (deltaX / Math.max(distance, 1)) * influence * 12,
                  scale: 1 + influence * 0.14,
                  duration: 0.38,
                  ease: "elastic.out(1, 0.55)",
                  overwrite: "auto",
                })
              })
              if (!titleRippleActiveRef.current) {
                titleRippleActiveRef.current = true
                const rings = ripple.querySelectorAll<HTMLElement>(".title-ripple-ring")
                const sparks = ripple.querySelectorAll<HTMLElement>(".title-ripple-spark")
                const flash = ripple.querySelector<HTMLElement>(".title-ripple-flash")
                const burst = gsap.timeline({
                  onComplete: () => { titleRippleActiveRef.current = false },
                })
                if (flash) {
                  burst.fromTo(
                    flash,
                    { scale: 0.25, autoAlpha: 0.95 },
                    { scale: 1.5, autoAlpha: 0, duration: 0.42, ease: "power2.out" },
                    0,
                  )
                }
                rings.forEach((ring, index) => {
                  burst.fromTo(
                    ring,
                    { scale: 0.2, autoAlpha: 0.9 },
                    {
                      scale: 2.5 + index * 0.48,
                      autoAlpha: 0,
                      duration: 1.05,
                      ease: "power2.out",
                    },
                    index * 0.1,
                  )
                })
                sparks.forEach((spark, index) => {
                  const angle = (index / sparks.length) * Math.PI * 2 - Math.PI / 4
                  burst.fromTo(
                    spark,
                    { x: 0, y: 0, scale: 0.35, autoAlpha: 0.95 },
                    {
                      x: Math.cos(angle) * 38,
                      y: Math.sin(angle) * 38,
                      scale: 0.85,
                      autoAlpha: 0,
                      duration: 0.5,
                      ease: "power2.out",
                    },
                    0.03,
                  )
                })
              }
              gsap.to(ripple, {
                left: `${pointerX * 100}%`,
                top: `${pointerY * 100}%`,
                duration: 0.1,
                ease: "power1.out",
                overwrite: "auto",
              })
            }}
            onPointerLeave={() => {
              if (titleCopyRef.current) {
                const letters = titleCopyRef.current.querySelectorAll<HTMLElement>(
                  ".liquid-title-char",
                )
                gsap.to(letters, {
                  x: 0,
                  y: 0,
                  rotation: 0,
                  scale: 1,
                  duration: 0.48,
                  ease: "elastic.out(1, 0.6)",
                  stagger: { each: 0.012, from: "center" },
                  overwrite: "auto",
                })
              }
              if (titleRippleRef.current) {
                titleRippleActiveRef.current = false
                const ripple = titleRippleRef.current
                const details = ripple.querySelectorAll<HTMLElement>(
                  ".title-ripple-ring, .title-ripple-spark, .title-ripple-flash",
                )
                gsap.killTweensOf([ripple, ...details])
                gsap.to(details, {
                  x: 0,
                  y: 0,
                  scale: 0.2,
                  autoAlpha: 0,
                  duration: 0.16,
                  overwrite: "auto",
                })
                gsap.to(ripple, {
                  left: "50%",
                  top: "50%",
                  duration: 0.2,
                  overwrite: "auto",
                })
              }
            }}
          >
            <span
              aria-hidden="true"
              className="liquid-title-copy"
              ref={titleCopyRef}
            >
              {`Welcome to the Red Sea, ${name}`.split(/(\s+)/).map((segment, segmentIndex) =>
                segment.trim() ? (
                  <span className="liquid-title-word" key={`word-${segmentIndex}`}>
                    {Array.from(segment).map((letter, letterIndex) => (
                      <span className="liquid-title-char" key={`${letter}-${letterIndex}`}>
                        {letter}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="liquid-title-space" key={`space-${segmentIndex}`}>
                    {segment}
                  </span>
                ),
              )}
            </span>
            <span aria-hidden="true" className="title-water-ripple" ref={titleRippleRef}>
              <span className="title-ripple-flash" />
              <span className="title-ripple-ring" />
              <span className="title-ripple-ring" />
              <span className="title-ripple-ring" />
              <span className="title-ripple-spark title-ripple-spark-one" />
              <span className="title-ripple-spark title-ripple-spark-two" />
              <span className="title-ripple-spark title-ripple-spark-three" />
              <span className="title-ripple-spark title-ripple-spark-four" />
            </span>
          </h1>
        </div>
        <button className="round-btn" aria-label="View notifications">
          <span className="notification-dot" />
          <Icon name="wave" />
        </button>
      </header>
      <section className="quick-start" aria-labelledby="quick-start-title">
        <div className="quick-start-copy">
          <p className="eyebrow">A GOOD PLACE TO BEGIN</p>
          <h2 id="quick-start-title">Your day, in your own rhythm</h2>
          <p>Log a cycle day, meal, or movement. Your notes stay on this device.</p>
        </div>
        <div className="quick-start-actions">
          <button onClick={() => onQuickAction("period")} type="button">Log a period day</button>
          <button onClick={() => onQuickAction("food")} type="button">Add food</button>
          <button onClick={() => onQuickAction("workout")} type="button">Log a workout</button>
        </div>
      </section>
      <section
        className="hero"
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          const pointerX = (event.clientX - box.left) / box.width
          const pointerY = (event.clientY - box.top) / box.height
          event.currentTarget.style.setProperty(
            "--pupil-x",
            `${Math.max(-4, Math.min(4, (pointerX - 0.5) * 8))}px`,
          )
          event.currentTarget.style.setProperty(
            "--pupil-y",
            `${Math.max(-2, Math.min(2, (pointerY - 0.5) * 4))}px`,
          )
          event.currentTarget.style.setProperty(
            "--mx",
            `${((event.clientX - box.left) / box.width - 0.5) * 18}px`,
          )
          event.currentTarget.style.setProperty(
            "--my",
            `${((event.clientY - box.top) / box.height - 0.5) * 14}px`,
          )
          event.currentTarget.style.setProperty(
            "--water-x",
            `${((event.clientX - box.left) / box.width) * 100}%`,
          )
          event.currentTarget.style.setProperty(
            "--water-y",
            `${((event.clientY - box.top) / box.height) * 100}%`,
          )
        }}
        onPointerLeave={(event) => {
          event.currentTarget.style.setProperty("--mx", "0px")
          event.currentTarget.style.setProperty("--my", "0px")
          event.currentTarget.style.setProperty("--water-x", "50%")
          event.currentTarget.style.setProperty("--water-y", "50%")
          event.currentTarget.style.setProperty("--pupil-x", "0px")
          event.currentTarget.style.setProperty("--pupil-y", "0px")
        }}
      >
        <div className="paint-water" />
        <HeroSurface />
        <div className="nami-foam" aria-hidden="true">
          <svg className="nami-foam-art" viewBox="0 0 1440 110" preserveAspectRatio="none">
          <path
            d="M0 42c90-5 153 3 237 0s146-4 230 0 153 3 234-1 154-4 235 0 155 3 238 0 166-4 266 1v68H0Z"
            fill="#e9fff5"
            opacity=".96"
          />
          <path
            d="M0 42c90-5 153 3 237 0s146-4 230 0 153 3 234-1 154-4 235 0 155 3 238 0 166-4 266 1"
            fill="none"
            stroke="#ffffff"
            strokeWidth="10"
            strokeLinecap="round"
            opacity=".95"
          />
          <g fill="#f5fff8">
            <circle className="nami-foam-bubble" cx="44" cy="40" r="15" />
            <circle className="nami-foam-bubble" cx="154" cy="39" r="11" />
            <circle className="nami-foam-bubble" cx="276" cy="41" r="14" />
            <circle className="nami-foam-bubble" cx="402" cy="39" r="10" />
            <circle className="nami-foam-bubble" cx="528" cy="41" r="14" />
            <circle className="nami-foam-bubble" cx="657" cy="40" r="11" />
            <circle className="nami-foam-bubble" cx="786" cy="39" r="15" />
            <circle className="nami-foam-bubble" cx="916" cy="41" r="10" />
            <circle className="nami-foam-bubble" cx="1048" cy="40" r="14" />
            <circle className="nami-foam-bubble" cx="1180" cy="39" r="11" />
            <circle className="nami-foam-bubble" cx="1310" cy="41" r="15" />
            <circle className="nami-foam-bubble" cx="1402" cy="39" r="12" />
          </g>
          </svg>
        </div>
        <div className="water-strokes" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <svg
          className="wave-crest"
          viewBox="0 0 1440 260"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="wave-crest-shadow"
            d="M0 92 C160 12 244 150 400 128 S642 214 814 124 1032 38 1188 92 1358 158 1440 72 L1440 260 0 260Z"
          />
          <path
            className="wave-crest-light"
            d="M0 88 C160 8 244 146 400 124 S642 210 814 120 1032 34 1188 88 1358 154 1440 68"
          />
          <path
            className="wave-crest-foam"
            d="M0 104 C160 24 244 162 400 140 S642 226 814 136 1032 50 1188 104 1358 170 1440 84"
          />
          <path
            className="wave-crest-current"
            d="M0 132 C180 62 285 196 465 160 S715 236 900 158 1130 77 1290 126 1395 174 1440 118"
          />
        </svg>
        <div className="sun-disc" />
        <Oracle />
        <div className="hero-copy">
          <span className="oracle-label">A note from Nami</span>
          <p className="nami-tip">{namiTip}</p>
        </div>
      </section>
      <ShoalGarden fish={fish} onRenameFish={onRenameFish} />
      <section className="oracle-chat reveal-card">
        <div className="oracle-chat-head">
          <button
            aria-label="Nudge Nami for a note"
            className="oracle-avatar"
            onClick={nudgeNami}
            type="button"
          >
            <img src={chibiAvatarImage} alt="" draggable={false} loading="lazy" />
          </button>
          <div>
            <p className="eyebrow"><CurvedBubbleText text="ASK NAMI" align="start" maxChars={16} fontSize={10} /></p>
            <strong><CurvedBubbleText text="Your cycle & training oracle" align="start" maxChars={32} fontSize={15} /></strong>
          </div>
          <i><CurvedBubbleText text="ONLINE" maxChars={12} fontSize={9} /></i>
        </div>
        <p className="oracle-answer">{answer}</p>
        <small className="oracle-privacy-note"><CurvedBubbleText text="Answers reflect your saved logs, not medical advice." align="start" maxChars={44} fontSize={10} /></small>
        <div className="prompt-chips">
          <button onClick={() => askOracle("How should I train?")}>
            <CurvedBubbleText text="Training insight" maxChars={20} fontSize={10} />
          </button>
          <button onClick={() => askOracle("Why am I craving food?")}>
            <CurvedBubbleText text="Food patterns" maxChars={18} fontSize={10} />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (question.trim()) askOracle(question)
          }}
        >
          <input
            aria-label="Ask Nami a question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask Nami anything..."
          />
          <button type="submit" aria-label="Send question">
            ↑
          </button>
        </form>
      </section>
      {suggestedExercises[0] && (
        <>
          <section className="section-head">
            <div>
              <p className="eyebrow">TODAY’S SUGGESTED FLOW</p>
              <h2>Flow, don’t force</h2>
            </div>
          </section>
          <article className="workout-card history-workout-card">
            <div className="workout-art">
              <Icon name="training" size={28} />
            </div>
            <div>
              <span>BASED ON YOUR RECENT LOGS</span>
              <strong>{suggestedExercises[0].name}</strong>
              <small>
                Logged {suggestedExercises[0].count}{" "}
                {suggestedExercises[0].count === 1 ? "time" : "times"} · last on{" "}
                {new Date(`${suggestedExercises[0].lastLogged}T12:00:00`).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric" },
                )}
              </small>
            </div>
          </article>
        </>
      )}
    </main>
  )
}

const workoutCatalog = {
  Machines: [
    "Leg press",
    "Hack squat",
    "Leg extension",
    "Seated leg curl",
    "Lying leg curl",
    "Hip abductor",
    "Hip adductor",
    "Glute drive",
    "Calf raise",
    "Chest press",
    "Pec deck",
    "Lat pulldown",
    "Seated cable row",
    "Shoulder press",
    "Assisted pull-up",
    "Cable crossover",
    "Smith machine",
  ],
  Strength: [
    "Back squat",
    "Front squat",
    "Deadlift",
    "Romanian deadlift",
    "Hip thrust",
    "Bench press",
    "Overhead press",
    "Bent-over row",
    "Pull-up",
    "Push-up",
    "Bulgarian split squat",
    "Walking lunge",
    "Biceps curl",
    "Triceps extension",
    "Kettlebell swing",
  ],
  Cardio: [
    "Treadmill run",
    "Incline walk",
    "Stationary bike",
    "Elliptical",
    "Stair climber",
    "Rowing machine",
    "Ski erg",
    "Swimming",
    "Outdoor run",
    "Hiking",
    "Jump rope",
  ],
  Mobility: [
    "Yoga flow",
    "Pilates",
    "Dynamic stretching",
    "Foam rolling",
    "Breathwork",
    "Core stability",
    "Mobility flow",
    "Barre",
  ],
}

interface ExerciseDraft {
  name: string
  type: "cardio" | "strength"
  sets: string
  reps: string
  weight: string
  durationMinutes: string
  distanceMiles: string
}

function WorkoutBuilder({
  close,
  onSave,
}: {
  close: () => void
  onSave: (workout: WorkoutLog) => void
}) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<ExerciseDraft[]>([
    {
      name: "Leg press",
      type: "strength",
      sets: "3",
      reps: "10",
      weight: "",
      durationMinutes: "",
      distanceMiles: "",
    },
  ])
  const [formError, setFormError] = useState("")
  const updateExercise = (
    name: string,
    field: keyof Omit<ExerciseDraft, "name">,
    value: string,
  ) => {
    setSelected((current) =>
      current.map((exercise) =>
        exercise.name === name ? { ...exercise, [field]: value } : exercise,
      ),
    )
  }
  const saveWorkout = () => {
    if (selected.length === 0) {
      setFormError("Add at least one exercise before saving.")
      return
    }
    const exercises = selected.map((exercise) => {
      if (exercise.type === "cardio") {
        return {
          id: createLocalId(),
          name: exercise.name,
          type: "cardio" as const,
          durationMinutes: exercise.durationMinutes.trim()
            ? Number(exercise.durationMinutes)
            : null,
          distanceMiles: exercise.distanceMiles.trim()
            ? Number(exercise.distanceMiles)
            : null,
        }
      }

      return {
        id: createLocalId(),
        name: exercise.name,
        sets: Number(exercise.sets),
        reps: Number(exercise.reps),
        weight: exercise.weight.trim() ? Number(exercise.weight) : null,
        weightUnit: "lb" as const,
      }
    })
    const invalidExercise = selected.some((exercise) => {
      if (exercise.type === "cardio") {
        const duration = exercise.durationMinutes.trim()
          ? Number(exercise.durationMinutes)
          : null
        const distance = exercise.distanceMiles.trim()
          ? Number(exercise.distanceMiles)
          : null
        const hasMeasurement =
          (duration !== null && duration > 0) ||
          (distance !== null && distance > 0)
        return (
          (duration !== null &&
            (!Number.isInteger(duration) || duration < 0)) ||
          (distance !== null && (!Number.isFinite(distance) || distance < 0)) ||
          !hasMeasurement
        )
      }
      const sets = Number(exercise.sets)
      const reps = Number(exercise.reps)
      const weight = exercise.weight.trim() ? Number(exercise.weight) : null
      return (
        !Number.isInteger(sets) ||
        sets < 1 ||
        !Number.isInteger(reps) ||
        reps < 1 ||
        (weight !== null && (!Number.isFinite(weight) || weight < 0))
      )
    })
    if (invalidExercise) {
      setFormError(
        "Enter valid sets and reps with weight in pounds, or a cardio duration and/or distance in miles.",
      )
      return
    }
    onSave({
      id: createLocalId(),
      name: "Training session",
      exercises,
    })
    close()
  }
  const matches = Object.entries(workoutCatalog)
    .flatMap(([group, items]) =>
      items.map((name) => ({
        group,
        name,
        type: group === "Cardio" ? "cardio" as const : "strength" as const,
      })),
    )
    .filter(({ name }) => name.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="sheet-backdrop">
      <section className="builder-sheet">
        <div className="sheet-handle" />
        <header>
          <div>
            <p className="eyebrow">BUILD YOUR SESSION</p>
            <h2>Add a workout</h2>
          </div>
          <div className="builder-sheet-actions">
            <button className="save-log workout-save" onClick={saveWorkout} type="button">
              <Icon name="check" size={17} /> Save
            </button>
            <button className="sheet-close" onClick={close} type="button">
              Close
            </button>
          </div>
        </header>
        <input
          className="catalog-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search machines & activities"
        />
        <div className="workout-builder-scroll">
          {selected.length > 0 && (
            <div className="selected-exercises">
              <p className="eyebrow">TODAY’S EXERCISES</p>
              {selected.map((exercise) => (
                <div
                  className={`exercise-entry${exercise.type === "cardio" ? " cardio" : ""}`}
                  key={exercise.name}
                >
                <strong>{exercise.name}</strong>
                {exercise.type === "cardio" ? (
                  <>
                    <label>
                      Minutes
                      <input
                        min="0"
                        onChange={(event) =>
                          updateExercise(exercise.name, "durationMinutes", event.target.value)
                        }
                        type="number"
                        value={exercise.durationMinutes}
                      />
                    </label>
                    <label>
                      Miles
                      <input
                        min="0"
                        onChange={(event) =>
                          updateExercise(exercise.name, "distanceMiles", event.target.value)
                        }
                        step="any"
                        type="number"
                        value={exercise.distanceMiles}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Sets
                      <input
                        min="1"
                        onChange={(event) =>
                          updateExercise(exercise.name, "sets", event.target.value)
                        }
                        type="number"
                        value={exercise.sets}
                      />
                    </label>
                    <label>
                      Reps
                      <input
                        min="1"
                        onChange={(event) =>
                          updateExercise(exercise.name, "reps", event.target.value)
                        }
                        type="number"
                        value={exercise.reps}
                      />
                    </label>
                    <label>
                      Lbs
                      <input
                        min="0"
                        onChange={(event) =>
                          updateExercise(exercise.name, "weight", event.target.value)
                        }
                        placeholder="—"
                        step="any"
                        type="number"
                        value={exercise.weight}
                      />
                    </label>
                  </>
                )}
                <button
                  aria-label={`Remove ${exercise.name}`}
                  onClick={() =>
                    setSelected(selected.filter((item) => item.name !== exercise.name))
                  }
                  type="button"
                >
                  ×
                </button>
                </div>
              ))}
            </div>
          )}
          <div className="catalog-list">
            {matches.map(({ group, name, type }, index) => (
              <div key={name}>
                {(index === 0 || matches[index - 1].group !== group) && (
                  <p className="catalog-group">{group}</p>
                )}
                <button
                  className={selected.some((item) => item.name === name) ? "added" : ""}
                  onClick={() => {
                    setSelected((current) =>
                      current.some((item) => item.name === name)
                        ? current.filter((item) => item.name !== name)
                        : [
                            ...current,
                            {
                              name,
                              type,
                              sets: "3",
                              reps: "10",
                              weight: "",
                              durationMinutes: "",
                              distanceMiles: "",
                            },
                          ],
                    )
                    setFormError("")
                  }}
                  type="button"
                >
                  <span>{name}</span>
                  <i>{selected.some((item) => item.name === name) ? "✓" : "+"}</i>
                </button>
              </div>
            ))}
          </div>
          {formError && <p className="food-status food-error" role="alert">{formError}</p>}
        </div>
      </section>
    </div>
  )
}

interface SuggestedExercise {
  name: string
  count: number
  lastLogged: string
  score: number
}

function suggestExercisesFromHistory(dayLogs: DayLogs, today: string): SuggestedExercise[] {
  const todayLog = dayLogs[today] ?? emptyDayLog()
  const loggedToday = new Set(
    todayLog.workouts.flatMap(({ exercises }) =>
      exercises.map(({ name }) => name.trim().toLocaleLowerCase()),
    ),
  )
  const todayTimestamp = Date.parse(`${today}T00:00:00Z`)
  const history = new Map<string, SuggestedExercise>()

  Object.entries(dayLogs).forEach(([date, day]) => {
    const daysAgo = (todayTimestamp - Date.parse(`${date}T00:00:00Z`)) / 86_400_000
    if (daysAgo < 1 || daysAgo > 90) return
    day.workouts.forEach(({ exercises }) => {
      exercises.forEach(({ name }) => {
        const normalizedName = name.trim().toLocaleLowerCase()
        if (!normalizedName || loggedToday.has(normalizedName)) return
        const existing = history.get(normalizedName)
        const count = (existing?.count ?? 0) + 1
        const mostRecent = !existing || date > existing.lastLogged ? date : existing.lastLogged
        const recencyDays = (todayTimestamp - Date.parse(`${mostRecent}T00:00:00Z`)) / 86_400_000
        history.set(normalizedName, {
          name: existing?.name ?? name.trim(),
          count,
          lastLogged: mostRecent,
          score: count * 3 - recencyDays / 30,
        })
      })
    })
  })

  return [...history.values()]
    .sort((first, second) => second.score - first.score || first.name.localeCompare(second.name))
    .slice(0, 3)
}

function Training({
  dayLogs,
  onImportWorkouts,
  onUpdateDayLog,
}: {
  dayLogs: DayLogs
  onImportWorkouts: (workouts: ImportedWorkout[]) => void
  onUpdateDayLog: DayLogUpdater
}) {
  const [builderOpen, setBuilderOpen] = useState(false)
  const [importError, setImportError] = useState("")
  const today = localDateKey(new Date())
  const todayLog = dayLogs[today] ?? emptyDayLog()
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const weekStartKey = localDateKey(weekStart)
  const workoutsThisWeek = Object.entries(dayLogs)
    .filter(([date]) => date >= weekStartKey && date <= today)
    .flatMap(([, day]) => day.workouts)
  const exerciseCount = workoutsThisWeek.reduce(
    (total, workout) => total + workout.exercises.length,
    0,
  )
  const suggestedExercises = suggestExercisesFromHistory(dayLogs, today)
  const importCsv = async (file: File | undefined) => {
    if (!file) return
    try {
      onImportWorkouts(parseWorkoutCsv(await file.text()))
      setImportError("")
    } catch (reason) {
      setImportError(
        reason instanceof Error ? reason.message : "Could not import that workout CSV.",
      )
    }
  }

  return (
    <main className="screen page-section content-section" id="training">
      <header>
        <div>
          <p className="eyebrow">YOUR MOVEMENT</p>
          <h1>Training tides</h1>
        </div>
        <button className="round-btn" onClick={() => setBuilderOpen(true)}>
          <Icon name="plus" />
        </button>
      </header>
      <section className="depth-intro reveal-card">
        <div className="depth-orb">
          <Icon name="training" size={32} />
        </div>
        <p>Build around your energy, not against it.</p>
      </section>
      <button className="build-workout reveal-card" onClick={() => setBuilderOpen(true)}>
        <Icon name="plus" size={18} /> Build & log a workout
      </button>
      <label className="food-import workout-import">
        <span>Import workout CSV</span>
        <input
          accept=".csv,text/csv"
          onChange={(event) => {
            void importCsv(event.currentTarget.files?.[0])
            event.currentTarget.value = ""
          }}
          type="file"
        />
      </label>
      <p className="workout-import-hint">Date and Exercise required. Add Sets/Reps for strength or Minutes/Miles for cardio.</p>
      {importError && <p className="food-status food-error" role="alert">{importError}</p>}
      <section className="stat-grid reveal-card">
        <div>
          <small><CurvedBubbleText text="THIS WEEK" maxChars={16} fontSize={9} /></small>
          <b><CurvedBubbleText text={String(workoutsThisWeek.length)} maxChars={8} fontSize={25} /></b>
          <span><CurvedBubbleText text="sessions" maxChars={14} fontSize={9} /></span>
        </div>
        <div>
          <small><CurvedBubbleText text="EXERCISES" maxChars={16} fontSize={9} /></small>
          <b><CurvedBubbleText text={String(exerciseCount)} maxChars={8} fontSize={25} /></b>
          <span><CurvedBubbleText text="logged this week" maxChars={22} fontSize={9} /></span>
        </div>
        <div>
          <small><CurvedBubbleText text="TODAY" maxChars={12} fontSize={9} /></small>
          <b><CurvedBubbleText text={String(todayLog.workouts.length)} maxChars={8} fontSize={25} /></b>
          <span><CurvedBubbleText text="sessions" maxChars={14} fontSize={9} /></span>
        </div>
      </section>
      <h2 className="list-title"><CurvedBubbleText text="Logged today" maxChars={22} fontSize={22} /></h2>
      {todayLog.workouts.length === 0 ? (
        <div className="training-empty">
          <CurvedBubbleText
            className="training-empty-message"
            text="Your workouts will appear here after you save a session."
            maxChars={34}
            fontSize={16}
          />
        </div>
      ) : (
        todayLog.workouts.map((workout) => (
          <div className="workout-log-card" key={workout.id}>
            <strong><CurvedBubbleText text={workout.name} align="start" maxChars={30} fontSize={14} /></strong>
            <small><CurvedBubbleText
              text={workout.exercises
                .map((exercise) => {
                  if (exercise.type === "cardio") {
                    const metrics = [
                      exercise.durationMinutes ? `${exercise.durationMinutes} min` : null,
                      exercise.distanceMiles ? `${exercise.distanceMiles} mi` : null,
                    ].filter((metric): metric is string => metric !== null)
                    return `${exercise.name} · ${metrics.join(" · ")}`
                  }
                  const details = `${exercise.sets} × ${exercise.reps}`
                  const weight =
                    exercise.weight === null || exercise.weight === undefined
                      ? ""
                      : ` · ${exercise.weight} ${exercise.weightUnit}`
                  return `${exercise.name} · ${details}${weight}`
                })
                .join(" / ")}
              maxChars={54}
              fontSize={11}
              align="start"
            /></small>
          </div>
        ))
      )}
      {suggestedExercises.length > 0 && (
        <>
          <h2 className="list-title">Today’s suggested flow</h2>
          {suggestedExercises.map(({ name, count, lastLogged }) => (
            <div className="list-card history-suggestion" key={name}>
              <span className="list-icon"><Icon name="training" /></span>
              <span>
                <strong>{name}</strong>
                <small>
                  Logged {count} {count === 1 ? "time" : "times"} · last on{" "}
                  {new Date(`${lastLogged}T00:00:00`).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </small>
              </span>
            </div>
          ))}
        </>
      )}
      {builderOpen && (
        <WorkoutBuilder
          close={() => setBuilderOpen(false)}
          onSave={(workout) =>
            onUpdateDayLog(today, (day) => ({
              ...day,
              workouts: [...day.workouts, workout],
            }))
          }
        />
      )}
    </main>
  )
}

function FoodLog({
  foods,
  onAddFood,
  onRemoveFood,
  onImportFoods,
}: {
  foods: TrackedFood[]
  onAddFood: (food: TrackedFood) => void
  onRemoveFood: (foodId: string) => void
  onImportFoods: (foods: ImportedFood[]) => void
}) {
  const [query, setQuery] = useState("")
  const [meal, setMeal] = useState<TrackedFood["meal"]>("Snack")
  const [results, setResults] = useState<FoodSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [importError, setImportError] = useState("")
  const [customName, setCustomName] = useState("")
  const [ingredients, setIngredients] = useState<FoodSearchResult[]>([])

  useEffect(() => {
    const search = query.trim()
    if (search.length < 2) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError("")
      setResults([])
      void searchFoodData(search, controller.signal)
        .then(setResults)
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setResults([])
            setError(reason instanceof Error ? reason.message : "Food search failed.")
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const addFood = (food: FoodSearchResult) => {
    const nutrientValue = (id: number) => getNutrient(food, id)?.value ?? null
    onAddFood({
      id: `fdc-${food.fdcId}-${createLocalId()}`,
      name: food.description,
      meal,
      note: [food.brandName, food.dataType].filter(Boolean).join(" · "),
      calories: nutrientValue(1008),
      proteinGrams: nutrientValue(1003),
      carbohydrateGrams: nutrientValue(1005),
      fatGrams: nutrientValue(1004),
      source: "fooddata",
      externalId: String(food.fdcId),
    })
    setQuery("")
    setResults([])
  }

  const addIngredient = (food: FoodSearchResult) => {
    setIngredients((current) =>
      current.some((ingredient) => ingredient.fdcId === food.fdcId)
        ? current
        : [...current, food]
    )
  }

  const ingredientTotals = ingredients.reduce(
    (totals, ingredient) => ({
      calories: totals.calories + (getNutrient(ingredient, 1008)?.value ?? 0),
      proteinGrams: totals.proteinGrams + (getNutrient(ingredient, 1003)?.value ?? 0),
      carbohydrateGrams: totals.carbohydrateGrams + (getNutrient(ingredient, 1005)?.value ?? 0),
      fatGrams: totals.fatGrams + (getNutrient(ingredient, 1004)?.value ?? 0),
    }),
    { calories: 0, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 0 },
  )

  const saveCustomFood = () => {
    const name = customName.trim()
    if (!name || ingredients.length === 0) return
    const ingredientNames = ingredients.map((ingredient) => ingredient.description).slice(0, 4)
    onAddFood({
      id: `custom-food-${createLocalId()}`,
      name,
      meal,
      note: `Custom food · ${ingredientNames.join(", ")}${ingredients.length > 4 ? ` +${ingredients.length - 4} more` : ""}`,
      calories: Math.round(ingredientTotals.calories),
      proteinGrams: Math.round(ingredientTotals.proteinGrams * 10) / 10,
      carbohydrateGrams: Math.round(ingredientTotals.carbohydrateGrams * 10) / 10,
      fatGrams: Math.round(ingredientTotals.fatGrams * 10) / 10,
      source: "manual",
    })
    setCustomName("")
    setIngredients([])
  }

  const importCsv = async (file: File | undefined) => {
    if (!file) return
    try {
      onImportFoods(parseMyFitnessPalCsv(await file.text()))
      setImportError("")
    } catch (reason) {
      setImportError(
        reason instanceof Error ? reason.message : "Could not import that CSV file.",
      )
    }
  }

  return (
    <section className="food-log reveal-card">
      <div className="section-head">
        <div>
          <p className="eyebrow"><CurvedBubbleText text="USDA FOODDATA CENTRAL" align="start" maxChars={26} fontSize={9} /></p>
          <h2><CurvedBubbleText text="Food & nourishment" align="start" maxChars={26} fontSize={22} /></h2>
        </div>
        <span className="food-total"><CurvedBubbleText text={`${foods.length} logged`} maxChars={14} fontSize={10} /></span>
      </div>
      <p className="food-source-note"><CurvedBubbleText
        text="Search USDA and save foods to this day. Nutrient amounts use each record’s listed basis."
        align="start"
        maxChars={46}
        fontSize={11}
      />
      </p>
      <div className="food-search-row">
        <input
          aria-label="Search foods"
          autoComplete="off"
          onChange={(event) => {
            const value = event.target.value
            setQuery(value)
            if (value.trim().length < 2) {
              setResults([])
              setLoading(false)
              setError("")
            }
          }}
          placeholder="Search foods, e.g. oatmeal"
          type="search"
          value={query}
        />
        <select
          aria-label="Meal"
          onChange={(event) => setMeal(event.target.value as TrackedFood["meal"])}
          value={meal}
        >
          {["Breakfast", "Lunch", "Dinner", "Snack"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="food-status"><CurvedBubbleText text="Enter at least 2 characters to search." maxChars={36} fontSize={10} /></p>
      )}
      {loading && <p className="food-status"><CurvedBubbleText text="Searching USDA foods…" maxChars={26} fontSize={10} /></p>}
      {error && (
        <p className="food-status food-error" role="alert"><CurvedBubbleText text={error} maxChars={44} fontSize={10} /></p>
      )}
      {importError && (
        <p className="food-status food-error" role="alert"><CurvedBubbleText text={importError} maxChars={44} fontSize={10} /></p>
      )}
      {results.length > 0 && (
        <div className="food-results">
          {results.map((food) => {
            const calories = getNutrient(food, 1008)
            const protein = getNutrient(food, 1003)
            const carbs = getNutrient(food, 1005)
            const fat = getNutrient(food, 1004)
            return (
              <button
                className="food-result"
                key={food.fdcId}
                onClick={() => addFood(food)}
                type="button"
              >
                <span>
                  <strong><CurvedBubbleText text={food.description} align="start" maxChars={38} fontSize={11} /></strong>
                  <small><CurvedBubbleText text={[food.brandName, food.dataType].filter(Boolean).join(" · ")} align="start" maxChars={38} fontSize={9} /></small>
                  <small><CurvedBubbleText text={[
                    calories
                      ? `${Math.round(calories.value)} ${calories.unit}`
                      : "No energy value",
                    protein ? ` · ${Math.round(protein.value)} ${protein.unit} protein` : "",
                    carbs ? ` · ${Math.round(carbs.value)} ${carbs.unit} carbs` : "",
                    fat ? ` · ${Math.round(fat.value)} ${fat.unit} fat` : "",
                  ].join("")}
                    maxChars={46}
                    align="start"
                    fontSize={9}
                  /></small>
                </span>
                <span className="food-result-actions">
                  <button onClick={(event) => { event.stopPropagation(); addIngredient(food) }} type="button">+ Ingredient</button>
                  <button onClick={(event) => { event.stopPropagation(); addFood(food) }} type="button">Save food</button>
                </span>
              </button>
            )
          })}
        </div>
      )}
      <div className="custom-food-builder">
        <div className="custom-food-title">
          <strong><CurvedBubbleText text="Build a custom food" align="start" maxChars={28} fontSize={12} /></strong>
          <small><CurvedBubbleText text="Pick USDA ingredients, then save them as one food." align="start" maxChars={46} fontSize={9} /></small>
        </div>
        {results.length > 0 && (
          <div className="custom-ingredient-results" aria-label="Add USDA ingredients">
            {results.map((food) => (
              <button
                key={`ingredient-${food.fdcId}`}
                onClick={() => addIngredient(food)}
                type="button"
              >
                <CurvedBubbleText text={food.description} maxChars={30} fontSize={9} />
              </button>
            ))}
          </div>
        )}
        {ingredients.length > 0 && (
          <div className="custom-ingredients">
            {ingredients.map((ingredient) => (
              <button
                aria-label={`Remove ${ingredient.description} from custom food`}
                key={ingredient.fdcId}
                onClick={() =>
                  setIngredients((current) =>
                    current.filter((item) => item.fdcId !== ingredient.fdcId)
                  )
                }
                type="button"
              >
                <CurvedBubbleText text={ingredient.description} maxChars={24} fontSize={9} />
              </button>
            ))}
          </div>
        )}
        <div className="custom-food-save-row">
          <input
            aria-label="Custom food name"
            onChange={(event) => setCustomName(event.target.value)}
            placeholder="Name this mix, e.g. salmon rice bowl"
            value={customName}
          />
          <button
            disabled={!customName.trim() || ingredients.length === 0}
            onClick={saveCustomFood}
            title={ingredients.length === 0 ? "Choose Add ingredient from a USDA result first." : "Save this custom food"}
            type="button"
          >
            Save custom food
          </button>
        </div>
        <small className="custom-food-total"><CurvedBubbleText
          text={`${Math.round(ingredientTotals.calories)} kcal · ${Math.round(ingredientTotals.proteinGrams)} g protein · ${Math.round(ingredientTotals.carbohydrateGrams)} g carbs · ${Math.round(ingredientTotals.fatGrams)} g fat · ${ingredients.length} ingredients`}
          maxChars={58}
          fontSize={9}
        /></small>
        {!customName.trim() && ingredients.length > 0 && (
          <small className="custom-food-hint">Name the food to unlock saving.</small>
        )}
      </div>
      {foods.length > 0 && (
        <div className="food-entries">
          {foods.map((entry) => (
            <div className="food-entry" key={entry.id}>
              <span>
                <strong><CurvedBubbleText text={entry.name} align="start" maxChars={36} fontSize={11} /></strong>
                <small><CurvedBubbleText text={`${entry.meal} · ${
                  entry.source === "fooddata"
                    ? "USDA FoodData Central"
                    : entry.note}`}
                  align="start"
                  maxChars={40}
                  fontSize={9}
                /></small>
                <small className="food-entry-macros"><CurvedBubbleText text={[
                  typeof entry.calories === "number" ? `${Math.round(entry.calories)} kcal` : "No kcal",
                  typeof entry.proteinGrams === "number" ? `${Math.round(entry.proteinGrams)} g protein` : null,
                  typeof entry.carbohydrateGrams === "number" ? `${Math.round(entry.carbohydrateGrams)} g carbs` : null,
                  typeof entry.fatGrams === "number" ? `${Math.round(entry.fatGrams)} g fat` : null,
                ].filter(Boolean).join(" · ")} maxChars={50} fontSize={9} align="start" /></small>
              </span>
              <button
                aria-label={`Remove ${entry.name}`}
                onClick={() => onRemoveFood(entry.id)}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="food-import">
        <CurvedBubbleText text="Import MyFitnessPal CSV" maxChars={28} fontSize={10} />
        <input
          accept=".csv,text/csv"
          onChange={(event) => {
            void importCsv(event.currentTarget.files?.[0])
            event.currentTarget.value = ""
          }}
          type="file"
        />
      </label>
    </section>
  )
}

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const DAY_LOG_STORAGE_KEY = "tideline-day-logs"
const FISH_COLLECTION_STORAGE_KEY = "tideline-fish-collection"

function loadFishCollection(): { fish: CollectedFish[]; error: string } {
  try {
    const stored = localStorage.getItem(FISH_COLLECTION_STORAGE_KEY)
    if (!stored) return { fish: [starterFish], error: "" }
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error("Saved fish collection has an invalid format.")
    const fish = parsed.filter(
      (entry): entry is CollectedFish =>
        typeof entry === "object" &&
        entry !== null &&
        "id" in entry &&
        typeof entry.id === "string" &&
        "species" in entry &&
        fishCatalog.some(({ id }) => id === entry.species) &&
        (!("nickname" in entry) || typeof entry.nickname === "string") &&
        "earnedFor" in entry &&
        typeof entry.earnedFor === "string" &&
        (!("variant" in entry) ||
          typeof entry.variant === "string" &&
          fishVariants.some(({ id }) => id === entry.variant)),
    )
    if (fish.length !== parsed.length) {
      throw new Error("Saved fish collection has an invalid format.")
    }
    return { fish: fish.length ? fish : [starterFish], error: "" }
  } catch {
    return {
      fish: [starterFish],
      error: "Saved fish collection could not be read. New catches can still be collected.",
    }
  }
}

function pickFishSpecies(currentFish: CollectedFish[]): FishSpecies {
  if (Math.random() < 0.01) return "yams"
  const available = fishCatalog
    .map(({ id }) => id)
    .filter((species): species is FishSpecies => species !== "yams")
  const uncollected = available.filter(
    (species) => !currentFish.some((entry) => entry.species === species),
  )
  if (uncollected.length) return uncollected[0]
  return available[Math.floor(Math.random() * available.length)]
}

function createLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function loadDayLogs(): { logs: DayLogs; error: string } {
  try {
    return {
      logs: parseDayLogs(localStorage.getItem(DAY_LOG_STORAGE_KEY)),
      error: "",
    }
  } catch {
    return {
      logs: {},
      error: "Saved tracking data could not be read. New entries can still be saved.",
    }
  }
}

type DayLogUpdater = (date: string, update: (day: DayLog) => DayLog) => void

interface TideProfile {
  name: string
  id: string
}

function loadTideProfile(): { profile: TideProfile | null; error: string } {
  try {
    const stored = localStorage.getItem("tideline-profile")
    if (!stored) return { profile: null, error: "" }
    const parsed: unknown = JSON.parse(stored)
    const name =
      typeof parsed === "object" && parsed !== null && "name" in parsed
        ? parsed.name
        : null
    const id =
      typeof parsed === "object" && parsed !== null && "id" in parsed
        ? parsed.id
        : null
    if (
      typeof name !== "string" ||
      typeof id !== "string"
    ) {
      throw new Error("Saved profile has an invalid format.")
    }
    return { profile: { name, id }, error: "" }
  } catch {
    return { profile: null, error: "Saved profile could not be read from this browser." }
  }
}

function loggedCycleStarts(dayLogs: DayLogs): CyclePeriod[] {
  const periodDays = Object.entries(dayLogs)
    .filter(([, day]) => day.period)
    .map(([date]) => date)
    .sort()
  return periodDays
    .filter((date, index) => {
      if (index === 0) return true
      const previous = new Date(`${periodDays[index - 1]}T00:00:00Z`)
      const current = new Date(`${date}T00:00:00Z`)
      return current.getTime() - previous.getTime() > 86_400_000
    })
    .map((startDate) => ({ startDate }))
}

function buildNamiContext(dayLogs: DayLogs): string {
  const today = localDateKey(new Date())
  const recentDates = Object.keys(dayLogs).sort().slice(-14)
  const todayLog = dayLogs[today] ?? emptyDayLog()
  const phase = phaseFor(today, loggedCycleStarts(dayLogs))
  const recentFoods = recentDates.flatMap((date) =>
    dayLogs[date].foods.map((food) => ({
      date,
      name: food.name,
      meal: food.meal,
      category: food.category ?? "Other",
      calories: food.calories ?? null,
      proteinGrams: food.proteinGrams ?? null,
    }))
  )
  const recentWorkouts = recentDates.flatMap((date) =>
    dayLogs[date].workouts.map((workout) => ({
      date,
      name: workout.name,
      exercises: workout.exercises.length,
      cardioMinutes: workout.exercises.reduce(
        (total, exercise) => total + (exercise.type === "cardio" ? exercise.durationMinutes ?? 0 : 0),
        0,
      ),
    }))
  )
  const symptoms = [...new Set(recentDates.flatMap((date) => dayLogs[date].symptoms))].slice(0, 12)
  const feelings = [...new Set(recentDates.flatMap((date) => dayLogs[date].feelings))].slice(0, 12)
  const insights = buildPersonalInsights(dayLogs, [])

  return JSON.stringify({
    date: today,
    estimatedPhase: phase
      ? { phase: phase.phase, cycleDay: phase.cycleDay, cycleLength: phase.cycleLen }
      : null,
    loggedDays: Object.keys(dayLogs).length,
    today: {
      period: todayLog.period,
      foods: todayLog.foods.map((food) => ({
        name: food.name,
        meal: food.meal,
        category: food.category ?? "Other",
        calories: food.calories ?? null,
        proteinGrams: food.proteinGrams ?? null,
      })),
      workouts: todayLog.workouts.map((workout) => ({
        name: workout.name,
        exercises: workout.exercises.length,
      })),
      symptoms: todayLog.symptoms,
      feelings: todayLog.feelings,
    },
    recentFoods: recentFoods.slice(-20),
    recentWorkouts: recentWorkouts.slice(-12),
    symptoms,
    feelings,
    personalInsights: insights.messages.slice(0, 3),
  })
}

function Cycle({
  dayLogs,
  onUpdateDayLog,
  onImportPeriodDates,
  onCompletePeriod,
}: {
  dayLogs: DayLogs
  onUpdateDayLog: DayLogUpdater
  onImportPeriodDates: (dates: string[]) => void
  onCompletePeriod: (date: string) => void
}) {
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()))
  const [periodImportDates, setPeriodImportDates] = useState<string[]>([])
  const [periodImportMessage, setPeriodImportMessage] = useState("")
  const [periodImportError, setPeriodImportError] = useState("")
  const [displayMonth, setDisplayMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )
  const selectedLog = dayLogs[selectedDate] ?? emptyDayLog()
  const estimate = phaseFor(selectedDate, loggedCycleStarts(dayLogs))
  const personalInsights = buildPersonalInsights(dayLogs, [])
  const calendarStart = new Date(
    displayMonth.getFullYear(),
    displayMonth.getMonth(),
    1 - ((displayMonth.getDay() + 6) % 7),
  )
  const calendarDates = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart)
    date.setDate(calendarStart.getDate() + index)
    return date
  })
  const selectedDateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
    undefined,
    { month: "long", day: "numeric" },
  )
  const toggle = (item: string, field: "symptoms" | "feelings") => {
    const values = selectedLog[field]
    const next = values.includes(item)
      ? values.filter((value) => value !== item)
      : [...values, item]
    onUpdateDayLog(selectedDate, (day) => ({ ...day, [field]: next }))
  }
  const readPeriodFile = async (file?: File) => {
    if (!file) return
    setPeriodImportError("")
    setPeriodImportMessage("")
    setPeriodImportDates([])
    if (file.size > 2 * 1024 * 1024) {
      setPeriodImportError("Period files must be smaller than 2 MB.")
      return
    }
    try {
      setPeriodImportDates(parsePeriodDates(await file.text(), file.name))
    } catch (importError) {
      setPeriodImportError(importError instanceof Error ? importError.message : "Could not read that period file.")
    }
  }
  return (
    <main className="screen page-section content-section" id="cycle">
      <header>
        <div>
          <p className="eyebrow">YOUR RHYTHM</p>
          <h1>Cycle compass</h1>
        </div>
        <button className="round-btn">
          <Icon name="plus" />
        </button>
      </header>
      <section className="cycle-card">
        <div className="cycle-top">
          <span>{estimate ? `${estimate.phase} phase · estimate` : "CYCLE ESTIMATE"}</span>
          <small>
            {estimate ? `DAY ${estimate.cycleDay} OF ${estimate.cycleLen}` : "LOG A PERIOD START"}
          </small>
        </div>
        <div className="cycle-orbit-wrap">
          <div className="cycle-orbit">
            <div>
              <b>{estimate ? Math.max(0, estimate.cycleLen - estimate.cycleDay) : "—"}</b>
              <span className="cycle-period-caption">
                <CurvedBubbleText
                  text={estimate ? "days to expected period" : "period starts needed"}
                  maxChars={17}
                  fontSize={9}
                  curveDepth={0.5}
                />
              </span>
            </div>
          </div>
        </div>
        <p>
          {estimate
            ? "Cycle phases are estimates based on the period starts you log."
            : "Log period days below to begin a personal cycle estimate."}
        </p>
      </section>
      <section className="calendar reveal-card">
        <div className="calendar-head">
          <button
            aria-label="Previous month"
            className="calendar-arrow calendar-arrow-previous"
            onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
            type="button"
          />
          <strong>
            {displayMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </strong>
          <button
            aria-label="Next month"
            className="calendar-arrow calendar-arrow-next"
            onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
            type="button"
          />
        </div>
        <div className="week">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="dates">
          {calendarDates.map((date) => (
            <button
              key={localDateKey(date)}
              onClick={() => setSelectedDate(localDateKey(date))}
              className={[
                localDateKey(date) === selectedDate ? "selected" : "",
                date.getMonth() !== displayMonth.getMonth() ? "outside" : "",
                dayLogs[localDateKey(date)]?.period ? "period-day" : "",
              ].filter(Boolean).join(" ")}
            >
              <span>{date.getDate()}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="day-log reveal-card">
        <div className="day-log-title">
          <div>
            <p className="eyebrow"><CurvedBubbleText text={selectedDateLabel.toUpperCase()} align="start" maxChars={20} fontSize={9} /></p>
            <h2><CurvedBubbleText text="How are you feeling today?" align="start" maxChars={32} fontSize={20} /></h2>
          </div>
          <span><CurvedBubbleText text={`${selectedLog.symptoms.length + selectedLog.feelings.length} selected`} maxChars={18} fontSize={10} /></span>
        </div>
        <button
          className={`period-toggle${selectedLog.period ? " active" : ""}`}
          onClick={() => {
            if (!selectedLog.period) {
              onUpdateDayLog(selectedDate, (day) => ({ ...day, period: true }))
              return
            }
            if (window.confirm("Has this period ended? Say yes only when you’re ready to complete it and welcome a new fish.")) {
              onCompletePeriod(selectedDate)
            }
          }}
          type="button"
        >
          <CurvedBubbleText
            text={selectedLog.period ? "Period logged · remove" : "Log period"}
            maxChars={26}
            fontSize={12}
          />
        </button>
        <p className="log-label"><CurvedBubbleText text="Symptoms" maxChars={16} fontSize={11} /></p>
        <div className="log-chips">
          {[
            "Cramps",
            "Bloating",
            "Headache",
            "Fatigue",
            "Tenderness",
            "Acne",
            "Backache",
            "Cravings",
          ].map((item) => (
            <button
              key={item}
              className={selectedLog.symptoms.includes(item) ? "active" : ""}
              onClick={() => toggle(item, "symptoms")}
            >
              <CurvedBubbleText text={item} maxChars={14} fontSize={10} />
            </button>
          ))}
        </div>
        <p className="log-label"><CurvedBubbleText text="Feelings" maxChars={16} fontSize={11} /></p>
        <div className="log-chips feelings">
          {[
            "Calm",
            "Energized",
            "Tender",
            "Irritable",
            "Anxious",
            "Focused",
            "Low",
            "Social",
          ].map((item) => (
            <button
              key={item}
              className={selectedLog.feelings.includes(item) ? "active" : ""}
              onClick={() => toggle(item, "feelings")}
            >
              <CurvedBubbleText text={item} maxChars={14} fontSize={10} />
            </button>
          ))}
        </div>
        <p className="save-note"><CurvedBubbleText text="Changes save automatically on this device." maxChars={38} fontSize={10} /></p>
      </section>
      <section className="period-import reveal-card" aria-labelledby="period-import-title">
        <div>
          <p className="eyebrow">PERIOD DATA</p>
          <h2 id="period-import-title">Import cycle history</h2>
        </div>
        <label className="food-import">
          <span>Choose a CSV or JSON file</span>
          <input
            accept=".csv,.json,text/csv,application/json"
            onChange={(event) => {
              void readPeriodFile(event.currentTarget.files?.[0])
              event.currentTarget.value = ""
            }}
            type="file"
          />
        </label>
        <small className="period-import-format">
          CSV: Period Date, or Date and Period. JSON: a periodDates date list or app day-log export.
        </small>
        {periodImportDates.length > 0 && (
          <button
            className="period-toggle"
            onClick={() => {
              onImportPeriodDates(periodImportDates)
              setPeriodImportMessage(`Imported ${periodImportDates.length} period dates.`)
              setPeriodImportDates([])
            }}
            type="button"
          >
            Import {periodImportDates.length} period dates
          </button>
        )}
        {periodImportMessage && <p className="tide-account-status" role="status">{periodImportMessage}</p>}
        {periodImportError && <p className="tide-account-error" role="alert">{periodImportError}</p>}
      </section>
      <section className="personal-insight reveal-card">
        <p className="eyebrow"><CurvedBubbleText text="PERSONAL PATTERN NOTES" align="start" maxChars={26} fontSize={10} /></p>
        <p><CurvedBubbleText text={personalInsights.messages[0]} align="start" maxChars={50} fontSize={12} /></p>
        <small><CurvedBubbleText text={`${personalInsights.cyclesLogged} logged cycle starts`} align="start" maxChars={26} fontSize={10} /></small>
      </section>
    </main>
  )
}

function Food({
  dayLogs,
  onUpdateDayLog,
  onImportFoods,
}: {
  dayLogs: DayLogs
  onUpdateDayLog: DayLogUpdater
  onImportFoods: (foods: ImportedFood[]) => void
}) {
  const today = localDateKey(new Date())
  const todayLog = dayLogs[today] ?? emptyDayLog()
  return (
    <main className="screen page-section content-section" id="food">
      <header>
        <div>
          <p className="eyebrow">NOURISHMENT</p>
          <h1>Food tide</h1>
        </div>
        <span className="list-icon"><Icon name="food" /></span>
      </header>
      <FoodLog
        foods={todayLog.foods}
        onAddFood={(food) =>
          onUpdateDayLog(today, (day) => ({ ...day, foods: [food, ...day.foods] }))
        }
        onRemoveFood={(foodId) =>
          onUpdateDayLog(today, (day) => ({
            ...day,
            foods: day.foods.filter((food) => food.id !== foodId),
          }))
        }
        onImportFoods={onImportFoods}
      />
    </main>
  )
}

function Me({
  profile,
  dayLogs,
  onApplyRemote,
  onLinked,
  onNavigate,
}: {
  profile: TideProfile
  dayLogs: DayLogs
  onApplyRemote: (dayLogs: DayLogs, meta: CycleSyncMeta) => void
  onLinked: (profile: TideProfile) => void
  onNavigate: (id: Tab) => void
}) {
  const [copyError, setCopyError] = useState("")
  const copyProfileId = async () => {
    try {
      await navigator.clipboard.writeText(profile.id)
      setCopyError("")
    } catch {
      setCopyError("Could not copy the ID. Select and copy it manually.")
    }
  }
  return (
    <main className="screen page-section content-section" id="me">
      <header>
        <div>
          <p className="eyebrow">YOUR COVE</p>
          <h1>Me</h1>
        </div>
        <button className="round-btn" aria-label="Settings">
          <Icon name="wave" />
        </button>
      </header>
      <section className="profile-card reveal-card">
        <div className="avatar"><img src={userAvatarImage} alt="" draggable={false} loading="lazy" /></div>
        <div>
          <h2>{profile.name}</h2>
          <p>Your personal space on this browser</p>
        </div>
      </section>
      <section className="id-card reveal-card">
        <p className="eyebrow"><CurvedBubbleText text="YOUR PRIVATE TIDE ID" align="start" maxChars={22} fontSize={10} /></p>
        <div>
          <strong><CurvedBubbleText text={profile.id} align="start" maxChars={32} fontSize={13} /></strong>
          <button onClick={() => void copyProfileId()} type="button"><CurvedBubbleText text="Copy" maxChars={10} fontSize={10} /></button>
        </div>
        <p><CurvedBubbleText
          text="Use your Tide ID with your verified email to sync period data across devices."
          maxChars={46}
          fontSize={11}
          align="start"
        /></p>
      </section>
      <TideAccountPanel
        profile={profile}
        dayLogs={dayLogs}
        onApplyRemote={onApplyRemote}
        onLinked={onLinked}
      />
      {copyError && <p className="food-status food-error" role="alert">{copyError}</p>}
      <h2 className="list-title">Your preferences</h2>
      {[
        ["cycle", "Cycle tracking", "Period starts and daily logs"],
        ["training", "Training goals", "Strength and movement logs"],
        ["moon", "Recovery & sleep", "Not connected in the web version"],
      ].map(([icon, title, value]) => (
        <button
          className="settings-row"
          disabled={icon === "moon"}
          key={title}
          onClick={() => {
            if (icon === "cycle" || icon === "training") onNavigate(icon)
          }}
          type="button"
        >
          <span className={icon === "cycle" ? "calendar-setting-icon" : undefined}>
            <Icon name={icon as "cycle"} />
          </span>
          <div>
                <strong><CurvedBubbleText text={title} align="start" maxChars={24} fontSize={14} /></strong>
                <small><CurvedBubbleText text={value} align="start" maxChars={30} fontSize={10} /></small>
          </div>
          <i><CurvedBubbleText text="›" maxChars={4} fontSize={16} /></i>
        </button>
      ))}
      <p className="storage-note">
        Your profile and tracking logs stay in this browser’s local storage. They are not encrypted or synced.
      </p>
    </main>
  )
}

function Onboarding({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState("")
  const [track, setTrack] = useState(true)
  return (
    <div className="onboarding">
      <div className="onboard-ocean">
        <Oracle />
      </div>
      <div className="onboard-sheet">
        <p className="eyebrow">WELCOME TO RED SEA</p>
        <h1>Train with your rhythm.</h1>
        <p>
          We’ll shape movement around your energy, cycle, and goals—not the
          other way around.
        </p>
        <label>
          What should we call you?
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
          />
        </label>
        <div className="toggle-row">
          <div>
            <strong>Track my cycle</strong>
            <small>Personalize your training insights</small>
          </div>
          <button
            className={track ? "toggle active" : "toggle"}
            onClick={() => setTrack(!track)}
            aria-label="Toggle cycle tracking"
          >
            <i />
          </button>
        </div>
        <button className="primary" onClick={() => onDone(name || "Marina")}>
          Enter the water <span>→</span>
        </button>
        <small className="privacy">
          No account or password. A private Tide ID is created for you.
        </small>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>("today")
  const [pearlHovered, setPearlHovered] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)
  const tabPlungeRef = useRef<HTMLDivElement>(null)
  const tabPlungeTimelineRef = useRef<gsap.core.Timeline | null>(null)
  const [initialProfile] = useState(loadTideProfile)
  const [profile, setProfile] = useState(initialProfile.profile)
  const isNew = profile === null
  const [initialDayLogs] = useState(loadDayLogs)
  const [dayLogs, setDayLogs] = useState(initialDayLogs.logs)
  const dayLogsRef = useRef(initialDayLogs.logs)
  const [initialFishCollection] = useState(loadFishCollection)
  const [fishCollection, setFishCollection] = useState(initialFishCollection.fish)
  const fishCollectionRef = useRef(initialFishCollection.fish)
  const [catchToast, setCatchToast] = useState<{ id: string; message: string } | null>(null)
  const [storageError, setStorageError] = useState(
    initialProfile.error || initialDayLogs.error || initialFishCollection.error,
  )
  const commitDayLogs = (next: DayLogs) => {
    recordCycleLogChanges(dayLogsRef.current, next)
    dayLogsRef.current = next
    setDayLogs(next)
    let saveError = ""
    try {
      localStorage.setItem(DAY_LOG_STORAGE_KEY, JSON.stringify(next))
    } catch {
      saveError = "Your browser could not save tracking data. Check available storage."
    }
    setStorageError(saveError)
  }

  const renameFish = (fishId: string, nickname: string) => {
    const nextFish = fishCollectionRef.current.map((fish) =>
      fish.id === fishId ? { ...fish, nickname } : fish,
    )
    fishCollectionRef.current = nextFish
    setFishCollection(nextFish)
    try {
      localStorage.setItem(FISH_COLLECTION_STORAGE_KEY, JSON.stringify(nextFish))
      setStorageError("")
    } catch {
      setStorageError("Your browser could not save the fish name. Check available storage.")
    }
  }

  const awardPeriodFish = (earnedFor: string) => {
    const currentFish = fishCollectionRef.current
    const species = pickFishSpecies(currentFish)
    const variantCount = currentFish.filter((entry) => entry.variant).length
    const duplicate = currentFish.some((entry) => entry.species === species)
    const variant = duplicate ? fishVariants[variantCount % fishVariants.length] : undefined
    const nextFish = [
      ...currentFish,
      { id: createLocalId(), species, earnedFor, ...(variant ? { variant: variant.id } : {}) },
    ]
    fishCollectionRef.current = nextFish
    setFishCollection(nextFish)
    let saveError = ""
    try {
      localStorage.setItem(FISH_COLLECTION_STORAGE_KEY, JSON.stringify(nextFish))
    } catch {
      saveError = "Your browser could not save the new fish. Check available storage."
    }
    setCatchToast({
      id: createLocalId(),
      message: `You got a ${fishDisplayName(nextFish[nextFish.length - 1]).toLowerCase()}! Your shoal is growing.`,
    })
    setStorageError(saveError)
  }

  const completePeriod = (date: string) => {
    const next = {
      ...dayLogsRef.current,
      [date]: {
        ...(dayLogsRef.current[date] ?? emptyDayLog()),
        period: false,
      },
    }
    commitDayLogs(next)
    awardPeriodFish("Completed period")
  }
  const updateDayLog: DayLogUpdater = (date, update) => {
    const current = dayLogsRef.current
    commitDayLogs({
      ...current,
      [date]: update(current[date] ?? emptyDayLog()),
    })
  }
  const importFoods = (foods: ImportedFood[]) => {
    commitDayLogs(mergeImportedFoods(dayLogsRef.current, foods))
  }
  const importPeriodDates = (dates: string[]) => {
    commitDayLogs(mergePeriodDates(dayLogsRef.current, dates))
  }
  const applyRemoteCycleLogs = (next: DayLogs, meta: CycleSyncMeta) => {
    if (next !== dayLogsRef.current) {
      dayLogsRef.current = next
      setDayLogs(next)
      try {
        localStorage.setItem(DAY_LOG_STORAGE_KEY, JSON.stringify(next))
      } catch {
        setStorageError("Your browser could not save synced tracking data. Check available storage.")
      }
    }
    writeCycleSyncMeta(meta)
  }
  const linkTideProfile = (nextProfile: TideProfile) => {
    setProfile(nextProfile)
    try {
      localStorage.setItem("tideline-profile", JSON.stringify(nextProfile))
    } catch {
      setStorageError("Your browser could not save the linked profile. Check available storage.")
    }
  }
  const finish = (name: string) => {
    try {
      const nextProfile = {
        name: name.trim() || "Marina",
        id: `TIDE-${createLocalId().slice(0, 8).toUpperCase()}`,
      }
      localStorage.setItem(
        "tideline-profile",
        JSON.stringify(nextProfile),
      )
      setProfile(nextProfile)
      setStorageError("")
    } catch {
      setStorageError("Your browser could not save your profile. Check available storage.")
    }
  }
  const scrollToSection = (id: Tab) => {
    setTab(id)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  const playTabPlunge = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const overlay = tabPlungeRef.current
    if (!overlay) return

    tabPlungeTimelineRef.current?.kill()
    const coral = overlay.querySelector(".tab-plunge-coral")
    const ascii = overlay.querySelector(".tab-plunge-ascii")
    const bubbles = overlay.querySelectorAll<HTMLElement>(".tab-plunge-bubble")
    if (!coral || !ascii || bubbles.length === 0) return

    gsap.set([coral, ascii, ...bubbles], { clearProps: "transform,opacity" })
    const timeline = gsap.timeline({
      onComplete: () => {
        gsap.set(overlay, { autoAlpha: 0 })
        tabPlungeTimelineRef.current = null
      },
    })
    tabPlungeTimelineRef.current = timeline
    timeline.set(overlay, { autoAlpha: 1 })
    timeline.fromTo(
      coral,
      { y: 70, scale: 0.78, autoAlpha: 0 },
      { y: -24, scale: 1.08, autoAlpha: 0.42, duration: 0.72, ease: "power2.out" },
      0,
    )
    timeline.to(coral, { y: -150, scale: 1.18, autoAlpha: 0, duration: 0.64, ease: "power1.in" }, 0.62)
    timeline.fromTo(
      ascii,
      { y: 14, autoAlpha: 0 },
      { y: -24, autoAlpha: 0.3, duration: 0.48, ease: "power2.out" },
      0.08,
    )
    timeline.to(ascii, { y: -58, autoAlpha: 0, duration: 0.68, ease: "power1.in" }, 0.55)
    bubbles.forEach((bubble, index) => {
      const rise = window.innerHeight * (0.6 + (index % 4) * 0.1)
      const start = index * 0.018
      timeline.fromTo(
        bubble,
        { y: 8, scale: 0.36, autoAlpha: 0 },
        { y: -rise * 0.2, scale: 0.9, autoAlpha: 0.76, duration: 0.22, ease: "power2.out" },
        start,
      )
      timeline.to(
        bubble,
        { y: -rise, scale: 1.12, autoAlpha: 0, duration: 0.98, ease: "power1.out" },
        start + 0.18,
      )
    })
  }

  useGSAP(
    () => {
      const motion = gsap.matchMedia()
      motion.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".hero-copy, .hero .sun-disc", {
          y: 24,
          autoAlpha: 0,
          duration: 1.1,
          delay: 0.2,
          stagger: 0.12,
          ease: "power2.out",
        })
        gsap.to(".paint-water", {
          yPercent: 15,
          ease: "none",
          scrollTrigger: {
            trigger: "#today",
            start: "top top",
            end: "bottom top",
            scrub: 1.2,
          },
        })
        gsap.to(".wave-crest", {
          y: -36,
          ease: "none",
          scrollTrigger: {
            trigger: "#today",
            start: "top top",
            end: "bottom top",
            scrub: 1,
          },
        })
        gsap.to(".nami-foam", {
          x: 9,
          y: -2,
          duration: 2.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
        gsap.to(".nami-foam-bubble", {
          attr: {
            cy: (_, target) => Number(target.getAttribute("cy")) - 7,
          },
          opacity: 0.55,
          duration: 1.3,
          stagger: 0.12,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
        gsap.to(".mermaid-arm-left", {
          rotation: -1.4,
          transformOrigin: "44% 50%",
          duration: 3.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
        gsap.to(".mermaid-tail-bottom", {
          x: 2,
          y: -2,
          duration: 3.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
        gsap.to(".mermaid-arm-right-top", {
          x: 3,
          rotation: 2.2,
          transformOrigin: "57% 52%",
          duration: 2.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
        gsap.to(".mermaid-arm-right-bottom", {
          x: -3,
          rotation: -2.2,
          transformOrigin: "59% 61%",
          duration: 2.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
        gsap.to(".water-strokes i", {
          x: 34,
          y: -18,
          stagger: 0.4,
          duration: 4.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
        gsap.utils.toArray<HTMLElement>(".reveal-card").forEach((card) => {
          gsap.fromTo(
            card,
            { y: 28, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: 0.8,
              ease: "power2.out",
              scrollTrigger: {
                trigger: card,
                start: "top 88%",
                once: true,
              },
            },
          )
        })
        tabs.forEach(({ id }) => {
          const section = document.getElementById(id)
          if (!section) return
          ScrollTrigger.create({
            trigger: section,
            start: "top 44%",
            end: "bottom 44%",
            onToggle: (self) => {
              if (self.isActive) setTab(id)
            },
          })
        })
      })
      return () => motion.revert()
    },
    { scope: pageRef },
  )

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [])

  useEffect(() => {
    if (!catchToast) return
    const timeout = window.setTimeout(() => setCatchToast(null), 3600)
    return () => window.clearTimeout(timeout)
  }, [catchToast])

  return (
    <div
      className={`app depth-${tab}`}
      onClickCapture={(event) => {
        if (!(event.target instanceof Element)) return
        if (event.target.closest(".sound-toggle")) return
        const button = event.target.closest("button")
        if (!button) return
        playUiSound(button.closest(".masthead-links") ? "tab" : "click")
      }}
      ref={pageRef}
    >
      <div className="ocean-background" aria-hidden="true">
        <div className="ocean-sunlight" />
        <div className="ocean-wash ocean-wash-one" />
        <div className="ocean-wash ocean-wash-two" />
        <div className="ocean-depth-shade" />
        <div className="ocean-grain" />
      </div>
      <div className="tab-plunge" ref={tabPlungeRef} aria-hidden="true">
        <img className="tab-plunge-coral" src={auroraCoralImage} alt="" draggable={false} />
        <pre className="tab-plunge-ascii">{`~ ~ ~  .  o  ~ ~ ~  .
  <||>   <>   <||>
   ||   ~~~   ||
 . ~ ~ . o . ~ ~ .`}</pre>
        {Array.from({ length: 22 }, (_, index) => (
          <span
            className="tab-plunge-bubble"
            key={index}
            style={{
              left: `${(index * 47 + 7) % 96}%`,
              top: `${22 + ((index * 31) % 72)}%`,
              width: `${10 + ((index * 7) % 16)}px`,
              height: `${10 + ((index * 7) % 16)}px`,
            }}
          />
        ))}
      </div>
      <header className="masthead">
        <button
          className={`masthead-brand${pearlHovered ? " pearl-hovered" : ""}`}
          onClick={() => scrollToSection("today")}
          onPointerEnter={() => setPearlHovered(true)}
          onPointerLeave={() => setPearlHovered(false)}
          onFocus={() => setPearlHovered(true)}
          onBlur={() => setPearlHovered(false)}
          type="button"
        >
          <span className="brand-mark">
            <img src={pearlImage} alt="" draggable={false} />
            <span
              aria-hidden="true"
              className="brand-pearl-liquid"
              style={{
                clipPath: pearlHovered ? "inset(0 0 0)" : "inset(100% 0 0 0)",
              }}
            />
          </span>
          <span>RED SEA<small>move with your rhythm</small></span>
        </button>
        <nav className="masthead-links" aria-label="Main navigation">
          {tabs.map(({ id, label }) => (
            <button
              aria-current={tab === id ? "location" : undefined}
              className={tab === id ? "active" : ""}
              key={id}
              onClick={() => {
                playTabPlunge()
                scrollToSection(id)
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        <span className="masthead-tide">ready for a deep dive? <i>✳</i></span>
        <SoundToggle />
      </header>

      <TravelingShoal fish={fishCollection} />
      <OceanAscii />

      <div className="website-content">
        {catchToast && (
          <div className="fish-catch-toast" key={catchToast.id} role="status" aria-live="polite">
            <span className="catch-toast-bubble" aria-hidden="true">✦</span>
            {catchToast.message}
          </div>
        )}
        {storageError && (
          <p className="storage-warning" role="alert">{storageError}</p>
        )}
        <Today
          name={profile?.name ?? "friend"}
          dayLogs={dayLogs}
          fish={fishCollection}
          onRenameFish={renameFish}
          onQuickAction={(target) => {
            const targets = {
              period: ".period-toggle",
              food: ".food-log",
              workout: ".build-workout",
            }
            const section = target === "workout" ? "training" : target === "food" ? "food" : "cycle"
            setTab(section)
            const actionTarget = document.querySelector(targets[target])
            if (actionTarget) {
              const targetTop =
                window.scrollY + actionTarget.getBoundingClientRect().top - 150
              window.scrollTo({ top: targetTop, behavior: "smooth" })
            }
          }}
        />
        <Training
          dayLogs={dayLogs}
          onImportWorkouts={(workouts) => {
            commitDayLogs(mergeImportedWorkouts(dayLogsRef.current, workouts))
          }}
          onUpdateDayLog={updateDayLog}
        />
        <Food dayLogs={dayLogs} onUpdateDayLog={updateDayLog} onImportFoods={importFoods} />
        <Cycle
          dayLogs={dayLogs}
          onUpdateDayLog={updateDayLog}
          onImportPeriodDates={importPeriodDates}
          onCompletePeriod={completePeriod}
        />
        {profile && (
          <Me
            profile={profile}
            dayLogs={dayLogs}
            onApplyRemote={applyRemoteCycleLogs}
            onLinked={linkTideProfile}
            onNavigate={scrollToSection}
          />
        )}
        <footer className="site-footer">
          <div className="rock-bed" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <img key={index} src={rockImage} alt="" draggable={false} loading="lazy" />
            ))}
          </div>
          <div className="coral-garden" aria-hidden="true">
            <img className="footer-coral footer-coral-one" src={footerCoralImage} alt="" draggable={false} loading="lazy" />
            <img className="footer-coral footer-coral-two" src={footerCoralImage} alt="" draggable={false} loading="lazy" />
            <img className="footer-coral footer-coral-three" src={footerCoralImage} alt="" draggable={false} loading="lazy" />
          </div>
          <p>Find your flow. Leave room for the ebb.</p>
          <button className="back-to-top" onClick={() => scrollToSection("today")} type="button">Back to the surface ↑</button>
        </footer>
        {isNew && <Onboarding onDone={finish} />}
      </div>
    </div>
  )
}
