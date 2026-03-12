# Highlights

Support and sketch code for dynamic highlighting project.

## TODO
- [x] (once, cached) send PDF to https://deepinfra.com/allenai/olmOCR-2-7B-1025 and get back full-text
- [x] send textbox contents and full-text to Claude (or GPT....), ask for JSON of quotes in response
- [ ] front end POC
- [ ] finesse schema

## Learnings

- Use Zod for structured calls and returns. Can enforce a schema (json) and seems to work well with Claude.
- You have to convert a Pdf to image before sending to deep-infra. Using `pdf-to-img`.
- Deep Infra benefits from explicit instructions to _not_ summarize the text, instead to return text verbatim.