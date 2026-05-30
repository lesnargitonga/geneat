"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CAFES, Cafe } from "@/lib/cafes";

type Msg = { id: string; role: "user" | "ai" | "system"; text: string; ts: number };
type MsgWithMedia = Msg & { imageUrl?: string | null; imageAlt?: string | null };

const PHONE_KEY = "geneat.phone";
const CHAT_TIMEOUT_MS = 45_000;

function getOrCreatePhone(): string {
  if (typeof window === "undefined") return "+254700000000";
  let v = window.localStorage.getItem(PHONE_KEY);
  if (!v) {
    // Synthetic Kenyan-format number, persisted per browser.
    const tail = Math.floor(100000 + Math.random() * 899999);
    v = `+2547${String(tail).padStart(8, "0").slice(0, 8)}`;
    window.localStorage.setItem(PHONE_KEY, v);
  }
  return v;
}

function normalizeAssistantReply(reply: string, imageUrl?: string | null, imageAlt?: string | null) {
  if (!imageUrl) return reply;
  const trimmed = (reply || "").trim();
  if (/^photo ready for .+:?$/i.test(trimmed)) {
    return imageAlt ? `Here you go for ${imageAlt}.` : "Here you go.";
  }
  return trimmed;
}

export function ChatWidget({ cafe }: { cafe?: Cafe }) {
  const [open, setOpen] = useState(false);
  const [activeCafe, setActiveCafe] = useState<Cafe | undefined>(cafe);
  const [messages, setMessages] = useState<MsgWithMedia[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const phone = useMemo(() => getOrCreatePhone(), []);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cafe) setActiveCafe(cafe);
  }, [cafe]);

  useEffect(() => {
    const syncHash = () => {
      if (window.location.hash === "#chat") {
        if (cafe) setActiveCafe(cafe);
        setOpen(true);
      }
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [cafe]);

  useEffect(() => {
    if (open && activeCafe && messages.length === 0) {
      const greeting =
        activeCafe.slug === "lily-pond-cafe"
          ? `Sasa! 👋 Karibu Lily Pond. Tell me what you want and when you're picking up — I'll have it ready before your lecture ends.`
          : `You're chatting with ${activeCafe.name} ${activeCafe.hero_emoji}. Ask me anything — menu, prices, pickup time.`;
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "ai",
          text: greeting,
          ts: Date.now(),
        },
      ]);
    }
  }, [open, activeCafe, messages.length]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (textArg?: string) => {
    const text = (textArg ?? draft).trim();
    if (!text || !activeCafe || busy) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setBusy(true);
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          text,
          business_slug: activeCafe.slug,
          language: "en",
        }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const ok = r.ok;
      const body = await r.json().catch(() => ({}));
      const reply = ok
        ? normalizeAssistantReply(
            body.reply || "(no reply)",
            typeof body?.image_url === "string" ? body.image_url : null,
            typeof body?.photo_item === "string" ? body.photo_item : null,
          )
        : `Couldn't reach the café right now — ${body?.detail || r.statusText}`;
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "ai",
          text: reply,
          ts: Date.now(),
          imageUrl: typeof body?.image_url === "string" ? body.image_url : null,
          imageAlt: typeof body?.photo_item === "string" ? body.photo_item : null,
        },
      ]);
    } catch (e: any) {
      const timedOut = e?.name === "AbortError";
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: timedOut
            ? "That took too long — the café AI may be busy. Please try again in a few seconds."
            : `Network error: ${e?.message || "unknown"}`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [activeCafe, busy, draft, phone]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      const custom = event as CustomEvent<{ prompt?: string; cafeSlug?: string }>;
      const prompt = custom.detail?.prompt?.trim();
      const cafeSlug = custom.detail?.cafeSlug;
      if (!prompt) return;
      if (cafeSlug) {
        const matchedCafe = CAFES.find((c) => c.slug === cafeSlug);
        if (matchedCafe) {
          setActiveCafe(matchedCafe);
        }
      }
      setOpen(true);
      setQueuedPrompt(prompt);
    };

    window.addEventListener("geneat:chat-prompt", onPrompt as EventListener);
    return () => window.removeEventListener("geneat:chat-prompt", onPrompt as EventListener);
  }, []);

  useEffect(() => {
    if (!queuedPrompt || !open || !activeCafe || busy) return;
    void send(queuedPrompt);
    setQueuedPrompt(null);
  }, [activeCafe, busy, open, queuedPrompt, send]);

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open chat"}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-brand text-white shadow-pop flex items-center justify-center text-2xl active:scale-95 transition hover:bg-brand-dark"
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-40 w-[min(380px,calc(100vw-2rem))] max-h-[70vh] flex flex-col card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-ink text-cream">
            <div>
              <div className="text-xs uppercase tracking-wider text-cream/70">Chat to order</div>
              <div className="h-display text-base">
                {activeCafe ? activeCafe.name : "Pick a café"}
              </div>
            </div>
            {activeCafe && (
              <button
                onClick={() => {
                  setActiveCafe(undefined);
                  setMessages([]);
                }}
                className="text-xs text-cream/70 hover:text-cream underline underline-offset-2"
              >
                Switch
              </button>
            )}
          </div>

          {!activeCafe ? (
            <div className="p-4 grid grid-cols-1 gap-2 overflow-auto">
              <p className="text-sm text-ink-soft mb-1">Which café are you ordering from?</p>
              {CAFES.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setActiveCafe(c)}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-cream border border-ink/5 text-left"
                >
                  <span className="text-2xl">{c.hero_emoji}</span>
                  <span className="flex-1">
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block text-xs text-ink-mute">{c.category}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div ref={scrollerRef} className="flex-1 overflow-auto p-3 space-y-2 bg-cream/60">
                {messages.map((m) => (
                  <Bubble key={m.id} m={m} />
                ))}
                {busy && (
                  <div className="flex items-center gap-1 pl-2 py-1" aria-label="typing">
                    <span className="w-2 h-2 rounded-full bg-ink/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-ink/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-ink/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
                {/* Quick-reply prompts on first open */}
                {!busy && messages.length <= 1 && activeCafe.askPrompts?.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {activeCafe.askPrompts.slice(0, 4).map((p) => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="text-[12px] px-3 py-1.5 rounded-full bg-white border border-brand/30 text-brand-dark hover:bg-brand hover:text-white transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-2 border-t border-ink/5 bg-white flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder={`Message ${activeCafe.name}…`}
                  className="flex-1 resize-none px-3 py-2 rounded-2xl bg-cream text-sm outline-none border border-ink/10 focus:border-brand"
                />
                <button
                  onClick={() => send()}
                  disabled={busy || !draft.trim()}
                  className="btn-primary !px-4 !py-2 text-xs"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

export function triggerCafePrompt(cafeSlug: string, prompt: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("geneat:chat-prompt", {
      detail: { cafeSlug, prompt },
    }),
  );
}

function Bubble({ m }: { m: MsgWithMedia }) {
  if (m.role === "system") {
    return <div className="text-center text-[11px] text-ink-mute py-1">{m.text}</div>;
  }
  const mine = m.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={
          "max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug whitespace-pre-wrap " +
          (mine
            ? "bg-brand text-white rounded-br-md"
            : "bg-white border border-ink/5 text-ink rounded-bl-md")
        }
      >
        {!mine && m.imageUrl && (
          <img
            src={m.imageUrl}
            alt={m.imageAlt || "Menu photo"}
            className="mb-2 w-full max-w-[240px] rounded-xl object-cover"
            loading="lazy"
          />
        )}
        {m.text}
      </div>
    </div>
  );
}
