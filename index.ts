import 'dotenv/config';
import Reducto from 'reductoai';

const testPdfUrl = 'https://pdfobject.com/pdf/sample.pdf';
const userQuery = 'Please find a sentence that include the word Morbi or mauris.';

async function main() {
  const reducto = new Reducto({
    apiKey: process.env['REDUCTO_API_KEY'],
  });

// TODO: This seems to be over-nested but for now it's what the API seems to want.
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
            description: 'Verbatim quote from the document matching user query.'
          },
        },
      },
    },
  },
};

  const result = await reducto.extract.run({
    input: testPdfUrl,
    instructions: {
      schema: schema,
      system_prompt: `Extract a list of verbatim quotes matching this query, iterating until all matching quotes are found: ${userQuery}`
    },
    settings: {
      alpha: {
        deep_extract: true
      }
    } as any
  });

  // console.log(result);
  if ('result' in result) {
    const quotes = (result.result as any[])[0].quotes;
    console.log(quotes);
  }
}

main();