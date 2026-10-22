// glance bridge — usa a conta logada do Claude Code via Agent SDK,
// o mesmo mecanismo do pi-claude-bridge (@vanillagreen), que roda o
// Claude Code pelo SDK oficial da Anthropic. Sem API key.
import os from "node:os"
import path from "node:path"
import fs from "node:fs"
import { query } from "@anthropic-ai/claude-agent-sdk"

export const SYSTEM = `Leia a tela e responda o que estiver sendo perguntado. A resposta aparece num painel pequeno e é lida de relance.

Formato, sempre nesta ordem:
1. Primeira linha: só a resposta, em uma frase curta (máx. ~12 palavras). Sem negrito, sem título, sem rótulo tipo "Resposta:". Múltipla escolha → a letra e a opção (ex.: "B) 42"). Número → o número com unidade.
2. Depois, só se agregar: até 3 bullets curtos com o porquê ou o passo que importa. Destaque em **negrito** só o termo-chave de cada bullet.
3. Se for código: um bloco \`\`\`linguagem\`\`\` com o código completo, sem explicação depois.

Regras: sem preâmbulo, sem repetir a pergunta, sem conclusão nem resumo no fim, sem títulos (#). Na dúvida, corte. Responda no idioma do conteúdo da tela.`

// cwd vazio para não puxar CLAUDE.md nem settings de projeto
const WORKDIR = path.join(os.tmpdir(), "glance")
fs.mkdirSync(WORKDIR, { recursive: true })

async function* oneMessage(base64Jpeg) {
  yield {
    type: "user",
    message: {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Jpeg } },
        { type: "text", text: "Responda o que está na tela." },
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
      tools: [],                  // sem ferramentas: só lê e responde
      settingSources: [],         // não carrega settings/hooks/MCP do usuário
      maxTurns: 1,
      includePartialMessages: true, // streaming token a token
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
      onError?.(String(msg.result ?? "erro no claude"))
    }
  }
  if (!sawError) onDone?.()
}