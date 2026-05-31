"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-page py-24 text-center">
      <p className="label-mono mb-4">Something went wrong</p>
      <h1 className="h-display text-3xl text-obsidian mb-6">We could not load this page</h1>
      <p className="text-ink-mute mb-8 max-w-md mx-auto">{error.message}</p>
      <button type="button" onClick={() => reset()} className="btn-dark">
        Try again
      </button>
    </div>
  );
}
