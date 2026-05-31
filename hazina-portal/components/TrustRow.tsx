const TRUST_ITEMS = [
  {
    label: "Hotel delivery",
    value: "Westlands, Kilimani, Karen",
  },
  {
    label: "JKIA handoff",
    value: "Terminal coordination available",
  },
  {
    label: "DHL export",
    value: "Insured courier quote on request",
  },
  {
    label: "Dispatch hours",
    value: "08:00-20:00 EAT",
  },
  {
    label: "Payment",
    value: "USD card / KES M-Pesa",
  },
];

export function TrustRow({
  dark = false,
  className = "",
}: {
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-2 lg:grid-cols-5 gap-px overflow-hidden border ${
        dark ? "border-sand/15 bg-sand/15" : "border-border bg-border"
      } ${className}`}
    >
      {TRUST_ITEMS.map((item) => (
        <div
          key={item.label}
          className={`p-4 md:p-5 ${
            dark ? "bg-obsidian text-sand" : "bg-sand text-obsidian"
          }`}
        >
          <p className={`font-mono text-sm font-medium uppercase tracking-[0.1em] ${
            dark ? "text-sand/45" : "text-ink-soft"
          }`}>
            {item.label}
          </p>
          <p className={`mt-1 text-sm md:text-base leading-snug ${
            dark ? "text-sand/85" : "text-obsidian"
          }`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
