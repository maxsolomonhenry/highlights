# Highlights

Support and sketch code for dynamic highlighting project.

## Overview
A simple project that retrieves structured data in response to a query about a pdf. 
The repo contains a sample pdf, as well as an example query. 

To use, run:

`npx tsx index.ts`

This script applies the following query: _"Please find all sentences that include the word user."_
Note that the script breaks after the first page to save on token usage.

We define an output schema using `Zod`, e.g. a list of objects:
```typescript
const QuoteListSchema = z.array(
  z.object({ text: z.string().describe("The retrieved text.") })
);
```

Sample output (given sample prompt and pdf):
```typescript
[
  {
    text: 'A user is iteratively teaching a neuro-symbolic model to distinguish between different concepts (labels).'
  },
  {
    text: "This allows the neuro-symbolic model to learn pattern rules about the label and suggest annotations to unseen data points (2). As the user reads and accepts or rejects model-suggested labels, MoCHA uses an LLM to generate counterfactuals that structurally resemble the original data point and match the user's pattern rules for the differently predicted labels (3)."
  },
  {
    text: 'When the user provides feedback, the process returns to step 1.'
  },
  {
    text: 'The user then assigns labels to the generated counterfactual examples by accepting or rejecting the LLM-generated labels to be used in consecutive model training (5).'
  },
  {
    text: "As the user provides feedback through labeled data, the model iteratively learns and adjusts its decision boundary, to better align with the user's mental model and labeling (6)."
  },
  {
    text: 'Users teach models their concept definition through data labeling, while refining their own understandings throughout the process.'
  }
]
```

## TODO
- [x] (once, cached) send PDF to https://deepinfra.com/allenai/olmOCR-2-7B-1025 and get back full-text
- [x] send textbox contents and full-text to Claude (or GPT....), ask for JSON of quotes in response
- [ ] situate conceptually in bigger repo
- [ ] front end POC
- [ ] finesse schema

## Learnings

- Use Zod for structured calls and returns. Can enforce a schema (json) and seems to work well with Claude.
- You have to convert a Pdf to image before sending to deep-infra. Using `pdf-to-img`.
- Deep Infra benefits from explicit instructions to _not_ summarize the text, instead to return text verbatim.