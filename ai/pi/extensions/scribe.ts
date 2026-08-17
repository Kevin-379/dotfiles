import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { readFile } from "node:fs/promises"
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"

type AnyRecord = Record<string, unknown>

const SCRIBE_HOST = process.env.SCRIBE_HOST || "https://localhost:24816"
const API_KEY_FILE = process.env.SCRIBE_API_KEY_FILE || `${process.env.HOME}/.scribe/api_key`
const CTX_TTL_MS = 300_000

const registeredModel = new Map<string, string>()
const ctxCache = { at: 0, md: "" }

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8")
  } catch {
    return ""
  }
}

async function apiKey(): Promise<string> {
  return (await readText(API_KEY_FILE)).trim()
}

async function api(path: string, init: { method?: string; body?: string } = {}): Promise<AnyRecord | undefined> {
  if (process.env.SCRIBE_REFLECTION === "1") return undefined
  const key = await apiKey()
  if (!key) return undefined

  try {
    const target = new URL(path, SCRIBE_HOST)
    const body = init.body || ""
    const isLocalTls =
      target.protocol === "https:" && ["localhost", "127.0.0.1", "::1"].includes(target.hostname)
    const request = target.protocol === "https:" ? httpsRequest : httpRequest

    return await new Promise((resolve) => {
      const req = request(
        target,
        {
          method: init.method || "GET",
          headers: {
            Authorization: `Bearer ${key}`,
            ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {}),
          },
          ...(isLocalTls ? { rejectUnauthorized: false } : {}),
        },
        (response) => {
          let data = ""
          response.setEncoding("utf8")
          response.on("data", (chunk: string) => {
            data += chunk
          })
          response.on("end", () => {
            if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) {
              resolve(undefined)
              return
            }
            try {
              resolve(JSON.parse(data) as AnyRecord)
            } catch {
              resolve(undefined)
            }
          })
        },
      )
      req.setTimeout(3000, () => req.destroy())
      req.on("error", () => resolve(undefined))
      if (body) req.write(body)
      req.end()
    })
  } catch {
    return undefined
  }
}

async function readScribeConfig(): Promise<Record<string, string>> {
  const raw = await readText(`${process.env.HOME}/.scribe/config`)
  const out: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (match) out[match[1]] = match[2]
  }
  return out
}

async function devpodName(): Promise<string> {
  const config = await readScribeConfig()
  return process.env.DEVPOD_NAME || config.DEVPOD_NAME || "local"
}

function sessionID(ctx: ExtensionContext): string {
  return ctx.sessionManager.getSessionId()
}

function modelID(ctx: ExtensionContext): string {
  return ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : ""
}

async function registerSession(id: string, model = "", force = false) {
  if (!id) return
  const previous = registeredModel.get(id)
  const next = model || previous || ""
  if (!force && previous !== undefined && next === previous) return

  registeredModel.set(id, next)
  await api("/api/sessions/register", {
    method: "POST",
    body: JSON.stringify({
      devpod_id: await devpodName(),
      session_id: id,
      branch: "unknown",
      harness: "pi",
      agent: "pi",
      model: next,
    }),
  })
}

async function captureModel(ctx: ExtensionContext) {
  const id = sessionID(ctx)
  const model = modelID(ctx)
  if (!id || !model || registeredModel.get(id) === model) return
  await registerSession(id, model)
}

type NudgeResult = { nudge: string; needsRegister: boolean }

function nudgeResult(response: AnyRecord | undefined): NudgeResult {
  return {
    nudge: typeof response?.nudge === "string" ? response.nudge : "",
    needsRegister: response?.needs_register === true,
  }
}

async function checkNudge(id: string): Promise<NudgeResult> {
  return nudgeResult(await api(`/api/sessions/${encodeURIComponent(id)}/check-nudge`))
}

async function checkStopNudge(id: string): Promise<NudgeResult> {
  return nudgeResult(await api(`/api/sessions/${encodeURIComponent(id)}/check-stop-nudge`))
}

async function healRegistration(id: string, needsRegister: boolean) {
  if (!id || !needsRegister) return
  await registerSession(id, "", true)
}

async function contextSnapshot(): Promise<string> {
  const now = Date.now()
  if (ctxCache.md && now - ctxCache.at < CTX_TTL_MS) return ctxCache.md
  const response = await api("/api/context-snapshot")
  const md = typeof response?.context_md === "string" ? response.context_md : ""
  if (md) {
    ctxCache.at = now
    ctxCache.md = md
  }
  return md
}

async function notifyToolUse(id: string, tool: string) {
  if (!id) return
  await api(
    `/api/sessions/${encodeURIComponent(id)}/notify-tool-use?tool_name=${encodeURIComponent(tool)}`,
    { method: "POST" },
  )
}

function injectNextTurn(pi: ExtensionAPI, text: string) {
  if (!text) return
  pi.sendMessage(
    {
      customType: "scribe",
      content: text,
      display: false,
    },
    { deliverAs: "nextTurn" },
  )
}

export default function ScribePlugin(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (process.env.SCRIBE_REFLECTION === "1") return
    const id = sessionID(ctx)
    await registerSession(id, modelID(ctx))

    const context = await contextSnapshot()
    if (context) injectNextTurn(pi, context)
  })

  pi.on("tool_call", async (event, ctx) => {
    if (process.env.SCRIBE_REFLECTION === "1") return
    const id = sessionID(ctx)
    if (!id) return

    await captureModel(ctx)
    await registerSession(id)
    const { nudge, needsRegister } = await checkNudge(id)
    await healRegistration(id, needsRegister)
    injectNextTurn(pi, nudge)
    await notifyToolUse(id, event.toolName)
  })

  pi.on("agent_end", async (_event, ctx) => {
    if (process.env.SCRIBE_REFLECTION === "1") return
    const id = sessionID(ctx)
    if (!id) return

    await captureModel(ctx)
    await registerSession(id)
    const { nudge, needsRegister } = await checkStopNudge(id)
    await healRegistration(id, needsRegister)
    injectNextTurn(pi, nudge)
  })

  pi.on("session_shutdown", async (_event, ctx) => {
    if (process.env.SCRIBE_REFLECTION === "1") return
    const id = sessionID(ctx)
    if (!id) return
    await api("/api/sessions/complete", {
      method: "POST",
      body: JSON.stringify({ session_id: id }),
    })
  })
}
