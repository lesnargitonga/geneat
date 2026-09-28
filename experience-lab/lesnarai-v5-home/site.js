// Screen recordings: the poster is fetched only as a frame approaches, and the
// recording plays only while it is on screen. Under reduced motion the poster
// stays and nothing plays.
(() => {
  const vids = document.querySelectorAll('video.frame__v');
  if (!vids.length) return;
  const setPoster = (v) => { if (v.dataset.poster && !v.poster) v.poster = v.dataset.poster; };
  if (!('IntersectionObserver' in window)) { vids.forEach(setPoster); return; }

  const near = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { setPoster(e.target); near.unobserve(e.target); }
  }, { rootMargin: '100% 0px' });
  vids.forEach((v) => near.observe(v));

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) {
        if (v.preload !== 'auto') v.preload = 'auto';
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    }
  }, { threshold: 0.4 });
  vids.forEach((v) => seen.observe(v));
})();

// The header follows the ground beneath it: dark while a dark section is under it.
(() => {
  const top = document.querySelector('.top');
  const dark = document.querySelectorAll('[data-ground="dark"]');
  if (!top || !dark.length || !('IntersectionObserver' in window)) return;
  const under = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? under.add(e.target) : under.delete(e.target);
    top.classList.toggle('top--dark', under.size > 0);
  }, { rootMargin: `0px 0px -${Math.max(0, innerHeight - 40)}px 0px` });
  dark.forEach((s) => io.observe(s));
})();
