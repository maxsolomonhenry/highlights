import fs from "fs";
import 'dotenv/config';
import OpenAI from "openai";
import { pdf } from "pdf-to-img";
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

const testFilePath = "fixtures/Gebgreegziabher 2025 - SupportingCoadaptiveMachineTeaching.pdf";
const userQuery = "Please find all sentences that include the word user.";

const openai = new OpenAI({
  baseURL: 'https://api.deepinfra.com/v1/openai',
  apiKey: process.env.DEEPINFRA_API_KEY,
});

const client = new Anthropic();

const QuoteSchema = z.object({
  text: z.string().describe("The retrieved text.")
})

const QuoteListSchema = z.array(QuoteSchema);

async function main() {
  console.log("Converting to image...");
  const pages = await pdf(testFilePath);
  
  const texts: string[] = [];

  console.log("Performing OCR...")
  for await (const page of pages) {
    const base64Image = page.toString('base64');
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Return the plain text content of this page exactly as written. Do not summarize or describe the page."
            },
            {
              type: "image_url",
              image_url: {
                "url": `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      model: "allenai/olmOCR-2-7B-1025",
      max_tokens: 4092,
    });
    const text = completion.choices[0]?.message.content ?? "" ;
    texts.push(text);

    // Debugging
    break;
  }
  const fullText = texts.join("\n");
  console.log(fullText);

  console.log("Prompting Claude...")
  // https://platform.claude.com/docs/en/build-with-claude/structured-outputs
  const message = await client.messages.parse({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: "You extract quotes verbatim from a given document that respond to a user query.",
    messages: [
      {
        role: "user",
        content: `<document>\n${fullText}\n</document>\n\n${userQuery}`
      }
    ],
    output_config: {
      format: zodOutputFormat(QuoteListSchema),
    },
  });

  const quotes = message.parsed_output;
  console.log(quotes);

}

main();