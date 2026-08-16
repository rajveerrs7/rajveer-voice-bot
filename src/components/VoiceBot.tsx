import { useCallback, useEffect, useRef, useState } from "react";
import Message from "./Message";

type Role = "user" | "assistant";
type ChatMessage = { role: Role; content: string };
type Status = "idle" | "listening" | "thinking" | "speaking" | "error";

const MAX_HISTORY_TURNS = 15;
const MAX_RECORDING_MS = 45_000;

const STATUS_LABEL: Record<Status, string> = {
  idle: "Tap to speak",
  listening: "I'm listening...",
  thinking: "Thinking...",
  speaking: "Speaking...",
  error: "Something went wrong. Try again.",
};

function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  for (const type of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported?.(type)
    )
      return type;
  }
  return "";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function micErrorMessage(err: unknown) {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Couldn't access your microphone. Please allow microphone access in your browser and try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone was found on this device. You can still type your question below.";
  }
  return "Couldn't access your microphone. Please allow microphone access and try again.";
}

export default function VoiceBot() {
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [micSupported] = useState(
    () =>
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof MediaRecorder !== "undefined",
  );

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
      if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    };
  }, []);

  const sendToServer = useCallback(
    async (payload: {
      audioBase64?: string;
      mimeType?: string;
      text?: string;
    }) => {
      setStatus("thinking");
      setErrorMsg("");
      try {
        const history = messages.slice(-MAX_HISTORY_TURNS * 2);
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, history }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data?.error || "Something went wrong. Please try again.",
          );
        }
        console.log(data);

        setMessages((prev) => [
          ...prev,
          { role: "user", content: data.transcript },
          { role: "assistant", content: data.reply },
        ]);

        if (data.audioBase64) {
          const audio = new Audio(
            `data:${data.audioMimeType || "audio/wav"};base64,${data.audioBase64}`,
          );
          audioRef.current = audio;
          setStatus("speaking");
          // Play a little faster for snappier responses
          try {
            audio.playbackRate = 1;
          } catch (e) {}
          audio.onended = () => setStatus("idle");
          audio.onerror = () => setStatus("idle");
          await audio.play().catch(() => setStatus("idle"));
        } else {
          // Fallback: use browser SpeechSynthesis if server-side TTS failed
          if (
            typeof window !== "undefined" &&
            "speechSynthesis" in window &&
            data.reply
          ) {
            setStatus("speaking");
            const utter = new SpeechSynthesisUtterance(data.reply);
            // Slightly increase speech rate for a faster voice
            try {
              utter.rate = 1;
            } catch (e) {}
            utter.onend = () => setStatus("idle");
            utter.onerror = () => setStatus("idle");
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utter);
          } else {
            setStatus("idle");
          }
        }
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
        );
        setStatus("error");
      }
    },
    [messages],
  );

  const handleRecordingStop = useCallback(async () => {
    const blob = new Blob(chunksRef.current, {
      type: recorderRef.current?.mimeType || "audio/webm",
    });
    chunksRef.current = [];
    if (blob.size < 500) {
      setErrorMsg("I didn't catch that. Could you try again?");
      setStatus("error");
      return;
    }
    const base64 = await blobToBase64(blob);
    await sendToServer({ audioBase64: base64, mimeType: blob.type });
  }, [sendToServer]);

  const startRecording = useCallback(async () => {
    setErrorMsg("");
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      }
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleRecordingStop;
      recorder.start();
      recorderRef.current = recorder;
      setStatus("listening");
      autoStopTimer.current = setTimeout(() => {
        if (recorderRef.current?.state === "recording")
          recorderRef.current.stop();
      }, MAX_RECORDING_MS);
    } catch (err) {
      setErrorMsg(micErrorMessage(err));
      setStatus("error");
    }
  }, [handleRecordingStop]);

  const stopRecording = useCallback(() => {
    if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const handleOrbClick = () => {
    if (status === "listening") {
      stopRecording();
      return;
    }
    if (status === "idle" || status === "error") {
      startRecording();
    }
  };

  const handleStart = async () => {
    setStarted(true);
    if (micSupported) {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setStatus("idle");
      } catch (err) {
        setErrorMsg(micErrorMessage(err));
        setStatus("error");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = textInput.trim();
    if (!value || status === "thinking") return;
    setTextInput("");
    sendToServer({ text: value });
  };

  const handleNewConversation = () => {
    audioRef.current?.pause();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setMessages([]);
    setErrorMsg("");
    setStatus("idle");
  };

  const stopSpeaking = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        try {
          audioRef.current.currentTime = audioRef.current.duration || 0;
        } catch (e) {}
        audioRef.current = null;
      }
    } catch (e) {}
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setStatus("idle");
  }, []);

  if (!started) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <button
          onClick={handleStart}
          className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:scale-[1.03] hover:shadow-indigo-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <span className="text-xl">🎙️</span>
          Start Talking
        </button>
        <p className="max-w-sm text-sm text-zinc-500">
          We'll ask for microphone access. If you'd rather not use your mic, you
          can type instead once you start.
        </p>
      </div>
    );
  }

  const orbState = status;

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={handleOrbClick}
          disabled={status === "thinking" || status === "speaking"}
          aria-label={STATUS_LABEL[orbState]}
          className={`relative flex h-36 w-36 items-center justify-center rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400/50 sm:h-44 sm:w-44 ${
            status === "thinking" || status === "speaking"
              ? "cursor-default"
              : "cursor-pointer"
          }`}
        >
          <span
            className={`absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 via-indigo-500 to-fuchsia-500 opacity-80 blur-xl transition-all duration-300 ${
              status === "listening"
                ? "scale-110 animate-pulse opacity-100"
                : ""
            } ${status === "speaking" ? "animate-pulse opacity-100" : ""}`}
          />
          <span
            className={`relative flex h-28 w-28 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-violet-600 to-indigo-700 shadow-2xl sm:h-36 sm:w-36 ${
              status === "listening"
                ? "animate-[pulse_1.4s_ease-in-out_infinite]"
                : ""
            }`}
          >
            {status === "thinking" ? (
              <span className="flex gap-1.5">
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white/90 [animation-delay:-0.3s]" />
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white/90 [animation-delay:-0.15s]" />
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white/90" />
              </span>
            ) : status === "speaking" ? (
              <span className="text-4xl">🔊</span>
            ) : status === "error" ? (
              <span className="text-4xl">⚠️</span>
            ) : (
              <span className="text-4xl">🎙️</span>
            )}
          </span>
        </button>
        {status === "speaking" && (
          <div className="mt-3">
            <button
              onClick={stopSpeaking}
              className="rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow hover:brightness-90"
            >
              Stop
            </button>
          </div>
        )}
        <p
          className={`min-h-[1.5rem] text-sm font-medium tracking-wide ${
            status === "error" ? "text-rose-400" : "text-zinc-400"
          }`}
        >
          {status === "error" && errorMsg ? errorMsg : STATUS_LABEL[orbState]}
        </p>
        {!micSupported && (
          <p className="max-w-sm text-center text-xs text-zinc-500">
            Voice recording isn't supported in this browser. You can still type
            your question below.
          </p>
        )}
      </div>

      <div className="w-full max-w-2xl">
        {messages.length > 0 && (
          <div className="mb-4 flex max-h-[420px] flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:max-h-[480px]">
            {messages.map((m, i) => (
              <Message key={i} role={m.role} content={m.content} />
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}

        <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type your question..."
            disabled={status === "thinking"}
            className="flex-1 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
          />
          <button
            type="submit"
            disabled={status === "thinking" || !textInput.trim()}
            className="rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-zinc-100 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>

        <div className="mt-4 flex justify-center">
          <button
            onClick={handleNewConversation}
            className="text-xs font-medium text-zinc-500 underline-offset-4 transition hover:text-zinc-300 hover:underline"
          >
            New Conversation
          </button>
        </div>
      </div>
    </div>
  );
}
