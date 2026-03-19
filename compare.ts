import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import Reducto from 'reductoai';

const PDF_URL = 'https://glassmanlab.seas.harvard.edu/papers/patat_CHI23.pdf';

const USER_QUERY =
  'What are the main contributions of this paper, and what user study or evaluation was conducted to validate them?';

const PassageSchema = z.object({
  text: z.string().describe('Verbatim or closely paraphrased passage from the paper.'),
  section: z.string().optional().describe('Section of the paper where this passage appears, if identifiable.'),
});

const PassagesSchema = z.array(PassageSchema);


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

async function runClaude(): Promise<{ latency: string; result: unknown }> {
  const client = new Anthropic();
  const start = Date.now();
  const message = await client.messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: 'You extract relevant passages from academic papers that answer a user query.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'url', url: PDF_URL },
            cache_control: { type: 'ephemeral' },
          } as any,
          {
            type: 'text',
            text: USER_QUERY,
          },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(PassagesSchema),
    },
  });
  const latency = elapsed(start);

  const result = message.parsed_output;

  return { latency, result };
}

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
