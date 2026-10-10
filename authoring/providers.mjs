// LLM providers behind one interface: complete({ system, prompt, name }) -> text.
//   claude - Anthropic API (needs ANTHROPIC_API_KEY or `ant auth login`)
//   openai - OpenAI API, i.e. the models behind ChatGPT (needs OPENAI_API_KEY)
//   manual - no API key: writes the prompt to a file, you paste it into
//            claude.ai or chatgpt.com and save the reply next to it
// SDKs load lazily, so the rest of the repo needs no npm install.

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

export class ManualStepRequired extends Error {
  constructor(promptFile, responseFile) {
    super(`Manual step: paste the contents of\n  ${promptFile}\ninto Claude or ChatGPT, save the full reply as\n  ${responseFile}\nthen run the same command again.`);
    this.promptFile = promptFile;
    this.responseFile = responseFile;
  }
}

export function claudeProvider({ model = "claude-opus-5-5", effort = "high" } = {}) {
  let client;
  return {
    name: `claude:${model}`,
    async complete({ system, prompt }) {
      if (!client) {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        client = new Anthropic();
      }
      // Streaming avoids HTTP timeouts on long outputs. The server-side fallback
      // re-runs a request that a safety classifier declines on a suitable model.
      const stream = client.beta.messages.stream({
        model,
        max_tokens: 64000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort },
        system,
        messages: [{ role: "user", content: prompt }],
      });
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") throw new Error(`Claude declined the request (${message.stop_details?.category ?? "no category"}).`);
      if (message.stop_reason === "max_tokens") throw new Error("Claude hit max_tokens; shorten the brief or split the session.");
      return message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
    },
  };
}

export function openaiProvider({ model = "gpt-5", reasoningEffort } = {}) {
  let client;
  return {
    name: `openai:${model}`,
    async complete({ system, prompt }) {
      if (!client) {
        const { default: OpenAI } = await import("openai");
        client = new OpenAI();
      }
      const response = await client.responses.create({
        model,
        instructions: system,
        input: prompt,
        ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
      });
      return response.output_text;
    },
  };
}

export function manualProvider({ dir = "authoring/out/manual" } = {}) {
  return {
    name: "manual",
    async complete({ system, prompt, name = "step" }) {
      await mkdir(dir, { recursive: true });
      const promptFile = path.join(dir, `${name}.prompt.md`);
      const responseFile = path.join(dir, `${name}.response.md`);
      try {
        await access(responseFile);
        return await readFile(responseFile, "utf8");
      } catch {
        await writeFile(promptFile, `<!-- System instructions -->\n${system}\n\n<!-- Task -->\n${prompt}\n`);
        throw new ManualStepRequired(promptFile, responseFile);
      }
    },
  };
}

export function makeProvider(name, config = {}) {
  const env = process.env;
  switch (name) {
    case "claude":
      return claudeProvider({ ...config.claude, ...(env.CLAUDE_MODEL ? { model: env.CLAUDE_MODEL } : {}) });
    case "openai":
      return openaiProvider({ ...config.openai, ...(env.OPENAI_MODEL ? { model: env.OPENAI_MODEL } : {}) });
    case "manual":
      return manualProvider({ dir: path.join(config.outDir ?? "authoring/out", "manual") });
    default:
      throw new Error(`Unknown provider "${name}" (use claude, openai or manual).`);
  }
}
