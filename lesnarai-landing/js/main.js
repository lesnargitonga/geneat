document.addEventListener("DOMContentLoaded", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const hasGsap = typeof gsap !== "undefined";

  function splitText(selector) {
    document.querySelectorAll(selector).forEach((el) => {
      const text = el.textContent;
      el.textContent = "";
      text.split("").forEach((char) => {
        const span = document.createElement("span");
        span.className = "char";
        span.innerHTML = char === " " ? "&nbsp;" : char;
        el.appendChild(span);
      });
    });
  }

  splitText(".split-text");

  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);

    if (!reduceMotion) {
      const heroTl = gsap.timeline({ defaults: { ease: "power4.out" } });
      heroTl
        .to("#hero .char", {
          y: "0%",
          opacity: 1,
          duration: 1.2,
          stagger: 0.015,
          delay: 0.2,
        })
        .to(
          ".hero-fade",
          {
            y: 0,
            opacity: 1,
            duration: 1,
            stagger: 0.1,
          },
          "-=0.8",
        );

      gsap.utils.toArray(".fade-up:not(.hero-fade)").forEach((element) => {
        const delayClass = Array.from(element.classList).find((c) => c.startsWith("delay-"));
        const delay = delayClass ? parseInt(delayClass.split("-")[1], 10) * 0.15 : 0;

        gsap.to(element, {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power2.out",
          delay,
          scrollTrigger: {
            trigger: element,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        });
      });

      gsap.utils.toArray("h2.split-text").forEach((header) => {
        gsap.to(header.querySelectorAll(".char"), {
          y: "0%",
          opacity: 1,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.01,
          scrollTrigger: {
            trigger: header,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        });
      });
    } else {
      document.querySelectorAll(".fade-up:not(.hero-fade), .char").forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
    }
  }

  window.addEventListener(
    "scroll",
    () => {
      const nav = document.getElementById("nav");
      if (nav) {
        nav.classList.toggle("scrolled", window.scrollY > 50);
      }
      const progress = document.getElementById("progress");
      if (progress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
        progress.style.width = `${pct}%`;
      }
    },
    { passive: true },
  );

  const ringEl = document.getElementById("cursor-ring");

  if (!isTouch && !reduceMotion) {
    const cursor = document.getElementById("cursor");
    const ring = ringEl;
    const label = document.getElementById("cursor-label");
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;

    document.addEventListener("mousemove", (e) => {
      mx = e.clientX;
      my = e.clientY;
    });

    function renderCursor() {
      if (cursor) {
        cursor.style.transform = `translate(${mx - 4}px, ${my - 4}px)`;
      }
      rx += (mx - rx) * 0.15;
      ry += (my - ry) * 0.15;
      if (ring) {
        ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      }
      if (label) {
        label.style.transform = `translate(${mx + 15}px, ${my + 15}px)`;
      }
      requestAnimationFrame(renderCursor);
    }
    renderCursor();

    document.querySelectorAll("a, button, [data-magnetic]").forEach((el) => {
      el.addEventListener("mouseenter", () => document.body.classList.add("cursor-hover"));
      el.addEventListener("mouseleave", () => document.body.classList.remove("cursor-hover"));
    });

    document.querySelectorAll("[data-cursor-label]").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        if (label) {
          label.textContent = el.getAttribute("data-cursor-label") || "";
          document.body.classList.add("cursor-label-visible");
        }
      });
      el.addEventListener("mouseleave", () => {
        document.body.classList.remove("cursor-label-visible");
      });
    });
  }

  if (hasGsap && !reduceMotion) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        gsap.to(el, { x: dx * 0.3, y: dy * 0.3, duration: 0.4, ease: "power2.out" });
        if (ringEl) {
          ringEl.style.width = "50px";
          ringEl.style.height = "50px";
        }
      });
      el.addEventListener("mouseleave", () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.3)" });
        if (ringEl) {
          ringEl.style.width = "36px";
          ringEl.style.height = "36px";
        }
      });
    });
  }

  const lines = [
    { cmd: "lesnarai --status", out: "✓ Systems operational · Kenya → Global", el: "t-line-1", outEl: "t-out-1" },
    {
      cmd: "cat ventures.json",
      out: '{ hazina: "LIVE", geneat: "LIVE", security_tools: "BETA" }',
      el: "t-line-2",
      outEl: "t-out-2",
      wrap: "t-line2-wrap",
    },
  ];

  function typeText(el, text, cb) {
    let i = 0;
    const iv = setInterval(() => {
      el.textContent += text[i];
      i += 1;
      if (i >= text.length) {
        clearInterval(iv);
        if (cb) setTimeout(cb, 400);
      }
    }, 40);
  }

  let terminalRun = false;

  if (hasGsap && !reduceMotion) {
    ScrollTrigger.create({
      trigger: "#terminal-trigger",
      start: "top 70%",
      once: true,
      onEnter: () => {
        if (terminalRun) return;
        terminalRun = true;

        function runLine(idx) {
          if (idx >= lines.length) {
            const cursorLine = document.getElementById("t-cursor-line");
            if (cursorLine) cursorLine.style.display = "block";
            return;
          }

          const line = lines[idx];
          if (line.wrap) {
            const wrap = document.getElementById(line.wrap);
            if (wrap) wrap.style.display = "block";
          }

          const cmdEl = document.getElementById(line.el);
          if (!cmdEl) {
            runLine(idx + 1);
            return;
          }

          typeText(cmdEl, line.cmd, () => {
            if (line.outEl) {
              const outEl = document.getElementById(line.outEl);
              if (outEl) {
                outEl.style.display = "block";
                outEl.textContent = line.out;
              }
            }
            runLine(idx + 1);
          });
        }

        setTimeout(() => runLine(0), 500);
      },
    });
  } else {
    const out1 = document.getElementById("t-out-1");
    const out2 = document.getElementById("t-out-2");
    const l1 = document.getElementById("t-line-1");
    const l2 = document.getElementById("t-line-2");
    const wrap2 = document.getElementById("t-line2-wrap");
    const cursorLine = document.getElementById("t-cursor-line");
    if (l1) l1.textContent = lines[0].cmd;
    if (out1) {
      out1.style.display = "block";
      out1.textContent = lines[0].out;
    }
    if (wrap2) wrap2.style.display = "block";
    if (l2) l2.textContent = lines[1].cmd;
    if (out2) {
      out2.style.display = "block";
      out2.textContent = lines[1].out;
    }
    if (cursorLine) cursorLine.style.display = "block";
  }

  if (hasGsap && !reduceMotion) {
    document.querySelectorAll(".counter").forEach((counter) => {
      const target = parseInt(counter.getAttribute("data-target") || "0", 10);
      ScrollTrigger.create({
        trigger: counter,
        start: "top 85%",
        once: true,
        onEnter: () => {
          gsap.to(counter, {
            innerText: target,
            duration: 1.5,
            ease: "power2.out",
            snap: { innerText: 1 },
            onUpdate: function () {
              counter.textContent = Math.round(parseFloat(counter.textContent)).toString();
            },
          });
        },
      });
    });
  } else {
    document.querySelectorAll(".counter").forEach((counter) => {
      counter.textContent = counter.getAttribute("data-target") || "0";
    });
  }
});
