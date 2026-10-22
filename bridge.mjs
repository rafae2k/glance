// glance bridge — uses your logged-in Claude Code account through the official
// Claude Agent SDK (same approach as pi-claude-bridge by @vanillagreen).
// No API key needed.
import os from "node:os"
import path from "node:path"
import fs from "node:fs"
import { query } from "@anthropic-ai/claude-agent-sdk"

export const SYSTEM = `Read the screen and answer what is being asked. The answer shows in a small panel and is read at a glance.

Format, always in this order:
1. First line: only the answer, in one short sentence (max ~12 words). No bold, no heading, no label like "Answer:". Multiple choice → the letter and the option (e.g. "B) 42"). Number → the number with its unit.
2. Then, only if it adds something: up to 3 short bullets with the why or the step that matters. Put only the key term of each bullet in **bold**.
3. If it's code: one \`\`\`language\`\`\` block with the complete code, no explanation after it.

Rules: no preamble, don't restate the question, no conclusion or summary at the end, no headings (#). When in doubt, cut. Answer in the language of the on-screen content.`

// empty cwd so no CLAUDE.md or project settings get picked up
const WORKDIR = path.join(os.tmpdir(), "glance")
fs.mkdirSync(WORKDIR, { recursive: true })

async function* oneMessage(base64Jpeg) {
  yield {
    type: "user",
    message: {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Jpeg } },
        { type: "text", text: "Answer what is on the screen." },
      ],
    },
    parent_tool_use_id: null,
  }
}

export async function askClaude(base64Jpeg, { onText, onDone, onError, abortController }) {
  const q = query({
    prompt: oneMessage(base64Jpeg),
    options: {
      cwd: WORKDIR,
      model: process.env.GLANCE_MODEL || "sonnet",
      systemPrompt: SYSTEM,
      tools: [],                  // no tools: read and answer only
      settingSources: [],         // don't load the user's settings/hooks/MCP
      maxTurns: 1,
      includePartialMessages: true, // token-by-token streaming
      ...(abortController ? { abortController } : {}),
    },
  })

  let first = true
  let sawError = false
  for await (const msg of q) {
    if (msg.type === "stream_event" && msg.event?.type === "content_block_delta") {
      if (msg.event.delta?.type === "text_delta") {
        onText?.(msg.event.delta.text, first)
        first = false
      }
    } else if (msg.type === "result" && msg.is_error) {
      sawError = true
      onError?.(String(msg.result ?? "claude error"))
    }
  }
  if (!sawError) onDone?.()
}