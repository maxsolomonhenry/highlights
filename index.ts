import fs from "fs";
import 'dotenv/config';
import OpenAI from "openai";
import { pdf } from "pdf-to-img";

const openai = new OpenAI({
  baseURL: 'https://api.deepinfra.com/v1/openai',
  apiKey: process.env.DEEPINFRA_API_KEY,
});

async function main() {
  const pages = await pdf("fixtures/Gebgreegziabher 2025 - SupportingCoadaptiveMachineTeaching.pdf");
  
  for await (const page of pages) {
    const base64Image = page.toString('base64');
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
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
    console.log(completion.choices[0]?.message.content);
    // console.log(completion.usage?.prompt_tokens, completion.usage?.completion_tokens);
    break;
  }

}

main();