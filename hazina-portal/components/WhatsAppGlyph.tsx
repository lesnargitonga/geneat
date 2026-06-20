export function WhatsAppGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M20 12a8 8 0 0 1-11.7 7l-4.3 1.1 1.2-4.2A8 8 0 1 1 20 12Z" />
      <path d="M9.4 10.3c.2-.5.4-.5.7-.5h.4c.1 0 .3.1.3.3l.6 1.5c.1.2 0 .3-.1.5l-.4.5c-.1.1-.1.3 0 .4.3.6.9 1.2 1.5 1.5.1.1.3.1.4 0l.5-.4c.1-.1.3-.1.5-.1l1.5.6c.2.1.3.2.3.3v.4c0 .3 0 .5-.5.7-.5.2-1.1.3-1.7.1-1-.3-2-.9-2.9-1.8s-1.5-1.9-1.8-2.9c-.2-.6-.1-1.2.1-1.7Z" />
    </svg>
  );
}
