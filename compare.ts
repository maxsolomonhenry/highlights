/**
 * compare.ts
 * Compares two approaches for querying an academic PDF:
 *   1. Reducto AI  — sends the PDF URL directly to Reducto's extract API
 *   2. Claude API  — fetches the PDF, passes it as a native document to Claude
 *                    (no OCR step needed; Claude reads the PDF directly)
 *
 * Measures wall-clock latency and prints each response so quality can be judged.
 *
 * Usage:
 *   REDUCTO_API_KEY=<key> npx tsx compare.ts
 *   (ANTHROPIC_API_KEY or ANTHROPIC_BASE_URL must also be set)
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import Reducto from 'reductoai';

// ── Configuration ────────────────────────────────────────────────────────────

// PaTAT paper from Elena Glassman's lab (CHI 2023)
const PDF_URL =
  'https://glassmanlab.seas.harvard.edu/papers/patat_CHI23.pdf';

// A realistic query one would pose to an academic paper
const USER_QUERY =
  'What are the main contributions of this paper, and what user study or evaluation was conducted to validate them?';

// Tool input schema for structured extraction via Claude tool use
const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'extract_passages',
  description: 'Return passages from the document that answer the user query.',
  input_schema: {
    type: 'object',
    properties: {
      passages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Verbatim or closely paraphrased passage from the paper.',
            },
            section: {
              type: 'string',
              description: 'Section of the paper where this passage appears, if identifiable.',
            },
          },
          required: ['text'],
        },
      },
    },
    required: ['passages'],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function elapsed(startMs: number): string {
  const ms = Date.now() - startMs;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printResult(label: string, latency: string, result: unknown) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`APPROACH: ${label}`);
  console.log(`LATENCY:  ${latency}`);
  console.log(`RESULT:`);
  console.log(JSON.stringify(result, null, 2));
}

// ── Approach 1: Reducto ──────────────────────────────────────────────────────

async function runReducto(): Promise<{ latency: string; result: unknown }> {
  const reducto = new Reducto({ apiKey: process.env.REDUCTO_API_KEY });

  const schema = {
    type: 'object',
    properties: {
      quotes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Verbatim or closely paraphrased passage from the paper answering the query.',
            },
            section: {
              type: 'string',
              description: 'Section of the paper where this passage appears, if identifiable.',
            },
          },
          required: ['text'],
        },
      },
    },
  };

  const start = Date.now();
  const response = await reducto.extract.run({
    input: PDF_URL,
    instructions: {
      schema,
      system_prompt: `Extract passages from the document that answer this query. Return all relevant passages: ${USER_QUERY}`,
    },
    settings: { alpha: { deep_extract: true } } as any,
  });
  const latency = elapsed(start);

  const result =
    'result' in response ? (response.result as any[])[0]?.quotes ?? response.result : response;

  return { latency, result };
}

// ── Approach 2: Claude (native PDF, no OCR) ──────────────────────────────────

async function runClaude(): Promise<{ latency: string; result: unknown }> {
  const client = new Anthropic();

  // Pass the PDF URL directly — Claude's API fetches it server-side.
  // No local download or OCR step needed.
  // Structured output via tool use (no prefill required).
  const start = Date.now();
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system:
      'You extract relevant passages from academic papers that answer a user query. ' +
      'Always call the extract_passages tool with your answer.',
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_passages' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'url', url: PDF_URL },
          } as any,
          {
            type: 'text',
            text: USER_QUERY,
          },
        ],
      },
    ],
  });
  const latency = elapsed(start);

  const toolUse = message.content.find((b) => b.type === 'tool_use') as
    | Anthropic.ToolUseBlock
    | undefined;
  const result = (toolUse?.input as any)?.passages ?? toolUse?.input;

  return { latency, result };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('PDF:   ', PDF_URL);
  console.log('QUERY: ', USER_QUERY);
  console.log('\nRunning both approaches in parallel...');

  const [reductoResult, claudeResult] = await Promise.allSettled([
    runReducto(),
    runClaude(),
  ]);

  if (reductoResult.status === 'fulfilled') {
    printResult('Reducto', reductoResult.value.latency, reductoResult.value.result);
  } else {
    console.log('\n── Reducto FAILED ──');
    console.error(reductoResult.reason?.message ?? reductoResult.reason);
  }

  if (claudeResult.status === 'fulfilled') {
    printResult('Claude (native PDF, no OCR)', claudeResult.value.latency, claudeResult.value.result);
  } else {
    console.log('\n── Claude FAILED ──');
    console.error(claudeResult.reason?.message ?? claudeResult.reason);
  }
}

main();
