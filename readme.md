# Highlights

Support and sketch code for dynamic highlighting project.

## Overview
A simple project that retrieves structured data in response to a query about a pdf. It accepts a pdf url, [this one](https://pdfobject.com/pdf/sample.pdf) by default, and returns an array of quotes in json matching the query.

To use, run:

`npx tsx index.ts`

This script applies the following query: _"Please find a sentence that include the word Morbi or mauris."_

Use the Reducto API to specify a scheme. It's a bit tricky to get an array, here's what we've landed on for now:
```typescript
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
```

Sample output (given sample prompt and pdf address):
```typescript
[
  { text: 'In mauris.' },
  { text: 'Fusce vulputate ipsum a mauris.' },
  {
    text: 'Morbi elit nunc, facilisis a, mollis a, molestie at, lectus.'
  },
  { text: 'Suspendisse eget mauris eu tellus molestie cursus.' },
  { text: 'Ut sit amet diam suscipit mauris ornare aliquam.' }
]
```

## TODO
- [x] (once, cached) send PDF to https://deepinfra.com/allenai/olmOCR-2-7B-1025 and get back full-text
- [x] send textbox contents and full-text to Claude (or GPT....), ask for JSON of quotes in response
- [ ] situate conceptually in bigger repo
- [ ] front end POC
- [ ] finesse schema

## Learnings
- Reducto can do just about everything, and this dramatically simplifies the pipeline.
- If it can't satisfy your request, Reducto might search the text in its own system prompt to make you happy and return an answer. Beware!
- (If using Claude) use Zod for structured calls and returns. Can enforce a schema (json) and seems to work well with Claude.
- You have to convert a Pdf to image before sending to deep-infra. Using `pdf-to-img`.
- Deep Infra benefits from explicit instructions to _not_ summarize the text, instead to return text verbatim.