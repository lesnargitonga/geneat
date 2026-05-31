"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Georgia, serif", padding: "4rem 2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Hazina Nomads</h1>
        <p style={{ color: "#5C564E", marginBottom: "1.5rem" }}>{error.message}</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            background: "#1C1A17",
            color: "#FAF8F5",
            border: "none",
            padding: "0.75rem 1.25rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
