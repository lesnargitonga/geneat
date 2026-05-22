"use client";

import { triggerCafePrompt } from "@/components/ChatWidget";

export function QuickOrderPrompts({
  cafeSlug,
  prompts,
}: {
  cafeSlug: string;
  prompts: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto relative z-10">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => triggerCafePrompt(cafeSlug, prompt)}
          className="chip-mute hover:bg-ink hover:text-cream cursor-pointer transition-colors"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
