import "dotenv/config"
import express from "express"
import { rateLimit } from "express-rate-limit"
import path from "node:path"
import { fileURLToPath } from "node:url"

const app = express()
const port = Number(process.env.PORT) || 3001
const apiKey = process.env.FOODDATA_API_KEY?.trim()
const geminiApiKey = process.env.GEMINI_API_KEY?.trim()
const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite"
const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

app.disable("x-powered-by")
app.use(express.json({ limit: "16kb" }))

const foodSearchLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many food searches. Wait a minute and try again." },
})

const namiLimit = rateLimit({
  windowMs: 60_000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Nami needs a minute to swim back. Try again shortly." },
})

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", foodDataConfigured: Boolean(apiKey), namiConfigured: Boolean(geminiApiKey) })
})

app.post("/api/food/search", foodSearchLimit, async (request, response) => {
  const query = request.body?.query
  if (typeof query !== "string" || query.trim().length < 2 || query.trim().length > 100) {
    response.status(400).json({ error: "Enter a food search between 2 and 100 characters." })
    return
  }
  if (!apiKey) {
    response.status(503).json({ error: "Food search is not configured. Add FOODDATA_API_KEY to the server .env file." })
    return
  }

  try {
    const upstream = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          pageSize: 8,
          dataType: ["Foundation", "SR Legacy", "Branded"],
        }),
        signal: AbortSignal.timeout(12000),
      },
    )
    if (!upstream.ok) {
      response.status(upstream.status === 429 ? 503 : 502).json({
        error: upstream.status === 429
          ? "The food database is receiving too many requests. Try again shortly."
          : "The food database could not complete the search.",
      })
      return
    }

    const result = await upstream.json()
    const foods = Array.isArray(result.foods) ? result.foods : []
    response.json({
      foods: foods.map((food) => ({
        fdcId: food.fdcId,
        description: food.description,
        dataType: food.dataType,
        brandName: food.brandName ?? food.brandOwner ?? null,
        nutrients: (Array.isArray(food.foodNutrients) ? food.foodNutrients : [])
          .map((nutrient) => ({
            id: nutrient.nutrientId ?? nutrient.nutrient?.id,
            name: nutrient.nutrientName ?? nutrient.nutrient?.name,
            unit: nutrient.unitName ?? nutrient.nutrient?.unitName,
            value: nutrient.value,
          }))
          .filter((nutrient) => Number.isFinite(nutrient.id) && Number.isFinite(nutrient.value)),
      })),
    })
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError"
    response.status(timedOut ? 504 : 502).json({
      error: timedOut ? "The food database took too long to respond." : "Could not reach the food database.",
    })
  }
})

app.post("/api/nami", namiLimit, async (request, response) => {
  const question = request.body?.question
  const context = request.body?.context
  if (typeof question !== "string" || question.trim().length < 2 || question.trim().length > 500) {
    response.status(400).json({ error: "Ask Nami a question between 2 and 500 characters." })
    return
  }
  if (typeof context !== "string" || context.length > 6000) {
    response.status(400).json({ error: "Nami context has an invalid format." })
    return
  }
  if (!geminiApiKey) {
    response.status(503).json({ error: "Nami AI is not configured. Add GEMINI_API_KEY to the server .env file." })
    return
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "You are Nami, a playful mermaid-like cycle and training companion for the Tideline app. Answer warmly and concisely in 90 words or fewer. Comment on the user's own logged food, workouts, symptoms, feelings, and estimated cycle phase. Be encouraging, never diagnostic, and do not present estimates as medical facts. If the summary lacks enough information, say what the user can log next.",
            }],
          },
          contents: [{
            role: "user",
            parts: [{
              text: `User question: ${question.trim()}\n\nSaved-log summary:\n${context}`,
            }],
          }],
          generationConfig: {
            maxOutputTokens: 220,
            temperature: 0.75,
          },
        }),
        signal: AbortSignal.timeout(18000),
      },
    )
    if (!upstream.ok) {
      response.status(upstream.status === 429 ? 503 : 502).json({
        error: upstream.status === 429
          ? "Nami's AI tide is busy right now. Try again shortly."
          : "Nami could not reach the AI current.",
      })
      return
    }

    const result = await upstream.json()
    const answer = result.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      ?.map((part) => typeof part.text === "string" ? part.text : "")
      ?.join("")
      ?.trim()
    if (!answer) {
      response.status(502).json({ error: "Nami surfaced without an answer. Try asking another way." })
      return
    }
    response.json({ answer })
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError"
    response.status(timedOut ? 504 : 502).json({
      error: timedOut ? "Nami took too long to swim back." : "Could not reach Nami's AI current.",
    })
  }
})

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(projectRoot, "dist")
  app.use(express.static(distPath))
  app.use((request, response, next) => {
    if (request.method !== "GET" || request.path.startsWith("/api/")) {
      next()
      return
    }
    response.sendFile(path.join(distPath, "index.html"))
  })
}

app.use((error, _request, response, next) => {
  if (response.headersSent) {
    next(error)
    return
  }
  const status = Number.isInteger(error?.status) ? error.status : 500
  response.status(status).json({
    error: status === 413
      ? "Request body is too large."
      : status === 400
        ? "Request body must be valid JSON."
        : "The server could not complete the request.",
  })
})

app.listen(port, "0.0.0.0", () => {
  console.log(`Tideline API listening on http://localhost:${port}`)
})
