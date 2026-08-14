// Single Vercel serverless function powering the whole voice pipeline:
// audio (or typed text) -> Groq STT -> Groq LLM (with persona + history) -> Groq TTS -> back to browser.
//
// Runs only on the server. GROQ_API_KEY is read from process.env and never sent to the client.

import Groq from "groq-sdk";
import { SYSTEM_PROMPT } from "../lib/persona.js";

const STT_MODEL = "whisper-large-v3-turbo";
const LLM_MODEL = "llama-3.3-70b-versatile";
const TTS_MODEL = "canopylabs/orpheus-v1-english";
const TTS_VOICE = "austin";

// Rough safety limits.
const MAX_AUDIO_BASE64_CHARS = 8_000_000; // ~6MB raw audio, plenty for a spoken question
const MAX_HISTORY_MESSAGES = 16;
const MAX_REPLY_CHARS = 900; // keep TTS input reasonable and answers conversational

function trimToSentence(text, maxChars) {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return lastStop > maxChars * 0.4 ? cut.slice(0, lastStop + 1) : cut + "...";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    console.error("GROQ_API_KEY is not set.");
    res.status(500).json({ error: "Server isn't configured correctly. Please try again later." });
    return;
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const { audioBase64, mimeType, text, history } = req.body || {};

    if (audioBase64 && audioBase64.length > MAX_AUDIO_BASE64_CHARS) {
      res.status(413).json({ error: "That recording is too long. Try asking something shorter." });
      return;
    }

    let transcript = typeof text === "string" ? text.trim() : "";

    // 1) Speech-to-text (only if audio was sent instead of typed text)
    if (!transcript && audioBase64) {
      const buffer = Buffer.from(audioBase64, "base64");
      if (buffer.length < 800) {
        res.status(400).json({ error: "I didn't catch that. Could you try speaking again?" });
        return;
      }
      const file = new File([buffer], "audio.webm", { type: mimeType || "audio/webm" });
      const transcription = await groq.audio.transcriptions.create({
        file,
        model: STT_MODEL,
        language: "en",
      });
      transcript = (transcription.text || "").trim();
    }

    if (!transcript) {
      res.status(400).json({ error: "I didn't catch that. Could you try again?" });
      return;
    }

    // 2) Build messages: persona + recent history + current question
    const safeHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...safeHistory
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
      { role: "user", content: transcript },
    ];

    const completion = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages,
      temperature: 0.8,
      max_tokens: 320,
    });

    let reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      res.status(502).json({ error: "Couldn't generate a response. Please try again." });
      return;
    }
    reply = trimToSentence(reply, MAX_REPLY_CHARS);

    // 3) Text-to-speech
    let audioOutBase64 = null;
    try {
      const speech = await groq.audio.speech.create({
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: reply,
        response_format: "wav",
      });
      const audioBuffer = Buffer.from(await speech.arrayBuffer());
      audioOutBase64 = audioBuffer.toString("base64");
    } catch (ttsError) {
      console.error("TTS failed:", ttsError?.message || ttsError);
      // Still return the text reply so the app can show the transcript even if audio fails.
    }

    res.status(200).json({
      transcript,
      reply,
      audioBase64: audioOutBase64,
      audioMimeType: "audio/wav",
    });
  } catch (err) {
    console.error("Voice pipeline error:", err?.message || err);
    res.status(500).json({ error: "Something went wrong on my end. Please try again." });
  }
}
