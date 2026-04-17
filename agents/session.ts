/**
 * RUNTIME — start a session with any agent:
 *   AGENT=frontend_developer TASK="Build the product list component" npm run session
 *
 * After the session completes, any files the agent wrote to /mnt/session/outputs/
 * are downloaded into the project root (preserving relative paths).
 *
 * Requires agents.json to exist (run setup.ts first).
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface AgentsConfig {
  environment_id: string;
  agents: Record<string, { id: string; version: string | number }>;
}

const AGENT_KEY = process.env.AGENT;
const TASK = process.env.TASK;

if (!AGENT_KEY || !TASK) {
  console.error("Usage: AGENT=<key> TASK='<task description>' npm run session");
  console.error(
    "\nAvailable agents: solution_architect, frontend_developer, api_developer,",
  );
  console.error(
    "                  database_architect, security_analyst, qa_tester, technical_writer",
  );
  process.exit(1);
}

const agentsDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(agentsDir);

const config: AgentsConfig = JSON.parse(
  readFileSync(join(agentsDir, "agents.json"), "utf-8"),
);

const agentRef = config.agents[AGENT_KEY];
if (!agentRef) {
  console.error(`Unknown agent: ${AGENT_KEY}`);
  console.error("Available:", Object.keys(config.agents).join(", "));
  process.exit(1);
}

async function downloadOutputs(sessionId: string) {
  // Brief wait for file indexing after session idles
  await new Promise((r) => setTimeout(r, 2000));

  const files = await client.beta.files.list({
    // @ts-expect-error scope_id supported at runtime
    scope_id: sessionId,
    betas: ["managed-agents-2026-04-01"],
  });

  if (!files.data.length) return;

  console.log(`\nDownloading ${files.data.length} output file(s)...`);

  for (const f of files.data) {
    // filename is relative to /mnt/session/outputs/ — preserve structure
    const safeName = f.filename.replace(/^\/mnt\/session\/outputs\//, "");
    if (!safeName || safeName.includes("..")) {
      console.warn(`  Skipping unsafe path: ${f.filename}`);
      continue;
    }

    const dest = join(projectRoot, safeName);
    mkdirSync(dirname(dest), { recursive: true });

    const resp = await client.beta.files.download(f.id);
    writeFileSync(dest, Buffer.from(await resp.arrayBuffer()));
    console.log(`  ✓ ${safeName}`);
  }
}

async function run() {
  console.log(`Starting session with ${AGENT_KEY}...`);

  const session = await client.beta.sessions.create({
    agent: { type: "agent", id: agentRef.id, version: agentRef.version },
    environment_id: config.environment_id,
    title: `${AGENT_KEY}: ${TASK!.slice(0, 60)}`,
  });

  console.log(`Session: ${session.id}\n${"─".repeat(60)}\n`);

  await client.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [
          {
            type: "text",
            text:
              TASK! +
              "\n\nWrite all output files to /mnt/session/outputs/ preserving the project directory structure (e.g. db/migrations/001_schema.sql, api-internal/src/functions/products.ts). Do not write files anywhere else.",
          },
        ],
      },
    ],
  });

  // Poll for events until session reaches a terminal state
  const seen = new Set<string>();
  let afterPage: string | undefined;

  while (true) {
    const page = await (client.beta.sessions.events as any).list(
      session.id,
      afterPage ? { page: afterPage } : {},
    );

    const events: any[] = page.data ?? [];
    let done = false;

    for (const event of events) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);

      switch (event.type) {
        case "agent.message":
          for (const block of event.content ?? []) {
            if (block.type === "text") process.stdout.write(block.text);
          }
          break;

        case "session.status_idle":
          if (event.stop_reason?.type !== "requires_action") {
            console.log(`\n\n${"─".repeat(60)}`);
            await downloadOutputs(session.id);
            console.log(`\nSession complete. ID: ${session.id}`);
            process.exit(0);
          }
          break;

        case "session.status_terminated":
          console.log(`\n\nSession terminated. ID: ${session.id}`);
          await downloadOutputs(session.id);
          process.exit(0);
          break;

        case "session.error":
          console.error("\nSession error:", event);
          process.exit(1);
          break;
      }
    }

    if (page.next_page) {
      afterPage = page.next_page;
    } else {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
