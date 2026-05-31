"use client";

type Props = {
  prompt: string;
  children: React.ReactNode;
  className?: string;
};

export function ConciergePromptButton({ prompt, children, className = "btn-outline" }: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.dispatchEvent(new CustomEvent("hazina:chat-prompt", { detail: { prompt } }));
        window.location.hash = "chat";
      }}
    >
      {children}
    </button>
  );
}
