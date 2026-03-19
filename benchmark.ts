import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import Reducto from 'reductoai';
import { writeFileSync, mkdirSync } from 'fs';

// ── PDFs ────────────────────────────────────────────────────────────────────

const PDFS = [
  { name: 'PaTAT',           url: 'https://glassmanlab.seas.harvard.edu/papers/patat_CHI23.pdf' },
  { name: 'ChainForge',      url: 'https://glassmanlab.seas.harvard.edu/papers/chainforge.pdf' },
  { name: 'DynaVis',         url: 'https://glassmanlab.seas.harvard.edu/papers/dynavis.pdf' },
  { name: 'AbstractExplorer', url: 'https://glassmanlab.seas.harvard.edu/papers/abstractexplorer.pdf' },
  { name: 'CorpusStudio',    url: 'https://glassmanlab.seas.harvard.edu/papers/corpusstudio.pdf' },
];

// ── Queries ─────────────────────────────────────────────────────────────────

const QUERIES = [
  'What are the main contributions of this paper, and what user study or evaluation was conducted to validate them?',
  'What system or tool does this paper present, and how does it work?',
  'What are the key findings or results reported in this paper?',
  'What limitations or future work do the authors discuss?',
  'What related work or prior approaches do the authors compare against?',
];

// ── Schema ──────────────────────────────────────────────────────────────────

const PassageSchema = z.object({
  text: z.string().describe('Verbatim or closely paraphrased passage from the paper.'),
  section: z.string().optional().describe('Section of the paper where this passage appears, if identifiable.'),
});

const PassagesSchema = z.array(PassageSchema);

// ── Helpers ─────────────────────────────────────────────────────────────────

function elapsedSec(startMs: number): number {
  return (Date.now() - startMs) / 1000;
}

type Passage = { text: string; section?: string };

interface RunResult {
  approach: string;
  pdf: string;
  query: string;
  latency_s: number;
  num_passages: number;
  passages: Passage[];
  error?: string;
}

// ── Reducto ─────────────────────────────────────────────────────────────────

async function runReducto(pdfUrl: string, query: string): Promise<{ latency_s: number; passages: Passage[] }> {
  const reducto = new Reducto({ apiKey: process.env.REDUCTO_API_KEY });

  const schema = {
    type: 'object',
    properties: {
      quotes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Verbatim or closely paraphrased passage from the paper answering the query.' },
            section: { type: 'string', description: 'Section of the paper where this passage appears, if identifiable.' },
          },
          required: ['text'],
        },
      },
    },
  };

  const start = Date.now();
  const response = await reducto.extract.run({
    input: pdfUrl,
    instructions: {
      schema,
      system_prompt: `Extract passages from the document that answer this query. Return all relevant passages: ${query}`,
    },
    settings: { alpha: { deep_extract: true } } as any,
  });
  const latency_s = elapsedSec(start);

  const passages: Passage[] =
    'result' in response ? (response.result as any[])[0]?.quotes ?? [] : [];

  return { latency_s, passages };
}

// ── Claude ──────────────────────────────────────────────────────────────────

async function runClaude(pdfUrl: string, query: string): Promise<{ latency_s: number; passages: Passage[] }> {
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
            source: { type: 'url', url: pdfUrl },
            cache_control: { type: 'ephemeral' },
          } as any,
          { type: 'text', text: query },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(PassagesSchema),
    },
  });
  const latency_s = elapsedSec(start);

  const passages: Passage[] = (message.parsed_output as Passage[]) ?? [];
  return { latency_s, passages };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync('results', { recursive: true });

  const allResults: RunResult[] = [];
  const total = PDFS.length * QUERIES.length;
  let done = 0;

  for (const pdf of PDFS) {
    for (const query of QUERIES) {
      done++;
      const shortQuery = query.slice(0, 60) + '…';
      console.log(`\n[${done}/${total}] ${pdf.name} — "${shortQuery}"`);

      // Run both in parallel
      const [reductoOut, claudeOut] = await Promise.allSettled([
        runReducto(pdf.url, query),
        runClaude(pdf.url, query),
      ]);

      if (reductoOut.status === 'fulfilled') {
        const r = reductoOut.value;
        console.log(`  Reducto: ${r.latency_s.toFixed(1)}s, ${r.passages.length} passages`);
        allResults.push({
          approach: 'Reducto', pdf: pdf.name, query,
          latency_s: r.latency_s, num_passages: r.passages.length, passages: r.passages,
        });
      } else {
        console.log(`  Reducto: FAILED — ${(reductoOut.reason as Error)?.message}`);
        allResults.push({
          approach: 'Reducto', pdf: pdf.name, query,
          latency_s: 0, num_passages: 0, passages: [], error: (reductoOut.reason as Error)?.message,
        });
      }

      if (claudeOut.status === 'fulfilled') {
        const c = claudeOut.value;
        console.log(`  Claude:  ${c.latency_s.toFixed(1)}s, ${c.passages.length} passages`);
        allResults.push({
          approach: 'Claude', pdf: pdf.name, query,
          latency_s: c.latency_s, num_passages: c.passages.length, passages: c.passages,
        });
      } else {
        console.log(`  Claude:  FAILED — ${(claudeOut.reason as Error)?.message}`);
        allResults.push({
          approach: 'Claude', pdf: pdf.name, query,
          latency_s: 0, num_passages: 0, passages: [], error: (claudeOut.reason as Error)?.message,
        });
      }
    }
  }

  // ── Write CSV ───────────────────────────────────────────────────────────
  const csvHeader = 'approach,pdf,query,latency_s,num_passages,error';
  const csvRows = allResults.map(r =>
    [r.approach, r.pdf, `"${r.query}"`, r.latency_s.toFixed(2), r.num_passages, r.error ?? ''].join(',')
  );
  writeFileSync('results/benchmark.csv', [csvHeader, ...csvRows].join('\n'));
  console.log('\n✓ Wrote results/benchmark.csv');

  // ── Write raw quotes JSON ──────────────────────────────────────────────
  writeFileSync('results/benchmark_quotes.json', JSON.stringify(allResults, null, 2));
  console.log('✓ Wrote results/benchmark_quotes.json');
}

main();
