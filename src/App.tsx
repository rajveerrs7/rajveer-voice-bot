import VoiceBot from "@/components/VoiceBot";

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-violet-700/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-indigo-700/10 blur-[120px]" />
      </div>

      <div className="relative flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-6 sm:px-10">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold">
              R
            </span>
            <span className="text-sm font-semibold tracking-wide text-zinc-300">
              Rajveer · AI Voicebot
            </span>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center px-6 pb-16 pt-6 sm:px-10">
          <div className="mb-10 max-w-xl text-center">
            <h1 className="bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
              Talk to Rajveer
            </h1>
            <p className="mt-4 text-base text-zinc-400 sm:text-lg">
              Ask me anything about my journey, how I think, what I've built, or
              where I'm headed.
            </p>
          </div>

          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-10">
            <VoiceBot />
          </div>
        </main>

        <footer
          id="about"
          className="border-t border-white/5 px-6 py-8 text-center sm:px-10"
        >
          <p className="mx-auto max-w-xl text-xs leading-relaxed text-zinc-600">
            This is a personal AI interview bot built by Rajveer Singh.
          </p>
        </footer>
      </div>
    </div>
  );
}
