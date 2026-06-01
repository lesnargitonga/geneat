"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BRAND } from "@/lib/products";
import { whatsappLink } from "@/lib/format";

type Msg = { id: string; role: "user" | "ai" | "system"; text: string; ts: number };
type MsgWithMedia = Msg & { imageUrl?: string | null; imageAlt?: string | null };

const BUSINESS_SLUG = "hazina-nomads";
const PHONE_KEY = "hazina.phone";
const CHAT_TIMEOUT_MS = 30_000;

const ASK_PROMPTS = [
  "Show me your gift collections",
  "I need JKIA delivery before my flight",
  "Tell me about The Kenya Edit",
  "Corporate gifting enquiry",
];

const GREETING =
  "Welcome to Hazina Nomads. I can help you choose a curated gift box and coordinate hotel delivery, JKIA handoff, or an insured DHL export quote. Where are you staying, and when do you depart?";

function getOrCreatePhone(): string {
  if (typeof window === "undefined") return "+254700000000";
  let v = window.localStorage.getItem(PHONE_KEY);
  if (!v) {
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

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MsgWithMedia[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const phone = useMemo(() => getOrCreatePhone(), []);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncHash = () => {
      if (window.location.hash === "#chat") setOpen(true);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        { id: crypto.randomUUID(), role: "ai", text: GREETING, ts: Date.now() },
      ]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (textArg?: string) => {
      const text = (textArg ?? draft).trim();
      if (!text || busy) return;
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
            business_slug: BUSINESS_SLUG,
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
          : `Couldn't reach the concierge right now — ${body?.detail || r.statusText}`;
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
      } catch (e: unknown) {
        const err = e as { name?: string; message?: string };
        const timedOut = err?.name === "AbortError";
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "system",
            text: timedOut
              ? "The concierge line is taking longer than usual. Try once more, or continue on WhatsApp for the fastest handoff."
              : `The concierge line is temporarily unreachable: ${err?.message || "unknown"}`,
            ts: Date.now(),
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, draft, phone],
  );

  useEffect(() => {
    const onPrompt = (event: Event) => {
      const custom = event as CustomEvent<{ prompt?: string }>;
      const prompt = custom.detail?.prompt?.trim();
      if (!prompt) return;
      setOpen(true);
      setQueuedPrompt(prompt);
    };
    window.addEventListener("hazina:chat-prompt", onPrompt as EventListener);
    return () => window.removeEventListener("hazina:chat-prompt", onPrompt as EventListener);
  }, []);

  useEffect(() => {
    if (!queuedPrompt || !open || busy) return;
    void send(queuedPrompt);
    setQueuedPrompt(null);
  }, [busy, open, queuedPrompt, send]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open chat"}
        className={`fixed bottom-5 right-5 z-40 inline-flex items-center justify-center shadow-editorial active:scale-95 transition ${
          open
            ? "h-12 w-12 rounded-full bg-obsidian text-sand text-xl hover:bg-obsidian-soft"
            : "min-h-[46px] rounded-full border border-white/20 bg-obsidian/92 px-5 text-sm font-medium text-sand backdrop-blur-md hover:bg-obsidian"
        }`}
      >
        {open ? "×" : "Chat with Concierge"}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 w-[min(400px,calc(100vw-2rem))] max-h-[min(78svh,680px)] flex flex-col bg-sand border border-border shadow-editorial overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-obsidian text-sand">
            <div>
              <div className="label-mono text-sand/50">Concierge chat</div>
              <div className="font-serif text-lg text-sand">{BRAND.name}</div>
            </div>
            <a
              href={whatsappLink(BRAND.whatsapp, "Hello Hazina Nomads — I'd like concierge help.")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-sand/70 hover:text-sand"
            >
              WhatsApp
            </a>
          </div>

          <div ref={scrollerRef} className="flex-1 overflow-auto p-3 space-y-2 bg-sand">
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
            {!busy && (
              <div className="pt-2 flex flex-wrap gap-1.5">
                {ASK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="text-sm px-3 py-1.5 border border-border text-ink-mute hover:border-obsidian hover:text-obsidian transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-border bg-sand flex items-end gap-2">
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
              placeholder="Message Hazina concierge…"
              className="flex-1 resize-none px-3 py-2 bg-sand-dark text-sm outline-none border border-border focus:border-obsidian"
            />
            <button
              onClick={() => send()}
              disabled={busy || !draft.trim()}
              className="btn-dark !px-4 !py-2 text-sm"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function triggerConciergePrompt(prompt: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("hazina:chat-prompt", { detail: { prompt } }));
}

function Bubble({ m }: { m: MsgWithMedia }) {
  if (m.role === "system") {
    return <div className="text-center text-sm text-ink-mute py-1">{m.text}</div>;
  }
  const mine = m.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={
          "max-w-[84%] px-3 py-2 rounded-2xl text-base leading-relaxed whitespace-pre-wrap " +
          (mine
            ? "bg-obsidian text-sand"
            : "bg-sand-dark border border-border text-obsidian")
        }
      >
        {!mine && m.imageUrl && (
          <Image
            src={m.imageUrl}
            alt={m.imageAlt || "Product photo"}
            width={240}
            height={160}
            className="mb-2 w-full max-w-[240px] rounded-xl object-cover"
            unoptimized
          />
        )}
        {m.text}
      </div>
    </div>
  );
}
