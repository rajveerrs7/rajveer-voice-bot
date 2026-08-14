export default function Message({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm sm:max-w-[75%] ${
          isUser
            ? "rounded-br-sm bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
            : "rounded-bl-sm border border-white/10 bg-white/5 text-zinc-100"
        }`}
      >
        {!isUser && (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-violet-300/80">
            Rajveer
          </div>
        )}
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
