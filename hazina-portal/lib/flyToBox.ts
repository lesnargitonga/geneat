// Animate a clone of a product image arcing from a source element into the
// collection box/tray, then give the target a small "received it" pulse.
// Pure DOM + Web Animations API so it works from any client component.

export function flyToBox(source: HTMLElement | null, target: HTMLElement | null, imageUrl?: string | null) {
  if (typeof window === "undefined" || !source || !target) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const s = source.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  if (s.width === 0 || t.width === 0) return;

  const size = Math.max(40, Math.min(s.width, s.height, 104));
  const startX = s.left + s.width / 2 - size / 2;
  const startY = s.top + s.height / 2 - size / 2;

  const clone = document.createElement("div");
  Object.assign(clone.style, {
    position: "fixed",
    left: `${startX}px`,
    top: `${startY}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "12px",
    zIndex: "9999",
    pointerEvents: "none",
    backgroundColor: "#1c160f",
    backgroundImage: imageUrl ? `url(${imageUrl})` : "linear-gradient(135deg,#c79a55,#7a5230)",
    backgroundSize: "cover",
    backgroundPosition: "center",
    boxShadow: "0 20px 46px rgba(20,14,8,0.4)",
    border: "1px solid rgba(201,168,130,0.65)",
    willChange: "transform, opacity",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(clone);

  const dx = t.left + t.width / 2 - (s.left + s.width / 2);
  const dy = t.top + Math.min(t.height * 0.28, 90) - (s.top + s.height / 2);
  // Apex of the arc — lift higher for longer throws.
  const lift = Math.min(-70, -Math.abs(dx) * 0.28 - 70);

  const anim = clone.animate(
    [
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
      {
        transform: `translate(${dx * 0.5}px, ${dy * 0.5 + lift}px) scale(0.66) rotate(10deg)`,
        opacity: 1,
        offset: 0.55,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(0.2) rotate(22deg)`,
        opacity: 0.35,
        offset: 1,
      },
    ],
    { duration: 760, easing: "cubic-bezier(0.5, 0, 0.2, 1)" },
  );

  anim.onfinish = () => {
    clone.remove();
    target.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.035)" }, { transform: "scale(1)" }],
      { duration: 340, easing: "ease-out" },
    );
  };
  anim.oncancel = () => clone.remove();
}
