# Talk to Rajveer — Personal AI Voicebot

A voice bot that answers interview questions the way Rajveer Singh would answer them. Open the page,
tap the mic, ask a question out loud (or type it), and hear Rajveer's answer spoken back.

Built for the 100x.inc AI Engineer take-home assessment.

## What it does

1. You speak (or type) a question in the browser.
2. The audio is sent to a serverless API route.
3. **Groq `whisper-large-v3-turbo`** transcribes it.
4. **Groq `llama-3.3-70b-versatile`**, given Rajveer's persona + your recent conversation, generates an
   answer in Rajveer's voice.
5. **Groq `canopylabs/orpheus-v1-english`** (Orpheus TTS) turns the answer into speech.
6. The transcript and audio are sent back and played in the browser.

Conversation history is kept only in the browser tab (React state) and sent with each request so
follow-up questions like "why?" or "what was the hardest part?" work naturally. Nothing is stored on a
server or database. Click **New Conversation** to clear it.

## Tech stack

- **Frontend:** React + Vite + Tailwind CSS (single-page app, no routing needed)
- **Backend:** one Vercel serverless function (`api/voice.js`, plain Node.js/JavaScript)
- **AI:** Groq API only (STT, LLM, TTS) via the official `groq-sdk`
- No database, no auth, no vector store — the persona is a plain-text system prompt in `lib/persona.js`

## Project structure

```
api/
  voice.js        -> the one backend endpoint: transcribe -> generate -> speak
lib/
  persona.js      -> Rajveer's persona / system prompt (edit this to change answers)
src/
  App.tsx         -> page layout (header, hero, footer)
  components/
    VoiceBot.js   -> mic recording, state machine, transcript, text fallback
    Message.js    -> chat bubble
vercel.json       -> gives the voice function a longer timeout (STT+LLM+TTS take a few seconds)
.env.example
```

## Local setup

```bash
npm install
```

Create `.env.local` in the project root with:

```
GROQ_API_KEY=your_real_groq_api_key_here
```

> The frontend here is a static Vite build (`api/voice.js` is a Vercel serverless function). To run the
> full pipeline locally the easiest option is the Vercel CLI, which serves both the static site and the
> `/api` function together:
>
> ```bash
> npm install -g vercel
> vercel dev
> ```
>
> Running `npm run dev` alone serves only the frontend — voice requests will fail with a 404 because
> there's no Node server for `/api` in plain `vite dev`.

## Environment variable

Only one is required, and it is **server-side only**:

```
GROQ_API_KEY=gsk_...
```

It is never exposed to the browser (no `VITE_`/`NEXT_PUBLIC_` prefix, only read inside `api/voice.js`).

## Deploying to Vercel

1. Push this project to a GitHub repo.
2. Import the repo in Vercel.
3. Vercel auto-detects the Vite build (`npm run build`, output `dist/`) and automatically deploys
   `api/voice.js` as a serverless function — no extra config needed beyond `vercel.json` (already
   included, just sets a longer function timeout).
4. In **Project Settings → Environment Variables**, add:
   - `GROQ_API_KEY` = your Groq API key
5. Deploy. Share the resulting `https://your-app.vercel.app` URL — that's the whole deliverable.

## Testing

Try the example questions from the assessment (spoken or typed):

- "What should we know about your life story in a few sentences?"
- "What's your #1 superpower?"
- "What are the top 3 areas you'd like to grow in?"
- "What misconception do your coworkers have about you?"
- "How do you push your boundaries and limits?"

Then test open-ended ones: "Why AI?", "Why 100x?", "Tell me about your most interesting project",
"What's your biggest failure?", "Why should we hire you?"

Then test follow-ups to confirm memory works, e.g.:
1. "What project are you most proud of?"
2. "Why?"
3. "What was the hardest technical part?"

## Notes on the persona

All personal facts, projects, achievements and tone guidance live in `lib/persona.js`. Edit that file to
correct or expand Rajveer's answers — no other code needs to change.
