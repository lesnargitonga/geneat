document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([
    window.__lesnarMotionReady || Promise.resolve(),
    window.__lesnarThreeReady || Promise.resolve(),
  ]);
  document.body.classList.add("js-ready");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch =
    window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  const hardwareThreads = navigator.hardwareConcurrency || 8;
  const deviceMemory = navigator.deviceMemory || 8;
  const isLaptopProfile =
    !isTouch &&
    (
      hardwareThreads <= 6 ||
      deviceMemory <= 6 ||
      (window.innerWidth <= 1440 && window.innerHeight <= 900)
    );
  const hasGsap = typeof gsap !== "undefined";
  const hasScrollTrigger = typeof ScrollTrigger !== "undefined";
  const magicToggle = document.querySelector("[data-magic-toggle]");
  const magicToggleState = document.querySelector("[data-magic-toggle-state]");
  const magicStorageKey = "lesnar-magic";
  const webglContainer = document.getElementById("webgl-container");
  let initializeWebgl = () => {};
  let webglInitialized = false;
  let savedMagic = null;
  try {
    savedMagic = window.localStorage.getItem(magicStorageKey);
  } catch {
    savedMagic = null;
  }
  document.body.classList.toggle("magic-lite", isTouch);
  document.body.classList.toggle("performance-lite", isLaptopProfile);
  function isMagicOff() {
    return document.body.classList.contains("magic-off");
  }
  const globeFallbackConnections = [
    {
      label: "Customer Product",
      detail: "Customer portals, dashboards, and tools connect to Lesnar-built services without feeling fragile.",
      status: "Products reach customers through Lesnar",
      accent: "#69b9c2",
    },
    {
      label: "Trust and Security",
      detail: "Threats, audit trails, and payment risks route back into testing before customers ever feel them.",
      status: "Trust protects launches through Lesnar",
      accent: "#a08fc0",
    },
    {
      label: "Cloud Regions",
      detail: "Production systems send health, traffic, and recovery signals through one clear operating route.",
      status: "Cloud keeps work alive through Lesnar",
      accent: "#a4bb78",
    },
    {
      label: "Payments and Commerce",
      detail: "Orders, M-Pesa proof, merchants, and customers stay joined from checkout to delivery.",
      status: "Money becomes fulfilment through Lesnar",
      accent: "#c1848d",
    },
    {
      label: "Field Devices",
      detail: "Robots, cameras, and devices feed real-world status back into the same engineering loop.",
      status: "Devices report reality through Lesnar",
      accent: "#d1aa63",
    },
    {
      label: "Operations Desk",
      detail: "Reviews, approvals, and customer updates stay visible from Nairobi to the world.",
      status: "People approve outcomes through Lesnar",
      accent: "#e2d6be",
    },
    {
      label: "Data Pipelines",
      detail: "Events, reports, and decision data move from messy sources into clean operating views.",
      status: "Data becomes decisions through Lesnar",
      accent: "#8fb8ff",
    },
    {
      label: "Workflow Automation",
      detail: "Handoffs, reminders, approvals, and staff work stay visible instead of living in guesswork.",
      status: "Workflows stay coordinated through Lesnar",
      accent: "#7fd0a5",
    },
    {
      label: "Logistics Network",
      detail: "Orders, routes, delivery proof, and customer updates stay joined from dispatch to doorstep.",
      status: "Movement stays traceable through Lesnar",
      accent: "#efb36b",
    },
    {
      label: "Support Channels",
      detail: "WhatsApp, email, portals, and internal teams share one clear customer context.",
      status: "Support stays human and connected through Lesnar",
      accent: "#eda6cf",
    },
  ];
  const globeFallbackControl = document.querySelector("[data-globe-focus]");
  function setFallbackGlobeConnector(index, syncWebgl = true) {
    const connection = globeFallbackConnections[index];
    if (!globeFallbackControl || !connection) return;
    globeFallbackControl.classList.add("has-connector");
    globeFallbackControl.style.setProperty("--globe-accent", connection.accent);
    globeFallbackControl.querySelector("[data-globe-title]").textContent = connection.label;
    globeFallbackControl.querySelector("[data-globe-detail]").textContent = connection.detail;
    globeFallbackControl.querySelector("[data-globe-status]").textContent = connection.status;
    globeFallbackControl.setAttribute("aria-expanded", "true");
    globeFallbackControl.dataset.fallbackConnectorIndex = String(index);
    window.setTimeout(() => {
      if (globeFallbackControl.dataset.fallbackConnectorIndex === String(index)) {
        delete globeFallbackControl.dataset.fallbackConnectorIndex;
      }
    }, 120);
    document.body.classList.add("globe-focus");
    if (syncWebgl) {
      document.dispatchEvent(
        new CustomEvent("lesnar:globe-fallback-select", { detail: { index } }),
      );
    }
  }
  globeFallbackControl?.addEventListener("click", (event) => {
    if (isMagicOff() || event.defaultPrevented) return;
    if (globeFallbackControl.dataset.dragSuppressClick === "true") return;
    const rect = globeFallbackControl.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
    if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) return;
    const anchors = window.innerWidth <= 900
      ? [
          [0.18, 0.42],
          [0.4, 0.18],
          [0.73, 0.31],
          [0.82, 0.5],
          [0.72, 0.73],
          [0.5, 0.79],
          [0.24, 0.66],
          [0.44, 0.5],
          [0.33, 0.78],
          [0.59, 0.21],
        ]
      : [
          [0.18, 0.38],
          [0.38, 0.17],
          [0.7, 0.25],
          [0.83, 0.46],
          [0.76, 0.72],
          [0.52, 0.82],
          [0.23, 0.66],
          [0.46, 0.46],
          [0.33, 0.76],
          [0.58, 0.2],
        ];
    let fallbackIndex = 0;
    let fallbackDistance = Number.POSITIVE_INFINITY;
    anchors.forEach(([anchorX, anchorY], index) => {
      const distance = Math.hypot(x - anchorX, y - anchorY);
      if (distance < fallbackDistance) {
        fallbackDistance = distance;
        fallbackIndex = index;
      }
    });
    if (fallbackDistance <= (window.innerWidth <= 900 ? 0.46 : 0.4)) {
      const syncWebgl = !webglInitialized || document.body.classList.contains("webgl-unavailable");
      setFallbackGlobeConnector(fallbackIndex, syncWebgl);
    }
  });
  document.addEventListener("lesnar:magic-change", (event) => {
    if (event.detail.enabled || !globeFallbackControl) return;
    globeFallbackControl.classList.remove("has-connector");
    globeFallbackControl.removeAttribute("aria-expanded");
    globeFallbackControl.style.removeProperty("--globe-accent");
    document.body.classList.remove("globe-focus");
  });
  function setMagicMode(enabled, persist = true) {
    document.body.classList.toggle("magic-off", !enabled);
    document.body.classList.toggle("magic-on", enabled);
    magicToggle?.setAttribute("aria-pressed", String(enabled));
    if (magicToggleState) magicToggleState.textContent = enabled ? "On" : "Off";
    if (persist) {
      try {
        window.localStorage.setItem(magicStorageKey, enabled ? "on" : "off");
      } catch {
        // Ignore storage failures; the button still works for the current page.
      }
    }
    document.dispatchEvent(
      new CustomEvent("lesnar:magic-change", { detail: { enabled } }),
    );
  }
  setMagicMode(!reduceMotion && savedMagic !== "off", false);
  magicToggle?.addEventListener("click", () => {
    const enabling = isMagicOff();
    setMagicMode(enabling);
    if (enabling) {
      const needsThree = typeof window.THREE === "undefined";
      if (needsThree) {
        magicToggle?.setAttribute("aria-busy", "true");
        if (magicToggleState) magicToggleState.textContent = "Loading";
      }
      const threeReady = window.__loadLesnarThree?.() || Promise.resolve();
      Promise.resolve(threeReady)
        .then(() => {
          if (!isMagicOff()) initializeWebgl();
        })
        .finally(() => {
          magicToggle?.removeAttribute("aria-busy");
          if (magicToggleState) {
            magicToggleState.textContent = isMagicOff() ? "Off" : "On";
          }
        });
    }
  });
  function spawnTouchDrop(clientX, clientY) {
    if (!isTouch || reduceMotion || isMagicOff()) return;
    const drop = document.createElement("span");
    drop.className = "touch-drop";
    drop.style.left = `${clientX}px`;
    drop.style.top = `${clientY}px`;
    document.body.appendChild(drop);
    drop.addEventListener("animationend", () => drop.remove(), { once: true });
  }
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse") return;
      spawnTouchDrop(event.clientX, event.clientY);
    },
    { passive: true },
  );
  const ambientLight = document.getElementById("ambient-light");
  if (webglContainer && !reduceMotion) {
    let waveFrame = null;
    let waveX = window.innerWidth * 0.66;
    let waveY = window.innerHeight * 0.55;
    let waveEnergy = isTouch ? 0.34 : 0.42;
    const updateWaveWake = () => {
      webglContainer.style.setProperty("--wave-x", `${waveX}px`);
      webglContainer.style.setProperty("--wave-y", `${waveY}px`);
      webglContainer.style.setProperty("--wave-glow-opacity", String(waveEnergy));
      waveFrame = null;
    };
    const scheduleWaveWake = (event, energy) => {
      if (isMagicOff()) return;
      waveX = event.clientX;
      waveY = event.clientY;
      waveEnergy = energy;
      if (!waveFrame) waveFrame = requestAnimationFrame(updateWaveWake);
    };
    window.addEventListener(
      "pointermove",
      (event) => scheduleWaveWake(event, isTouch ? 0.52 : 0.62),
      { passive: true },
    );
    window.addEventListener(
      "pointerdown",
      (event) => scheduleWaveWake(event, isTouch ? 0.8 : 0.86),
      { passive: true },
    );
    window.addEventListener(
      "pointerup",
      (event) => scheduleWaveWake(event, isTouch ? 0.42 : 0.46),
      { passive: true },
    );
    updateWaveWake();
  }
  if (ambientLight && !reduceMotion && !isTouch && !isMagicOff()) {
    let ambientFrame = null;
    let ambientX = window.innerWidth * 0.7;
    let ambientY = window.innerHeight * 0.3;
    window.addEventListener(
      "pointermove",
      (event) => {
        ambientX = event.clientX;
        ambientY = event.clientY;
        if (ambientFrame) return;
        ambientFrame = requestAnimationFrame(() => {
          ambientLight.style.setProperty("--ambient-x", `${ambientX}px`);
          ambientLight.style.setProperty("--ambient-y", `${ambientY}px`);
          ambientFrame = null;
        });
      },
      { passive: true },
    );
  }
  function splitText(selector) {
    document.querySelectorAll(selector).forEach((element) => {
      const text = element.textContent;
      const heading = element.closest("h1");
      if (heading && !heading.hasAttribute("aria-label")) {
        heading.setAttribute(
          "aria-label",
          heading.textContent.trim().replace(/\s+/g, " "),
        );
      }
      element.textContent = "";
      element.setAttribute("aria-hidden", "true");
      text.split("").forEach((character) => {
        const span = document.createElement("span");
        span.className = "char";
        if (character === " ") span.classList.add("char-space");
        span.innerHTML = character === " " ? "&nbsp;" : character;
        element.appendChild(span);
      });
    });
  }
  splitText(".split-text");
  if (hasGsap && !reduceMotion && !isMagicOff()) {
    if (hasScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    gsap.set(".hero .char", { y: "105%", opacity: 0 });
    gsap.set(".hero .reveal-up", { y: 32, opacity: 0 });
    const heroTimeline = gsap.timeline({ defaults: { ease: "power4.out" } });
    heroTimeline
      .to(".hero .char", {
        y: "0%",
        opacity: 1,
        duration: 1.3,
        stagger: 0.017,
        delay: 0.12,
      })
      .to(
        ".hero .reveal-up",
        { y: 0, opacity: 1, duration: 1.1, stagger: 0.1 },
        "-=0.95",
      );
    if (hasScrollTrigger && !isTouch) {
      document.querySelectorAll("[data-reveal]").forEach((element, index) => {
        const isTiltSurface = element.hasAttribute("data-tilt");
        const parentGrid = element.closest(".capability-grid, .systems-showroom");
        const siblingIndex = parentGrid
          ? [...parentGrid.children].indexOf(element)
          : index;
        const fromVars = isTiltSurface
          ? { opacity: 0, filter: "blur(8px)" }
          : {
              y: 64,
              opacity: 0,
              rotateX: element.classList.contains("capability-entry") ? 7 : 0,
              transformPerspective: 1000,
            };
        const toVars = isTiltSurface
          ? {
              opacity: 1,
              filter: "blur(0px)",
              duration: 1,
              ease: "power3.out",
            }
          : {
              y: 0,
              opacity: 1,
              rotateX: 0,
              duration: 1.05,
              ease: "power3.out",
            };
        gsap.fromTo(element, fromVars, {
          ...toVars,
          delay: parentGrid ? Math.min(siblingIndex * 0.08, 0.24) : 0,
          scrollTrigger: {
            trigger: element,
            start: "top 88%",
            once: true,
          },
        });
      });
      document.querySelectorAll(".system-visual").forEach((visual) => {
        gsap.fromTo(
          visual,
          { y: 45 },
          {
            y: -25,
            ease: "none",
            scrollTrigger: {
              trigger: visual.closest(".system-card"),
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          },
        );
      });
      gsap.to("#journey-progress", {
        scaleY: 1,
        ease: "none",
        scrollTrigger: {
          trigger: document.documentElement,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.4,
        },
      });
    } else if (isTouch || isMagicOff()) {
      gsap.set("[data-reveal]", {
        opacity: 1,
        y: 0,
        rotateX: 0,
        filter: "none",
      });
    }
  }
  const methodSteps = [...document.querySelectorAll("[data-method-step]")];
  const methodCores = [...document.querySelectorAll("[data-method-core]")];
  function activateMethodStep(stepNumber) {
    methodSteps.forEach((step) => {
      const isActive = step.dataset.methodStep === String(stepNumber);
      step.classList.toggle("is-active", isActive);
      step
        .querySelector(".method-step-hit")
        ?.setAttribute("aria-pressed", String(isActive));
    });
    const labels = {
      1: "Observe",
      2: "Model",
      3: "Engineer",
      4: "Stress",
    };
    methodCores.forEach((methodCore) => {
      methodCore.dataset.methodCore = String(stepNumber);
      methodCore.querySelector("strong").textContent = `0${stepNumber}`;
      methodCore.querySelector("small").textContent = labels[stepNumber];
    });
  }
  methodSteps.forEach((step) => {
    const activate = () => activateMethodStep(Number(step.dataset.methodStep));
    step.addEventListener("click", activate);
  });
  if (hasScrollTrigger && hasGsap && !reduceMotion) {
    methodSteps.forEach((step) => {
      const stepNumber = Number(step.dataset.methodStep);
      ScrollTrigger.create({
        trigger: step,
        start: "top 56%",
        end: "bottom 44%",
        onEnter: () => activateMethodStep(stepNumber),
        onEnterBack: () => activateMethodStep(stepNumber),
      });
    });
  } else if ("IntersectionObserver" in window) {
    const methodObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activateMethodStep(Number(entry.target.dataset.methodStep));
          }
        });
      },
      { rootMargin: "-38% 0px -38% 0px" },
    );
    methodSteps.forEach((step) => methodObserver.observe(step));
  }
  const chapterLinks = [...document.querySelectorAll("[data-section-link]")];
  const chapters = [...document.querySelectorAll("[data-chapter]")];
  const chapterOrder = ["top", "systems", "pillars", "capabilities", "method", "contact"];
  const chapterNames = {
    top: "Intro",
    systems: "Work",
    pillars: "Build",
    capabilities: "Expertise",
    method: "Approach",
    contact: "Contact",
  };
  const pageOrbit = document.querySelector("[data-page-orbit]");
  const pageOrbitNumber = pageOrbit?.querySelector("[data-page-orbit-number]");
  const pageOrbitName = pageOrbit?.querySelector("[data-page-orbit-name]");
  let activeChapter = "top";
  function activateChapter(chapterName) {
    activeChapter = chapterName;
    document.body.dataset.activeChapter = chapterName;
    chapterLinks.forEach((link) => {
      const isActive = link.dataset.sectionLink === chapterName;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    const chapterIndex = Math.max(0, chapterOrder.indexOf(chapterName));
    if (pageOrbitNumber) pageOrbitNumber.textContent = String(chapterIndex).padStart(2, "0");
    if (pageOrbitName) pageOrbitName.textContent = chapterNames[chapterName] || "Intro";
    if (pageOrbit) pageOrbit.dataset.orbitState = chapterName;
  }
  activateChapter("top");
  if ("IntersectionObserver" in window) {
    const chapterObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) activateChapter(visible.target.dataset.chapter);
      },
      { rootMargin: "-34% 0px -52% 0px", threshold: [0, 0.1, 0.4] },
    );
    chapters.forEach((chapter) => chapterObserver.observe(chapter));
  }
  function updatePageProgress() {
    if (!pageOrbit) return;
    const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const progress = Math.max(0, Math.min(1, window.scrollY / scrollable));
    pageOrbit.style.setProperty("--page-progress", `${(progress * 100).toFixed(2)}%`);
  }
  window.addEventListener("scroll", updatePageProgress, { passive: true });
  window.addEventListener("resize", updatePageProgress, { passive: true });
  updatePageProgress();
  pageOrbit?.addEventListener("click", () => {
    const currentIndex = Math.max(0, chapterOrder.indexOf(activeChapter));
    const nextChapter = chapterOrder[(currentIndex + 1) % chapterOrder.length];
    document.querySelector(`[data-chapter="${nextChapter}"]`)?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  });
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const hash = link.getAttribute("href");
      if (!hash || hash === "#") return;
      const targetId = hash.slice(1);
      const escapedTargetId = window.CSS?.escape
        ? CSS.escape(targetId)
        : targetId.replaceAll('"', '\\"');
      const target =
        document.getElementById(targetId) ||
        document.querySelector(`[data-chapter="${escapedTargetId}"]`);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({
        behavior: reduceMotion || hasScrollTrigger ? "auto" : "smooth",
        block: "start",
      });
      history.pushState(null, "", hash);
    });
  });
  const capabilityContent = {
    backend: {
      number: "01",
      kicker: "Backend foundation",
      title: "Backend Engineering",
      summary:
        "We design the services, data flows, and operational controls behind products that need to stay fast and dependable as usage grows.",
      deliverables: [
        "API and service architecture",
        "Data pipelines and storage design",
        "Performance and reliability plans",
      ],
      fit: [
        "Products outgrowing an early stack",
        "Teams facing slow or fragile releases",
        "Platforms with complex integrations",
      ],
      focus: [
        "Latency and capacity",
        "Data integrity",
        "Safe deployment and recovery",
      ],
      outcome: "A backend your product team can build on without fighting the foundation.",
      accent: "#7ea9ad",
      rgb: "126, 169, 173",
    },
    security: {
      number: "02",
      kicker: "Security protection",
      title: "Security Testing",
      summary:
        "We examine software, payment logic, hardware interfaces, and trust boundaries from an attacker’s point of view, then turn findings into practical fixes.",
      deliverables: [
        "Threat model and attack map",
        "Protocol and application review",
        "Prioritized findings with fixes",
      ],
      fit: [
        "Products preparing to launch",
        "Payment and identity systems",
        "Products connected to hardware",
      ],
      focus: [
        "Business-logic abuse",
        "Access and identity controls",
        "Recovery after compromise",
      ],
      outcome: "Clear evidence of where risk lives and a realistic path to reduce it.",
      accent: "#9185a2",
      rgb: "145, 133, 162",
    },
    quant: {
      number: "03",
      kicker: "Market research",
      title: "Market Research Tools",
      summary:
        "We build research and execution environments that make market ideas testable, measurable, and safer to operate.",
      deliverables: [
        "Historical simulation engines",
        "Signal and regime research tools",
        "Execution and risk controls",
      ],
      fit: [
        "Systematic trading research",
        "Data-heavy decision teams",
        "Strategies moving toward automation",
      ],
      focus: [
        "Research integrity",
        "Execution quality",
        "Risk and failure controls",
      ],
      outcome: "A disciplined path from market hypothesis to observable execution.",
      accent: "#b99a64",
      rgb: "185, 154, 100",
    },
    autonomy: {
      number: "04",
      kicker: "Robotics and motion",
      title: "Robotics and Control",
      summary:
        "We connect sensing, decision logic, and control software so machines can act reliably in changing physical environments.",
      deliverables: [
        "Control and mission logic",
        "Simulation and safety states",
        "Hardware and sensor integration",
      ],
      fit: [
        "Drone and robotics platforms",
        "Remote monitoring systems",
        "Edge devices with real-time decisions",
      ],
      focus: [
        "Deterministic control",
        "Degraded-mode behavior",
        "Human override and safety",
      ],
      outcome: "Machines that remain predictable when conditions stop being ideal.",
      accent: "#778fa6",
      rgb: "119, 143, 166",
    },
    ai: {
      number: "05",
      kicker: "Practical operations",
      title: "Decision and Workflow Tools",
      summary:
        "We build practical staff tools around real work: finding the right records, preparing routine actions, and giving people a clear point of review.",
      deliverables: [
        "Case triage and staff tools",
        "Search across company records",
        "Quality checks and audit trails",
      ],
      fit: [
        "Teams buried in repetitive admin",
        "Products with slow staff handoffs",
        "Operations needing faster answers",
      ],
      focus: [
        "Useful, traceable suggestions",
        "Fast access to source records",
        "Clear review before action",
      ],
      outcome: "Less repetitive work, faster service, and a clear person responsible for every important decision.",
      accent: "#72988b",
      rgb: "114, 152, 139",
    },
    commerce: {
      number: "06",
      kicker: "Commerce experience",
      title: "Commerce Platforms",
      summary:
        "We connect discovery, payments, service, and operations into commerce experiences that feel simple to customers and manageable to teams.",
      deliverables: [
        "Catalog and search experiences",
        "Payment and order workflows",
        "Concierge and operations tools",
      ],
      fit: [
        "Curated marketplaces",
        "Service-led commerce",
        "Multi-step ordering businesses",
      ],
      focus: [
        "Conversion and trust",
        "Payment reliability",
        "Operational visibility",
      ],
      outcome: "A smoother route from customer intent to completed delivery.",
      accent: "#a4777d",
      rgb: "164, 119, 125",
    },
    vision: {
      number: "07",
      kicker: "Vision and perception",
      title: "Computer Vision",
      summary:
        "We develop visual tools that detect, track, inspect, and interpret activity from cameras and sensors in real time.",
      deliverables: [
        "Detection and tracking pipelines",
        "Inspection and anomaly systems",
        "Edge inference integration",
      ],
      fit: [
        "Physical operations and logistics",
        "Safety and quality monitoring",
        "Robotics needing visual awareness",
      ],
      focus: [
        "Accuracy in real conditions",
        "Edge performance",
        "Privacy-aware data handling",
      ],
      outcome: "Visual awareness that turns physical activity into timely action.",
      accent: "#8c7f9a",
      rgb: "140, 127, 154",
    },
    reliability: {
      number: "08",
      kicker: "Cloud operations",
      title: "Cloud Operations",
      summary:
        "We make delivery repeatable and production behavior visible, so teams can release with confidence and recover quickly.",
      deliverables: [
        "Cloud and container architecture",
        "Delivery automation",
        "Monitoring, alerts, and runbooks",
      ],
      fit: [
        "Teams scaling production traffic",
        "Products with painful deployments",
        "Products with weak visibility",
      ],
      focus: [
        "Release safety",
        "Useful observability",
        "Recovery time and resilience",
      ],
      outcome: "A production environment that tells the truth and helps the team respond.",
      accent: "#8fa16f",
      rgb: "143, 161, 111",
    },
  };
  const capabilityDialog = document.getElementById("capability-dialog");
  const capabilityOpeners = [...document.querySelectorAll("[data-capability-open]")];
  const capabilityDialogModel = document.getElementById("capability-dialog-model");
  const capabilityDialogStage = document.querySelector("[data-dialog-stage]");
  const cursorLens = document.getElementById("cursor-lens");
  let lastCapabilityTrigger = null;
  let activeCapabilityKey = "backend";
  function fillList(elementId, items) {
    const list = document.getElementById(elementId);
    if (!list) return;
    list.replaceChildren(
      ...items.map((item) => {
        const listItem = document.createElement("li");
        listItem.textContent = item;
        return listItem;
      }),
    );
  }
  const capabilitySteps = {
    backend: ["Checkout placed", "Request checked", "Order saved", "Stock updated", "Customer confirmed"],
    security: ["Payment replayed", "Weak rule exposed", "Fix applied", "Attack repeated", "Payment protected"],
    quant: ["Idea written", "History tested", "Risk limited", "Trade checked", "Order recorded"],
    autonomy: ["Site observed", "Route planned", "Wind corrected", "Inspection completed", "Vehicle returned"],
    ai: ["Request received", "Records found", "Reply prepared", "Person approved", "Customer updated"],
    commerce: ["Product chosen", "M-Pesa paid", "Merchant alerted", "Order packed", "Delivery confirmed"],
    vision: ["Parcel enters", "Camera identifies", "Damage checked", "Count updated", "Evidence sent"],
    reliability: ["Release prepared", "One region tested", "Health confirmed", "Traffic moved", "Backup ready"],
  };
  const capabilityArchitectures = {
    backend: {
      eyebrow: "A real order moving through production",
      pace: 3400,
      title: "Production service architecture",
      boundaries: ["Identity boundary", "Cloud runtime"],
      nodes: [
        ["Client", "Request"],
        ["Gateway", "Route and auth"],
        ["Services", "Business logic"],
        ["Queue", "Async work"],
        ["Data", "Store and return"],
      ],
    },
    security: {
      eyebrow: "A payment attack tested and stopped",
      pace: 3900,
      title: "Adversarial test sequence",
      boundaries: ["Controlled test zone", "Verified remediation"],
      nodes: [
        ["Surface", "Map exposure"],
        ["Probe", "Test assumptions"],
        ["Invariant", "Find logic breaks"],
        ["Priority", "Rank impact"],
        ["Verify", "Retest the fix"],
      ],
    },
    quant: {
      eyebrow: "A trade idea proving its limits",
      pace: 3700,
      title: "Research to execution pipeline",
      boundaries: ["Historical sandbox", "Risk controlled output"],
      nodes: [
        ["Feed", "Clean data"],
        ["Signal", "Form thesis"],
        ["Backtest", "Measure evidence"],
        ["Risk", "Limit exposure"],
        ["Execution", "Place and record"],
      ],
    },
    autonomy: {
      eyebrow: "A drone completing a safe inspection",
      pace: 4200,
      title: "Closed loop control system",
      boundaries: ["Real time loop", "Hardware safety limit"],
      nodes: [
        ["Sensors", "Read environment"],
        ["State", "Estimate position"],
        ["Planner", "Choose motion"],
        ["Control", "Correct trajectory"],
        ["Actuator", "Move and report"],
      ],
    },
    ai: {
      eyebrow: "A customer request with human control",
      pace: 4100,
      title: "Request to reviewed action",
      boundaries: ["Company records", "Named person in control"],
      nodes: [
        ["Request", "Read the case"],
        ["Records", "Find the facts"],
        ["Draft", "Prepare the action"],
        ["Review", "Person decides"],
        ["Update", "Close the loop"],
      ],
    },
    commerce: {
      eyebrow: "A purchase becoming a delivery",
      pace: 3600,
      title: "Customer to fulfilment flow",
      boundaries: ["Payment trust zone", "Operations handoff"],
      nodes: [
        ["Discover", "Find the right item"],
        ["Cart", "Build order"],
        ["Payment", "Authorise securely"],
        ["Route", "Send to operations"],
        ["Confirm", "Close the loop"],
      ],
    },
    vision: {
      eyebrow: "A camera turning motion into evidence",
      pace: 3800,
      title: "Edge perception pipeline",
      boundaries: ["On device processing", "Actionable event"],
      nodes: [
        ["Camera", "Capture frame"],
        ["Detect", "Locate objects"],
        ["Track", "Follow movement"],
        ["Decide", "Apply rules"],
        ["Alert", "Send evidence"],
      ],
    },
    reliability: {
      eyebrow: "A release reaching production safely",
      pace: 4000,
      title: "Release and recovery loop",
      boundaries: ["Automated delivery", "Observable production"],
      nodes: [
        ["Build", "Package change"],
        ["Deploy", "Release safely"],
        ["Observe", "Read health"],
        ["Respond", "Contain failure"],
        ["Recover", "Restore service"],
      ],
    },
  };
  const capabilityExperiences = {
    backend: {
      eyebrow: "Production run",
      title: "A real order reaches the customer",
      description: "A buyer taps checkout, the platform protects the request, stock is reserved, and the customer gets a clean confirmation.",
      modeText: ["Normal demand: order to receipt.", "Peak demand: queues absorb pressure.", "Failure: traffic moves around the problem."],
      modes: ["Order", "Peak hour", "Recover"],
      story: [
        ["Customer", "A buyer starts checkout"],
        ["Gateway", "Identity and request are checked"],
        ["Stock", "Inventory is reserved safely"],
        ["Receipt", "The customer gets confirmation"],
      ],
      metrics: [["P95 latency", "42 ms"], ["Queue", "Draining"], ["Errors", "0.02%"]],
      visual: "backend",
    },
    security: {
      eyebrow: "Security lab",
      title: "A copied payment signal gets stopped",
      description: "The lab repeats a real attack path, proves where it breaks, ships the patch, and leaves evidence the team can trust.",
      modeText: ["Probe: the reader receives a tap.", "Replay: the copy is rejected.", "Proof: the report is sealed."],
      modes: ["Probe", "Replay", "Proof"],
      story: [
        ["Tap", "A real payment signal is captured"],
        ["Replay", "The copied attempt is tested"],
        ["Patch", "The weak path is closed"],
        ["Evidence", "The fix is documented"],
      ],
      metrics: [["Replay", "Blocked"], ["Risk", "High to low"], ["Evidence", "Saved"]],
      visual: "security",
    },
    quant: {
      eyebrow: "Research desk",
      title: "A trade idea earns permission",
      description: "A signal is checked against history, risk is measured before money moves, and only the sized order reaches execution.",
      modeText: ["Replay: test the idea first.", "Risk: cap the downside.", "Execute: record the decision."],
      modes: ["Replay", "Risk", "Execute"],
      story: [
        ["Signal", "A market idea appears"],
        ["History", "It is replayed against past data"],
        ["Risk", "Loss limits decide size"],
        ["Ticket", "Only approved trades move"],
      ],
      metrics: [["Drawdown", "Capped"], ["Position", "0.20 lots"], ["Log", "Recorded"]],
      visual: "quant",
    },
    autonomy: {
      eyebrow: "Field mission",
      title: "A drone inspects without guessing",
      description: "The route is planned from the site map, wind is corrected mid-flight, and a human can take over at any moment.",
      modeText: ["Plan: build the route.", "Inspect: hold steady over the target.", "Return: land with evidence."],
      modes: ["Plan", "Inspect", "Return"],
      story: [
        ["Map", "The route is drawn from the site"],
        ["Wind", "Drift is corrected in flight"],
        ["Inspect", "The target is held in frame"],
        ["Return", "Evidence lands with override ready"],
      ],
      metrics: [["Wind", "11 km/h"], ["Altitude", "24 m"], ["Override", "Ready"]],
      visual: "autonomy",
    },
    ai: {
      eyebrow: "Operations desk",
      title: "Routine work stays human-approved",
      description: "A customer request is matched to the right records, prepared carefully, and approved by a named person before it leaves.",
      modeText: ["Find: gather the records.", "Prepare: write the response.", "Approve: a person signs off."],
      modes: ["Find", "Prepare", "Approve"],
      story: [
        ["Request", "A customer asks for help"],
        ["Records", "The right sources are checked"],
        ["Draft", "A careful response is prepared"],
        ["Human", "A named person approves it"],
      ],
      metrics: [["Sources", "3 checked"], ["Review", "Amina"], ["Audit", "Traceable"]],
      visual: "ai",
    },
    commerce: {
      eyebrow: "Commerce floor",
      title: "A buyer becomes a fulfilled order",
      description: "Discovery, M-Pesa payment, merchant packing, and customer updates move in one visible chain.",
      modeText: ["Choose: the buyer commits.", "Pay: the merchant gets proof.", "Deliver: the customer stays updated."],
      modes: ["Choose", "Pay", "Deliver"],
      story: [
        ["Browse", "A product is selected"],
        ["M-Pesa", "Payment proof arrives"],
        ["Merchant", "The order is packed"],
        ["Customer", "Delivery updates are sent"],
      ],
      metrics: [["Payment", "M-Pesa"], ["Merchant", "Accepted"], ["Customer", "Updated"]],
      visual: "commerce",
    },
    vision: {
      eyebrow: "Camera floor",
      title: "Movement turns into evidence",
      description: "The camera watches the real floor, follows parcels, keeps the safety zone clear, and sends only the useful frame.",
      modeText: ["Detect: see the object.", "Track: follow the movement.", "Alert: send proof, not noise."],
      modes: ["Detect", "Track", "Alert"],
      story: [
        ["Camera", "The floor is watched live"],
        ["Detect", "Objects are found in frame"],
        ["Track", "Movement is followed"],
        ["Proof", "Only useful evidence is sent"],
      ],
      metrics: [["Match", "98%"], ["Count", "24"], ["Alert", "Frame sent"]],
      visual: "vision",
    },
    reliability: {
      eyebrow: "Release room",
      title: "A deployment earns production traffic",
      description: "The release warms one region, watches customer health, shifts traffic when it is safe, and keeps rollback ready.",
      modeText: ["Canary: small traffic first.", "Observe: health before pride.", "Shift: move only when ready."],
      modes: ["Canary", "Observe", "Shift"],
      story: [
        ["Canary", "A small group gets the release"],
        ["Health", "Real customer signals are watched"],
        ["Shift", "Traffic moves only when safe"],
        ["Rollback", "A clean escape path stays ready"],
      ],
      metrics: [["Regions", "3 healthy"], ["Traffic", "100%"], ["Rollback", "Ready"]],
      visual: "reliability",
    },
  };
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }
  const capabilityPreviewMaps = {
    backend: {
      title: "Basket to packed order",
      route: "Customer pays, the API checks it, stock is reserved, and the receipt lands on the phone.",
      steps: ["Pay", "Verify", "Reserve", "Notify"],
      status: "Live service flow",
      mark: "Checkout desk",
    },
    security: {
      title: "Tap reader under test",
      route: "A payment tap is replayed in the lab, blocked, patched, and saved as evidence.",
      steps: ["Tap", "Replay", "Block", "Evidence"],
      status: "Risk closed",
      mark: "Lab proof",
    },
    quant: {
      title: "Research desk",
      route: "A market idea is replayed through old sessions before risk allows a clean ticket.",
      steps: ["Signal", "Replay", "Size", "Ticket"],
      status: "Controlled decision",
      mark: "Market research",
    },
    autonomy: {
      title: "Field inspection",
      route: "A route is planned, corrected on site, inspected, and returned with usable proof.",
      steps: ["Map", "Route", "Correct", "Evidence"],
      status: "Override ready",
      mark: "Operator in control",
    },
    ai: {
      title: "Human-approved ops",
      route: "A request meets the right records, a draft is prepared, and a person approves the answer.",
      steps: ["Request", "Records", "Draft", "Approve"],
      status: "Human signed",
      mark: "People stay in control",
    },
    commerce: {
      title: "Merchant fulfilment",
      route: "Product choice, M-Pesa proof, packing, dispatch, and customer updates stay together.",
      steps: ["Choose", "Pay", "Pack", "Dispatch"],
      status: "Customer updated",
      mark: "Hazina route",
    },
    vision: {
      title: "Warehouse camera",
      route: "A camera watches the real scene, detects the useful frame, and sends proof only when needed.",
      steps: ["Watch", "Detect", "Track", "Proof"],
      status: "Frame sent",
      mark: "Useful frames only",
    },
    reliability: {
      title: "Canary release",
      route: "A new version reaches a small group first while health and rollback stay ready.",
      steps: ["Canary", "Check", "Shift", "Recover"],
      status: "Production safe",
      mark: "Quiet launches",
    },
  };
  function hydrateCapabilityPreviewMaps() {
    document.querySelectorAll(".capability-model[data-model]").forEach((model) => {
      if (model.querySelector(".model-case-map")) return;
      const preview = capabilityPreviewMaps[model.dataset.model || ""];
      if (!preview) return;
      const map = document.createElement("div");
      const modelKey = model.dataset.model || "";
      map.className = `model-case-map model-case-${modelKey}`;
      const steps = preview.steps
        .map((step, index) => `<li style="--case-step:${index}"><span>${escapeHtml(step)}</span></li>`)
        .join("");
      map.innerHTML = `
        <small>${escapeHtml(preview.status)}</small>
        <strong>${escapeHtml(preview.title)}</strong>
        <em>${escapeHtml(preview.mark || "Real system")}</em>
        <p>${escapeHtml(preview.route)}</p>
        <ol>${steps}</ol>
      `;
      model.appendChild(map);
    });
  }
  hydrateCapabilityPreviewMaps();
  const experienceVisuals = {
    backend: () => `
      <div class="realworld-scene realworld-backend">
        <div class="rw-browser"><span>Customer checkout</span><b>Hazina basket</b><i>Pay now</i></div>
        <div class="rw-service rw-service-api"><span>API gateway</span><b>Auth passed</b></div>
        <div class="rw-service rw-service-orders"><span>Order service</span><b>42 ms</b></div>
        <div class="rw-stockroom"><span>Stock room</span><b>1 reserved</b><i></i><i></i><i></i></div>
        <div class="rw-receipt-phone"><span>Customer phone</span><b>Confirmed</b></div>
        <span class="rw-route rw-route-a"></span><span class="rw-route rw-route-b"></span><span class="rw-route rw-route-c"></span>
        <span class="rw-order-slip"></span><span class="rw-queue-dot dot-one"></span><span class="rw-queue-dot dot-two"></span>
      </div>
    `,
    security: () => `
      <div class="realworld-scene realworld-security">
        <div class="rw-lab-table"></div>
        <div class="rw-reader"><span>Tap reader</span><i></i><i></i><i></i></div>
        <div class="rw-bank-card"><b>Card</b><span>4721</span></div>
        <div class="rw-clone-card"><b>Replay copy</b><span>Rejected</span></div>
        <div class="rw-shield-wall"><i></i><span>Patch verified</span></div>
        <div class="rw-report"><span>Evidence pack</span><b>Saved</b><em></em></div>
        <span class="rw-lab-signal"></span>
      </div>
    `,
    quant: () => `
      <div class="realworld-scene realworld-quant">
        <div class="rw-trading-screen"><span>XAU/USD research</span><svg viewBox="0 0 320 130" aria-hidden="true"><polyline points="0,104 36,96 68,109 104,72 142,84 180,46 220,58 262,31 320,18"></polyline></svg><i></i><i></i><i></i><i></i></div>
        <div class="rw-risk-dial"><span>Risk gate</span><b>0.6%</b><em></em></div>
        <div class="rw-research-notes"><span>Notebook</span><b>Setup valid</b><i></i><i></i></div>
        <div class="rw-order-ticket"><span>Execution ticket</span><b>Buy 0.20</b></div>
        <span class="rw-market-puck"></span>
      </div>
    `,
    autonomy: () => `
      <div class="realworld-scene realworld-autonomy">
        <div class="rw-site-map"><span>Inspection site</span><i class="site-block block-a"></i><i class="site-block block-b"></i><i class="site-block block-c"></i></div>
        <div class="rw-control-tablet"><span>Operator</span><b>Override ready</b></div>
        <div class="rw-drone-craft"><i></i><b></b><b></b><b></b><b></b><em></em></div>
        <div class="rw-windsock"><span>Wind</span><b>11 km/h</b></div>
        <div class="rw-target-photo"><span>Evidence frame</span><b>Panel inspected</b></div>
        <span class="rw-flight-path"></span>
      </div>
    `,
    ai: () => `
      <div class="realworld-scene realworld-ops">
        <div class="rw-inbox-card"><span>Customer message</span><b>Move delivery to Friday</b></div>
        <div class="rw-record-stack"><i>Order history</i><i>Policy</i><i>Stock calendar</i></div>
        <div class="rw-draft-panel"><span>Prepared response</span><b>Friday is available.</b></div>
        <div class="rw-human-approval"><i></i><span>Amina approves</span><em>Send</em></div>
        <span class="rw-desk-line"></span>
      </div>
    `,
    commerce: () => `
      <div class="realworld-scene realworld-commerce">
        <div class="rw-shop-shelf"><span>Hazina shop</span><b>Handwoven basket</b><em>KES 3,480</em></div>
        <div class="rw-phone-pay"><i>M</i><span>M-Pesa proof</span></div>
        <div class="rw-pack-bench"><span>Merchant bench</span><b>Packed for Friday</b><i></i></div>
        <div class="rw-rider"><i></i><b></b><span>Dispatch</span></div>
        <div class="rw-doorstep"><span>Customer</span><b>Updated</b></div>
        <span class="rw-commerce-road"></span>
      </div>
    `,
    vision: () => `
      <div class="realworld-scene realworld-vision">
        <div class="rw-camera-rig"><i></i><span>Camera 03</span></div>
        <div class="rw-warehouse-belt"><i class="rw-parcel parcel-a"></i><i class="rw-parcel parcel-b"></i><i class="rw-parcel parcel-c"></i><span class="rw-safe-zone">Safe zone</span></div>
        <div class="rw-detection-frame"><span>Parcel 98%</span><b></b></div>
        <div class="rw-evidence-card"><span>Evidence</span><b>Frame sent</b></div>
        <span class="rw-camera-beam"></span>
      </div>
    `,
    reliability: () => `
      <div class="realworld-scene realworld-reliability">
        <div class="rw-release-console"><span>Release v2.4</span><b>checkout-service</b><em>Deploy</em></div>
        <div class="rw-region-board"><i>Nairobi</i><i>Frankfurt</i><i>Backup</i></div>
        <div class="rw-health-board"><span>Customer health</span><b></b></div>
        <div class="rw-rollback-lever"><span>Rollback</span><b>Ready</b></div>
        <div class="rw-oncall-card"><span>On-call</span><b>Watching</b></div>
        <span class="rw-release-route"></span>
      </div>
    `,
  };
  function createExperienceStage(capabilityKey, architecture) {
    const experience = capabilityExperiences[capabilityKey] || capabilityExperiences.backend;
    const blueprint = document.createElement("section");
    blueprint.className = `architecture-blueprint experience-stage experience-${experience.visual}`;
    blueprint.dataset.capability = capabilityKey;
    blueprint.dataset.experienceMode = "0";

    const heading = document.createElement("header");
    heading.className = "architecture-heading experience-heading";
    const eyebrow = document.createElement("span");
    eyebrow.textContent = experience.eyebrow || architecture?.eyebrow || "System detail";
    const title = document.createElement("strong");
    title.textContent = experience.title || architecture?.title || "How the system works";
    heading.append(eyebrow, title);

    const visual = document.createElement("div");
    visual.className = "experience-visual";
    visual.innerHTML = experienceVisuals[experience.visual]?.() || "";

    const copy = document.createElement("div");
    copy.className = "experience-copy";
    const description = document.createElement("p");
    description.textContent = experience.description;
    const modeCopy = document.createElement("small");
    modeCopy.textContent = experience.modeText?.[0] || experience.modes?.[0] || "Live";
    copy.append(description, modeCopy);

    const storyline = document.createElement("ol");
    storyline.className = "experience-storyline";
    (experience.story || []).forEach(([label, detail], index) => {
      const item = document.createElement("li");
      item.style.setProperty("--beat", String(index));
      item.innerHTML = `<span>${escapeHtml(label)}</span><b>${escapeHtml(detail)}</b>`;
      storyline.appendChild(item);
    });

    const controls = document.createElement("div");
    controls.className = "experience-controls";
    (experience.modes || []).forEach((label, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = index === 0 ? "is-active" : "";
      button.setAttribute("aria-pressed", String(index === 0));
      button.addEventListener("click", () => {
        blueprint.dataset.experienceMode = String(index);
        controls.querySelectorAll("button").forEach((control, controlIndex) => {
          const active = controlIndex === index;
          control.classList.toggle("is-active", active);
          control.setAttribute("aria-pressed", String(active));
        });
        modeCopy.textContent = experience.modeText?.[index] || label;
        visual.style.animation = "none";
        visual.offsetHeight;
        visual.style.animation = "";
      });
      controls.appendChild(button);
    });

    const metrics = document.createElement("div");
    metrics.className = "experience-metrics";
    (experience.metrics || []).forEach(([label, value]) => {
      const metric = document.createElement("span");
      metric.innerHTML = `<small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b>`;
      metrics.appendChild(metric);
    });

    blueprint.append(heading, visual, copy, storyline, controls, metrics);
    return blueprint;
  }
  function renderDialogModel(capabilityKey) {
    const source = document
      .querySelector(`[data-capability-open="${capabilityKey}"]`)
      ?.closest(".capability-card")
      ?.querySelector(".capability-model");
    if (!source || !capabilityDialogModel) return;
    const model = source.cloneNode(true);
    model.removeAttribute("data-model");
    model.classList.add("dialog-source-model");
    const architecture = capabilityArchitectures[capabilityKey];
    const blueprint = createExperienceStage(capabilityKey, architecture);
    capabilityDialogModel.replaceChildren(model, blueprint);
  }
  function openCapability(capabilityKey, trigger) {
    const content = capabilityContent[capabilityKey];
    if (!content || !capabilityDialog) return;
    activeCapabilityKey = capabilityKey;
    lastCapabilityTrigger = trigger;
    capabilityDialog.style.setProperty("--dialog-accent", content.accent);
    capabilityDialog.style.setProperty("--dialog-rgb", content.rgb);
    document.getElementById("capability-dialog-number").textContent = content.number;
    document.getElementById("capability-dialog-kicker").textContent = content.kicker;
    document.getElementById("capability-dialog-title").textContent = content.title;
    document.getElementById("capability-dialog-summary").textContent = content.summary;
    document.getElementById("capability-dialog-outcome").textContent = content.outcome;
    fillList("capability-dialog-deliverables", content.deliverables);
    fillList("capability-dialog-fit", content.fit);
    fillList("capability-dialog-focus", content.focus);
    renderDialogModel(capabilityKey);
    const dialogShell = capabilityDialog.querySelector(".capability-dialog-shell");
    const dialogCopy = capabilityDialog.querySelector(".capability-stage-copy");
    if (dialogShell) dialogShell.scrollTop = 0;
    if (dialogCopy) dialogCopy.scrollTop = 0;
    document.body.classList.remove("cursor-expanded", "cursor-labeled");
    document.body.classList.add("dialog-open");
    if (typeof capabilityDialog.showModal === "function") capabilityDialog.showModal();
    else capabilityDialog.setAttribute("open", "");
    requestAnimationFrame(() => {
      if (dialogShell) dialogShell.scrollTop = 0;
      if (dialogCopy) dialogCopy.scrollTop = 0;
    });
    if (cursorLens && document.body.classList.contains("custom-cursor")) {
      capabilityDialog.appendChild(cursorLens);
    }
  }
  function closeCapability() {
    if (!capabilityDialog?.open) return;
    capabilityDialog.close();
  }
  capabilityOpeners.forEach((opener) => {
    const card = opener.closest(".capability-card");
    let movedInsideCard = false;
    let cardPointerActive = false;
    let cardPointerStart = { x: 0, y: 0 };
    let cardPointerStartedAt = 0;
    let ignoreNextClick = false;
    let lastTouchOpen = 0;
    let touchStart = null;
    let touchMoved = false;
    function openFrom(trigger) {
      const card = opener.closest(".capability-card");
      card?.classList.add("is-opening");
      window.setTimeout(() => card?.classList.remove("is-opening"), 420);
      openCapability(opener.dataset.capabilityOpen, trigger);
    }
    function suppressFollowupClick() {
      ignoreNextClick = true;
      window.setTimeout(() => {
        ignoreNextClick = false;
      }, 650);
    }
    function openTouch(trigger) {
      const now = performance.now();
      if (now - lastTouchOpen < 500) return;
      lastTouchOpen = now;
      suppressFollowupClick();
      openFrom(trigger);
    }
    opener.addEventListener("click", (event) => {
      event.stopPropagation();
      if (ignoreNextClick) {
        event.preventDefault();
        return;
      }
      openFrom(opener);
    });
    opener.addEventListener(
      "pointerup",
      (event) => {
        if (event.pointerType !== "touch" || movedInsideCard || !cardPointerActive) return;
        event.preventDefault();
        event.stopPropagation();
        cardPointerActive = false;
        openTouch(opener);
      },
      { passive: false },
    );
    opener.addEventListener(
      "touchend",
      (event) => {
        if (!touchStart || touchMoved) return;
        event.preventDefault();
        event.stopPropagation();
        touchStart = null;
        openTouch(opener);
      },
      { passive: false },
    );
    card?.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType === "touch" && event.isPrimary === false) return;
        movedInsideCard = false;
        cardPointerActive = true;
        cardPointerStart = { x: event.clientX, y: event.clientY };
        cardPointerStartedAt = performance.now();
      },
      { passive: true },
    );
    card?.addEventListener(
      "touchstart",
      (event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        touchStart = { x: touch.clientX, y: touch.clientY };
        touchMoved = false;
      },
      { passive: true },
    );
    card?.addEventListener(
      "touchmove",
      (event) => {
        if (!touchStart) return;
        const touch = event.changedTouches[0];
        if (!touch) return;
        if (
          Math.abs(touch.clientX - touchStart.x) > 10 ||
          Math.abs(touch.clientY - touchStart.y) > 10
        ) {
          touchMoved = true;
        }
      },
      { passive: true },
    );
    card?.addEventListener(
      "pointermove",
      (event) => {
        if (!cardPointerActive) return;
        if (
          Math.abs(event.clientX - cardPointerStart.x) > 10 ||
          Math.abs(event.clientY - cardPointerStart.y) > 10
        ) {
          movedInsideCard = true;
        }
      },
      { passive: true },
    );
    card?.addEventListener(
      "pointerup",
      (event) => {
        const wasActive = cardPointerActive;
        const tapDuration = performance.now() - cardPointerStartedAt;
        cardPointerActive = false;
        if (
          event.pointerType === "touch" &&
          wasActive &&
          !movedInsideCard &&
          tapDuration < 560 &&
          !event.target.closest("[data-capability-open]")
        ) {
          return;
        }
      },
      { passive: false },
    );
    card?.addEventListener(
      "touchend",
      (event) => {
        if (!touchStart || touchMoved || event.target.closest("[data-capability-open]")) {
          touchStart = null;
          return;
        }
        touchStart = null;
      },
      { passive: false },
    );
    card?.addEventListener("touchcancel", () => {
      touchStart = null;
      touchMoved = false;
    });
    ["pointercancel", "pointerleave"].forEach((eventName) => {
      card?.addEventListener(
        eventName,
        () => {
          cardPointerActive = false;
        },
        { passive: true },
      );
    });
    card?.addEventListener("click", (event) => {
      if (isTouch) return;
      if (event.target.closest(".card-hit-area") || movedInsideCard) return;
      openFrom(card);
    });
  });
  document.querySelectorAll("[data-dialog-close]").forEach((button) => {
    button.addEventListener("click", closeCapability);
  });
  capabilityDialog?.addEventListener("click", (event) => {
    if (event.target === capabilityDialog) closeCapability();
  });
  capabilityDialog?.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    if (capabilityDialogModel?._stepTimer) {
      clearInterval(capabilityDialogModel._stepTimer);
      capabilityDialogModel._stepTimer = null;
    }
    if (cursorLens && cursorLens.parentElement !== document.body) {
      document.body.appendChild(cursorLens);
    }
    lastCapabilityTrigger?.focus({ preventScroll: true });
  });
  capabilityDialogStage?.addEventListener("pointermove", (event) => {
    if (isTouch || isMagicOff()) return;
    const rect = capabilityDialogStage.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    capabilityDialogStage.style.setProperty("--stage-rx", `${((0.5 - y) * 7).toFixed(2)}deg`);
    capabilityDialogStage.style.setProperty("--stage-ry", `${((x - 0.5) * 9).toFixed(2)}deg`);
  });
  capabilityDialogStage?.addEventListener("pointerleave", () => {
    capabilityDialogStage.style.setProperty("--stage-rx", "0deg");
    capabilityDialogStage.style.setProperty("--stage-ry", "0deg");
  });
  document.querySelector("[data-scene-replay]")?.addEventListener("click", () => {
    renderDialogModel(activeCapabilityKey);
  });
  const tiltSurfaces = [...document.querySelectorAll("[data-tilt]")];
  function updateTilt(surface, clientX, clientY, strength = 1) {
    const rect = surface.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const rotateX = (0.5 - y) * 9 * strength;
    const rotateY = (x - 0.5) * 12 * strength;
    surface.style.setProperty("--tilt-x", `${rotateX.toFixed(2)}deg`);
    surface.style.setProperty("--tilt-y", `${rotateY.toFixed(2)}deg`);
    surface.style.setProperty("--glow-x", `${(x * 100).toFixed(1)}%`);
    surface.style.setProperty("--glow-y", `${(y * 100).toFixed(1)}%`);
    surface.style.setProperty("--model-pan-x", `${((x - 0.5) * 14).toFixed(2)}px`);
    surface.style.setProperty("--model-pan-y", `${((y - 0.5) * 10).toFixed(2)}px`);
    surface.style.setProperty("--model-rx", `${(rotateX * 0.62).toFixed(2)}deg`);
    surface.style.setProperty("--model-ry", `${(rotateY * 0.72).toFixed(2)}deg`);
    surface.style.setProperty("--model-light-x", `${(x * 100).toFixed(1)}%`);
    surface.style.setProperty("--model-light-y", `${(y * 100).toFixed(1)}%`);
    surface.style.setProperty("--content-pan-x", `${((x - 0.5) * 5).toFixed(2)}px`);
    surface.style.setProperty("--content-pan-y", `${((y - 0.5) * 4).toFixed(2)}px`);
    surface.style.setProperty("--content-counter-x", `${((0.5 - x) * 2.75).toFixed(2)}px`);
    surface.style.setProperty("--content-counter-y", `${((0.5 - y) * 2.2).toFixed(2)}px`);
  }
  function resetTilt(surface) {
    surface.style.setProperty("--tilt-x", "0deg");
    surface.style.setProperty("--tilt-y", "0deg");
    surface.style.setProperty("--glow-x", "50%");
    surface.style.setProperty("--glow-y", "50%");
    surface.style.setProperty("--model-pan-x", "0px");
    surface.style.setProperty("--model-pan-y", "0px");
    surface.style.setProperty("--model-rx", "0deg");
    surface.style.setProperty("--model-ry", "0deg");
    surface.style.setProperty("--model-light-x", "50%");
    surface.style.setProperty("--model-light-y", "50%");
    surface.style.setProperty("--content-pan-x", "0px");
    surface.style.setProperty("--content-pan-y", "0px");
    surface.style.setProperty("--content-counter-x", "0px");
    surface.style.setProperty("--content-counter-y", "0px");
    surface.classList.remove("is-touch-active", "is-pressed", "is-engaged");
  }
  const capabilityCards = [...document.querySelectorAll(".capability-card")];
  if (isTouch) {
    capabilityCards.forEach((card) => {
      card.classList.remove("is-model-active", "is-inview", "is-pressed", "is-engaged");
    });
    document.addEventListener("lesnar:magic-change", () => {
      capabilityCards.forEach((card) => {
        card.classList.remove("is-model-active", "is-inview", "is-pressed", "is-engaged");
      });
    });
  } else if ("IntersectionObserver" in window) {
    const modelVisibility = new Map(capabilityCards.map((card) => [card, 0]));
    const desktopModelThreshold = 0.16;
    function refreshModelActivity() {
      capabilityCards.forEach((card) => {
        card.classList.toggle(
          "is-model-active",
          (modelVisibility.get(card) || 0) > desktopModelThreshold,
        );
      });
    }
    const modelObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          modelVisibility.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
        });
        refreshModelActivity();
      },
      { threshold: [0, 0.16, 0.45, 0.72] },
    );
    capabilityCards.forEach((card) => modelObserver.observe(card));
  } else {
    capabilityCards.forEach((card, index) => {
      if (isTouch && index > 0) return;
      card.classList.add("is-model-active");
    });
  }
  if (!reduceMotion && !isTouch) {
    tiltSurfaces.forEach((surface) => {
      surface.addEventListener("pointermove", (event) => {
        if (surface.classList.contains("capability-card")) {
          const rect = surface.getBoundingClientRect();
          const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
          const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
          surface.style.setProperty("--glow-x", `${(x * 100).toFixed(1)}%`);
          surface.style.setProperty("--glow-y", `${(y * 100).toFixed(1)}%`);
          surface.style.setProperty("--model-light-x", `${(x * 100).toFixed(1)}%`);
          surface.style.setProperty("--model-light-y", `${(y * 100).toFixed(1)}%`);
          return;
        }
        updateTilt(surface, event.clientX, event.clientY, 0.72);
      });
      surface.addEventListener("pointerdown", () => surface.classList.add("is-engaged"));
      surface.addEventListener("pointerup", () => surface.classList.remove("is-engaged"));
      surface.addEventListener("pointerleave", () => resetTilt(surface));
      surface.addEventListener("pointercancel", () => resetTilt(surface));
    });
  }
  if (isTouch) {
    tiltSurfaces.forEach((surface) => {
      surface.addEventListener(
        "pointerdown",
        () => {
          if (surface.classList.contains("capability-card")) return;
          surface.classList.add("is-pressed");
        },
        { passive: true },
      );
      ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
        surface.addEventListener(
          eventName,
          () => {
            surface.classList.remove("is-pressed");
          },
          { passive: true },
        );
      });
    });
  }
  if (!isTouch && !reduceMotion) {
    const cursor = cursorLens;
    const cursorPath = cursor?.querySelector(".cursor-drop-path");
    const cursorHead = cursor?.querySelector(".cursor-drop-head");
    const cursorHighlight = cursor?.querySelector(".cursor-drop-highlight");
    const cursorLabel = cursor?.querySelector(".cursor-label");
    if (cursor && cursorPath && cursorHead && cursorHighlight) {
      document.body.classList.add("custom-cursor");
      let pointerX = window.innerWidth / 2;
      let pointerY = window.innerHeight / 2;
      let lastPointerX = pointerX;
      let lastPointerY = pointerY;
      let pointerSpeed = 0;
      let velocityX = 1;
      let velocityY = 0;
      let isPressed = false;
      let moveTimeout = null;
      let pointerInitialized = false;
      const trail = Array.from({ length: 11 }, () => ({ x: pointerX, y: pointerY }));
      function setCursorMoving() {
        document.body.classList.add("cursor-moving");
        clearTimeout(moveTimeout);
        moveTimeout = window.setTimeout(() => {
          document.body.classList.remove("cursor-moving");
        }, 120);
      }
      window.addEventListener(
        "pointermove",
        (event) => {
          if (!pointerInitialized) {
            pointerX = event.clientX;
            pointerY = event.clientY;
            lastPointerX = event.clientX;
            lastPointerY = event.clientY;
            trail.forEach((point) => {
              point.x = event.clientX;
              point.y = event.clientY;
            });
            pointerInitialized = true;
          }
          const dx = event.clientX - lastPointerX;
          const dy = event.clientY - lastPointerY;
          const movement = Math.hypot(dx, dy);
          if (movement > 0.35) {
            pointerSpeed = Math.min(1, movement / 26);
            velocityX += (dx / movement - velocityX) * 0.45;
            velocityY += (dy / movement - velocityY) * 0.45;
            setCursorMoving();
          }
          lastPointerX = event.clientX;
          lastPointerY = event.clientY;
          pointerX = event.clientX;
          pointerY = event.clientY;
          document.body.classList.add("cursor-ready");
        },
        { passive: true },
      );
      window.addEventListener("pointerdown", () => {
        isPressed = true;
        document.body.classList.add("cursor-pressed");
      });
      window.addEventListener("pointerup", () => {
        isPressed = false;
        document.body.classList.remove("cursor-pressed");
      });
      document.querySelectorAll("a, button, [data-cursor='expand']").forEach((element) => {
        element.addEventListener("pointerenter", () => {
          const label = element.dataset.cursorLabel || "";
          cursor.style.color = "#d9d0bd";
          document.body.classList.add("cursor-expanded");
          document.body.classList.toggle("cursor-labeled", Boolean(label));
          if (cursorLabel) cursorLabel.textContent = label;
        });
        element.addEventListener("pointerleave", () => {
          document.body.classList.remove("cursor-expanded", "cursor-labeled");
          cursor.style.color = "#d7d4cc";
          if (cursorLabel) cursorLabel.textContent = "";
        });
      });
      document.querySelectorAll("[data-magnetic]:not([data-tilt])").forEach((element) => {
        element.classList.add("magnetic-target");
        element.addEventListener("pointermove", (event) => {
          const rect = element.getBoundingClientRect();
          const x = event.clientX - (rect.left + rect.width / 2);
          const y = event.clientY - (rect.top + rect.height / 2);
          element.style.translate = `${(x * 0.12).toFixed(1)}px ${(y * 0.16).toFixed(1)}px`;
        });
        element.addEventListener("pointerleave", () => {
          element.style.translate = "0 0";
        });
      });
      function renderCursor() {
        trail[0].x += (pointerX - trail[0].x) * 0.8;
        trail[0].y += (pointerY - trail[0].y) * 0.8;
        for (let index = 1; index < trail.length; index++) {
          const follow = 0.24 - index * 0.008;
          const previous = trail[index - 1];
          const point = trail[index];
          point.x += (previous.x - point.x) * follow;
          point.y += (previous.y - point.y) * follow;
          const dx = point.x - previous.x;
          const dy = point.y - previous.y;
          const distance = Math.hypot(dx, dy);
          const maxGap = 4.9 - index * 0.13;
          if (distance > maxGap) {
            point.x = previous.x + (dx / distance) * maxGap;
            point.y = previous.y + (dy / distance) * maxGap;
          }
        }
        const speed = Math.max(0.06, pointerSpeed);
        const directionLength = Math.hypot(velocityX, velocityY) || 1;
        const dirX = velocityX / directionLength;
        const dirY = velocityY / directionLength;
        const normalX = -dirY;
        const normalY = dirX;
        const head = trail[0];
        const shoulder = trail[2];
        const belly = trail[4];
        const tail = trail[8];
        const expanded = document.body.classList.contains("cursor-expanded");
        const pressedScale = isPressed ? 0.78 : 1;
        const headRadius = (expanded ? 5.4 : 4.2) * pressedScale;
        const bellyWidth = (expanded ? 6.8 : 4.8) * (0.78 + speed * 0.28) * pressedScale;
        const tailWidth = (expanded ? 1.8 : 1.05) * pressedScale;
        const frontTop = {
          x: head.x + dirX * headRadius * 0.18 + normalX * headRadius * 0.68,
          y: head.y + dirY * headRadius * 0.18 + normalY * headRadius * 0.68,
        };
        const frontBottom = {
          x: head.x + dirX * headRadius * 0.18 - normalX * headRadius * 0.68,
          y: head.y + dirY * headRadius * 0.18 - normalY * headRadius * 0.68,
        };
        const frontCapBottom = {
          x: head.x + dirX * headRadius * 0.76 - normalX * headRadius * 0.62,
          y: head.y + dirY * headRadius * 0.76 - normalY * headRadius * 0.62,
        };
        const frontCapTop = {
          x: head.x + dirX * headRadius * 0.76 + normalX * headRadius * 0.62,
          y: head.y + dirY * headRadius * 0.76 + normalY * headRadius * 0.62,
        };
        const leftShoulder = {
          x: shoulder.x + normalX * bellyWidth,
          y: shoulder.y + normalY * bellyWidth,
        };
        const leftBelly = {
          x: belly.x + normalX * bellyWidth * 0.66,
          y: belly.y + normalY * bellyWidth * 0.66,
        };
        const leftTail = {
          x: tail.x + normalX * tailWidth,
          y: tail.y + normalY * tailWidth,
        };
        const back = {
          x: tail.x - dirX * (4.5 + speed * 7),
          y: tail.y - dirY * (4.5 + speed * 7),
        };
        const rightTail = {
          x: tail.x - normalX * tailWidth,
          y: tail.y - normalY * tailWidth,
        };
        const rightBelly = {
          x: belly.x - normalX * bellyWidth * 0.66,
          y: belly.y - normalY * bellyWidth * 0.66,
        };
        const rightShoulder = {
          x: shoulder.x - normalX * bellyWidth,
          y: shoulder.y - normalY * bellyWidth,
        };
        const outline = [
          `M ${frontTop.x.toFixed(2)} ${frontTop.y.toFixed(2)}`,
          `C ${(head.x + normalX * headRadius).toFixed(2)} ${(head.y + normalY * headRadius).toFixed(2)}, ${leftShoulder.x.toFixed(2)} ${leftShoulder.y.toFixed(2)}, ${leftBelly.x.toFixed(2)} ${leftBelly.y.toFixed(2)}`,
          `C ${leftTail.x.toFixed(2)} ${leftTail.y.toFixed(2)}, ${(back.x + normalX * 0.72).toFixed(2)} ${(back.y + normalY * 0.72).toFixed(2)}, ${back.x.toFixed(2)} ${back.y.toFixed(2)}`,
          `C ${(back.x - normalX * 0.72).toFixed(2)} ${(back.y - normalY * 0.72).toFixed(2)}, ${rightTail.x.toFixed(2)} ${rightTail.y.toFixed(2)}, ${rightBelly.x.toFixed(2)} ${rightBelly.y.toFixed(2)}`,
          `C ${rightShoulder.x.toFixed(2)} ${rightShoulder.y.toFixed(2)}, ${(head.x - normalX * headRadius).toFixed(2)} ${(head.y - normalY * headRadius).toFixed(2)}, ${frontBottom.x.toFixed(2)} ${frontBottom.y.toFixed(2)}`,
          `C ${frontCapBottom.x.toFixed(2)} ${frontCapBottom.y.toFixed(2)}, ${frontCapTop.x.toFixed(2)} ${frontCapTop.y.toFixed(2)}, ${frontTop.x.toFixed(2)} ${frontTop.y.toFixed(2)}`,
          "Z",
        ].join(" ");
        cursorPath.setAttribute("d", outline);
        cursorHead.setAttribute("cx", head.x.toFixed(2));
        cursorHead.setAttribute("cy", head.y.toFixed(2));
        cursorHead.setAttribute("r", (headRadius * 0.3).toFixed(2));
        cursorHighlight.setAttribute("cx", (head.x - normalX * 1.2 - dirX * 1.4).toFixed(2));
        cursorHighlight.setAttribute("cy", (head.y - normalY * 1.2 - dirY * 1.4).toFixed(2));
        cursor.style.setProperty("--cursor-label-x", `${head.x + 18}px`);
        cursor.style.setProperty("--cursor-label-y", `${head.y + 18}px`);
        pointerSpeed *= 0.86;
        requestAnimationFrame(renderCursor);
      }
      renderCursor();
    }
  }
  function markWebglUnavailable() {
    document.body.classList.add("webgl-unavailable");
    document.getElementById("webgl-container")?.setAttribute("hidden", "");
  }
  initializeWebgl = () => {
  if (webglInitialized || reduceMotion) return;
  if (typeof THREE === "undefined") {
    markWebglUnavailable();
    return;
  }
  document.body.classList.remove("webgl-unavailable");
  document.getElementById("webgl-container")?.removeAttribute("hidden");
  const canvas = document.getElementById("webgl-canvas");
  const hero = document.querySelector(".hero");
  if (!canvas || !hero) return;
  const rendererOptions = {
    alpha: true,
    antialias: !isTouch && !isLaptopProfile,
    powerPreference: "high-performance",
  };
  let context;
  try {
    context =
      canvas.getContext("webgl2", rendererOptions) ||
      canvas.getContext("webgl", rendererOptions);
  } catch {
    context = null;
  }
  if (!context) {
    markWebglUnavailable();
    return;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      ...rendererOptions,
    });
  } catch {
    markWebglUnavailable();
    return;
  }
  webglInitialized = true;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.018);
  const camera = new THREE.PerspectiveCamera(
    38,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.set(0, 2.6, 9);
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const touchWide = isTouch && window.innerWidth >= 700;
  const lightweightGraphics = isTouch || isLaptopProfile;
  const maxPixelRatio = isTouch ? (touchWide ? 0.82 : 0.68) : (isLaptopProfile ? 1 : 1.5);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  scene.add(new THREE.HemisphereLight(0xe7e5de, 0x090808, 0.92));
  const cyanLight = new THREE.PointLight(0x7ea9ad, 1.7, 16);
  cyanLight.position.set(4, 3, 5);
  scene.add(cyanLight);
  const violetLight = new THREE.PointLight(0x9185a2, 1.45, 15);
  violetLight.position.set(-3, -2, 4);
  scene.add(violetLight);
  const amberLight = new THREE.PointLight(0xb99a64, 1.05, 12);
  amberLight.position.set(0, 4, 1);
  scene.add(amberLight);
  const waveColumns = isTouch ? (touchWide ? 60 : 48) : (isLaptopProfile ? 112 : 176);
  const waveRows = isTouch ? (touchWide ? 36 : 30) : (isLaptopProfile ? 68 : 108);
  const wavePositions = new Float32Array(waveColumns * waveRows * 3);
  const wavePhases = new Float32Array(waveColumns * waveRows);
  let waveIndex = 0;
  for (let row = 0; row < waveRows; row++) {
    for (let column = 0; column < waveColumns; column++) {
      const x = column / (waveColumns - 1);
      const y = row / (waveRows - 1);
      wavePositions[waveIndex * 3] = (x - 0.5) * 23;
      wavePositions[waveIndex * 3 + 1] = 0;
      wavePositions[waveIndex * 3 + 2] = (y - 0.5) * 17 - 1.4;
      wavePhases[waveIndex] = ((column * 17 + row * 29) % 101) / 101;
      waveIndex++;
    }
  }
  const waveGeometry = new THREE.BufferGeometry();
  waveGeometry.setAttribute("position", new THREE.BufferAttribute(wavePositions, 3));
  waveGeometry.setAttribute("aPhase", new THREE.BufferAttribute(wavePhases, 1));
  const waveUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, maxPixelRatio) },
    uPointer: { value: new THREE.Vector2(0.48, 0.08) },
    uPreviousPointer: { value: new THREE.Vector2(0.18, -0.04) },
    uPointerEnergy: { value: isTouch ? 0.18 : 0.28 },
  };
  const waveMaterial = new THREE.ShaderMaterial({
    uniforms: waveUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uPointerEnergy;
      uniform vec2 uPointer;
      uniform vec2 uPreviousPointer;
      attribute float aPhase;
      varying float vAlpha;
      varying float vEnergy;
      varying float vTint;
      float distanceToSegment(vec2 point, vec2 start, vec2 end) {
        vec2 segment = end - start;
        float lengthSquared = max(dot(segment, segment), 0.0001);
        float progress = clamp(dot(point - start, segment) / lengthSquared, 0.0, 1.0);
        return distance(point, start + segment * progress);
      }
      void main() {
        vec3 point = position;
        float broad = sin(point.x * 0.22 + uTime * 0.11) * 0.26;
        float longWave = cos(point.z * 0.24 - uTime * 0.08) * 0.22;
        float cross = sin(point.x * 0.09 + point.z * 0.12 + uTime * 0.06) * 0.15;
        vec2 fieldUv = vec2(point.x / 13.0, (point.z + 1.4) / 10.0);
        float pointerDistance = distance(fieldUv, uPointer);
        float trailDistance = distanceToSegment(fieldUv, uPreviousPointer, uPointer);
        float pointerWake = smoothstep(${isTouch ? "0.54" : "0.68"}, 0.0, pointerDistance) * uPointerEnergy;
        float dragWake = smoothstep(${isTouch ? "0.28" : "0.34"}, 0.0, trailDistance) * uPointerEnergy;
        float pointerRipple = sin(pointerDistance * 17.0 - uTime * ${isTouch ? "1.75" : "2.45"}) * pointerWake;
        float wakeRipple = cos(trailDistance * 15.0 - uTime * ${isTouch ? "1.35" : "1.85"}) * dragWake;
        float ambient = broad + longWave + cross;
        float surface = ambient * ${isTouch ? "0.72" : "0.62"} + pointerRipple * ${isTouch ? "0.58" : "0.9"} + wakeRipple * ${isTouch ? "0.32" : "0.48"} + pointerWake * ${isTouch ? "0.22" : "0.34"};
        point.y += surface;
        point.x += (fieldUv.x - uPointer.x) * pointerWake * ${isTouch ? "0.1" : "0.18"};
        point.z += pointerRipple * ${isTouch ? "0.1" : "0.2"} + wakeRipple * ${isTouch ? "0.06" : "0.1"};
        vec4 modelPosition = modelViewMatrix * vec4(point, 1.0);
        gl_Position = projectionMatrix * modelPosition;
        gl_PointSize = max(${isTouch ? "1.8" : "1.7"}, (${isTouch ? "29.0" : "25.0"} + abs(surface) * ${isTouch ? "3.4" : "4.2"} + pointerWake * ${isTouch ? "5.1" : "8.2"} + dragWake * ${isTouch ? "2.2" : "4.2"}) * uPixelRatio / -modelPosition.z);
        vEnergy = clamp(abs(surface) * ${isTouch ? "0.34" : "0.42"} + pointerWake * ${isTouch ? "0.42" : "0.56"} + dragWake * ${isTouch ? "0.24" : "0.34"}, 0.0, 1.0);
        vAlpha = ${isTouch ? "0.46" : "0.28"} + vEnergy * ${isTouch ? "0.48" : "0.58"};
        vTint = clamp(0.5 + sin(point.x * 0.17 + point.z * 0.11) * 0.5, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vEnergy;
      varying float vTint;
      void main() {
        float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
        float dot = 1.0 - smoothstep(0.08, ${isTouch ? "0.62" : "0.56"}, distanceToCenter);
        vec3 cyan = vec3(0.08, 0.72, 0.79);
        vec3 violet = vec3(0.48, 0.4, 0.66);
        vec3 amber = vec3(0.72, 0.48, 0.24);
        vec3 quiet = mix(vec3(${isTouch ? "0.5, 0.75, 0.76" : "0.42, 0.58, 0.6"}), violet, vTint * 0.26);
        vec3 brightTone = mix(cyan, amber, smoothstep(0.7, 1.0, vTint) * 0.38);
        gl_FragColor = vec4(mix(quiet, brightTone, vEnergy), dot * vAlpha);
      }
    `,
  });
  const waveField = new THREE.Points(waveGeometry, waveMaterial);
  scene.add(waveField);
  const waveLines = new THREE.Group();
  waveLines.visible = false;
  scene.add(waveLines);
  const sculpture = new THREE.Group();
  const orbitGroup = new THREE.Group();
  const satelliteGroup = new THREE.Group();
  const connectionGroup = new THREE.Group();
  sculpture.add(orbitGroup, satelliteGroup, connectionGroup);
  scene.add(sculpture);
  const coreMaterial = lightweightGraphics
    ? new THREE.MeshBasicMaterial({
        color: 0x142528,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0x142022,
        emissive: 0x0b1718,
        emissiveIntensity: 0.42,
        metalness: 0.12,
        roughness: 0.28,
        clearcoat: 1,
        clearcoatRoughness: 0.2,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      });
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(
      1.08,
      isTouch ? 20 : (isLaptopProfile ? 36 : 56),
      isTouch ? 14 : (isLaptopProfile ? 24 : 42),
    ),
    coreMaterial,
  );
  sculpture.add(core);
  const wire = new THREE.Group();
  const wovenStrands = [];
  const wovenMaterial = new THREE.LineBasicMaterial({
    color: 0xbfd3d1,
    transparent: true,
    opacity: isTouch ? 0.2 : 0.24,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const wovenSecondaryMaterial = new THREE.LineBasicMaterial({
    color: 0x9185a2,
    transparent: true,
    opacity: isTouch ? 0.12 : 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const wovenRadius = 1.42;
  const wovenSegments = isTouch ? 32 : (isLaptopProfile ? 72 : 112);
  const latitudeLimit = isTouch ? 4 : (isLaptopProfile ? 5 : 7);
  for (let latitudeIndex = -latitudeLimit; latitudeIndex <= latitudeLimit; latitudeIndex++) {
    const latitude = (latitudeIndex / 8) * (Math.PI / 2);
    const radius = Math.cos(latitude) * wovenRadius;
    const y = Math.sin(latitude) * wovenRadius;
    const points = [];
    for (let segment = 0; segment <= wovenSegments; segment++) {
      const angle = (segment / wovenSegments) * Math.PI * 2;
      const breathe = 1 + Math.sin(angle * 3 + latitudeIndex * 0.6) * 0.015;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius * breathe,
          y + Math.sin(angle * 2 + latitudeIndex) * 0.012,
          Math.sin(angle) * radius * breathe,
        ),
      );
    }
    const strand = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      latitudeIndex % 3 === 0 ? wovenSecondaryMaterial : wovenMaterial,
    );
    strand.userData.phase = latitudeIndex * 0.37;
    wovenStrands.push(strand);
    wire.add(strand);
  }
  const meridianCount = isTouch ? 8 : (isLaptopProfile ? 12 : 18);
  for (let meridianIndex = 0; meridianIndex < meridianCount; meridianIndex++) {
    const points = [];
    const rotation = (meridianIndex / meridianCount) * Math.PI;
    for (let segment = 0; segment <= wovenSegments; segment++) {
      const angle = (segment / wovenSegments) * Math.PI * 2;
      const localX = Math.cos(angle) * wovenRadius;
      const y = Math.sin(angle) * wovenRadius;
      const localZ = Math.sin(angle * 2 + meridianIndex * 0.45) * 0.018;
      points.push(
        new THREE.Vector3(
          localX * Math.cos(rotation) + localZ * Math.sin(rotation),
          y,
          -localX * Math.sin(rotation) + localZ * Math.cos(rotation),
        ),
      );
    }
    const strand = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      meridianIndex % 4 === 0 ? wovenSecondaryMaterial : wovenMaterial,
    );
    strand.userData.phase = meridianIndex * 0.23;
    wovenStrands.push(strand);
    wire.add(strand);
  }
  sculpture.add(wire);
  const ribbon = new THREE.Group();
  const ribbonMaterial = new THREE.LineBasicMaterial({
    color: 0x7ea9ad,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  [1.72, 1.9, 2.1].forEach((radius, index) => {
    const points = [];
    const count = isTouch ? 36 : (isLaptopProfile ? 80 : 132);
    for (let segment = 0; segment <= count; segment++) {
      const angle = (segment / count) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius * (0.34 + index * 0.035),
          Math.sin(angle * 2 + index) * 0.12,
        ),
      );
    }
    const strand = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      ribbonMaterial,
    );
    strand.rotation.set(index * 0.5 - 0.35, index * 0.38, index * 0.7);
    ribbon.add(strand);
  });
  ribbon.rotation.set(0.35, 0.15, -0.4);
  sculpture.add(ribbon);
  const glassMaterial = lightweightGraphics
    ? new THREE.MeshBasicMaterial({
        color: 0x91aaa9,
        transparent: true,
        opacity: 0.045,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0xb4c4c2,
        metalness: 0.05,
        roughness: 0.08,
        transparent: true,
        opacity: 0.035,
        side: THREE.DoubleSide,
        clearcoat: 1,
      });
  const glassShell = new THREE.Mesh(
    new THREE.SphereGeometry(
      1.58,
      isTouch ? 14 : (isLaptopProfile ? 20 : 30),
      isTouch ? 10 : (isLaptopProfile ? 14 : 22),
    ),
    glassMaterial,
  );
  sculpture.add(glassShell);
  const globeGrid = new THREE.Group();
  sculpture.add(globeGrid);
  const motherNodeGroup = new THREE.Group();
  connectionGroup.add(motherNodeGroup);
  const sourceNode = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.24,
      isTouch ? 12 : (isLaptopProfile ? 18 : 26),
      isTouch ? 8 : (isLaptopProfile ? 12 : 18),
    ),
    lightweightGraphics
      ? new THREE.MeshBasicMaterial({ color: 0xf0d29b, depthTest: false })
      : new THREE.MeshStandardMaterial({
          color: 0xf0d29b,
          emissive: 0xb99a64,
          emissiveIntensity: 1.65,
          metalness: 0.32,
          roughness: 0.2,
          depthTest: false,
        }),
  );
  sourceNode.renderOrder = 4;
  motherNodeGroup.add(sourceNode);
  const sourceHalos = [];
  [
    [0, 0, 0],
    [Math.PI / 2, 0.18, 0],
    [0.56, Math.PI / 2, 0.34],
  ].forEach((rotation, index) => {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(
        0.39 + index * 0.065,
        index === 0 ? 0.018 : 0.011,
        6,
        isTouch ? 28 : (isLaptopProfile ? 44 : 72),
      ),
      new THREE.MeshBasicMaterial({
        color: index === 0 ? 0xf0d29b : 0xb99a64,
        transparent: true,
        opacity: 0.68 - index * 0.13,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.rotation.set(...rotation);
    halo.renderOrder = 4;
    motherNodeGroup.add(halo);
    sourceHalos.push(halo);
  });
  function createMotherNodeSprite() {
    const hubCanvas = document.createElement("canvas");
    hubCanvas.width = 640;
    hubCanvas.height = 256;
    const context = hubCanvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, hubCanvas.width, hubCanvas.height);
      context.fillStyle = "rgba(4, 7, 7, 0.9)";
      context.beginPath();
      context.roundRect(18, 26, 604, 204, 38);
      context.fill();
      context.strokeStyle = "rgba(240, 210, 155, 0.62)";
      context.lineWidth = 3;
      context.stroke();
      context.fillStyle = "#f0d29b";
      context.fillRect(44, 54, 7, 114);
      context.fillStyle = "#f1f0eb";
      context.font = "700 48px sans-serif";
      context.letterSpacing = "5px";
      context.fillText("LESNAR AI LTD", 76, 116);
      context.fillStyle = "rgba(240, 210, 155, 0.82)";
      context.font = "600 23px monospace";
      context.letterSpacing = "4px";
      context.fillText("MOTHER NODE  ·  NAIROBI", 78, 164);
      context.fillStyle = "rgba(191, 211, 209, 0.58)";
      context.font = "500 17px monospace";
      context.letterSpacing = "2px";
      context.fillText("WORLD CONNECTION CORE", 78, 197);
    }
    const texture = new THREE.CanvasTexture(hubCanvas);
    texture.encoding = THREE.sRGBEncoding;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.94,
        depthTest: false,
        depthWrite: false,
      }),
    );
    sprite.position.set(0, -0.08, 0.12);
    sprite.scale.set(isTouch ? 1.42 : 1.34, isTouch ? 0.568 : 0.535, 1);
    sprite.renderOrder = 8;
    return sprite;
  }
  const motherNodeLabel = createMotherNodeSprite();
  motherNodeGroup.add(motherNodeLabel);
  function createTextSprite(label, detail, accent = "#7ea9ad") {
    if (isTouch) {
      return new THREE.Sprite(
        new THREE.SpriteMaterial({
          transparent: true,
          opacity: 0,
          depthTest: false,
          depthWrite: false,
        }),
      );
    }
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 768;
    labelCanvas.height = 192;
    const labelContext = labelCanvas.getContext("2d");
    if (labelContext) {
      labelContext.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
      labelContext.fillStyle = "rgba(3, 7, 8, 0.82)";
      labelContext.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
      labelContext.strokeStyle = "rgba(191, 211, 209, 0.34)";
      labelContext.lineWidth = 2;
      labelContext.strokeRect(3, 3, labelCanvas.width - 6, labelCanvas.height - 6);
      labelContext.fillStyle = accent;
      labelContext.fillRect(24, 28, 8, 84);
      labelContext.fillStyle = "#f1f0eb";
      labelContext.font = "700 42px sans-serif";
      labelContext.letterSpacing = "3px";
      labelContext.fillText(label.toUpperCase(), 52, 77);
      labelContext.fillStyle = "rgba(191, 211, 209, 0.78)";
      labelContext.font = "500 24px monospace";
      labelContext.fillText(detail.toUpperCase(), 52, 126);
    }
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.encoding = THREE.sRGBEncoding;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: labelTexture,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        depthWrite: false,
      }),
    );
    sprite.scale.set(1.62, 0.405, 1);
    sprite.renderOrder = 6;
    return sprite;
  }
  function createIconSprite(type, accent = "#7ea9ad") {
    const iconCanvas = document.createElement("canvas");
    iconCanvas.width = 256;
    iconCanvas.height = 256;
    const context = iconCanvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, 256, 256);
      context.fillStyle = "rgba(3, 7, 8, 0.9)";
      context.strokeStyle = "rgba(235, 241, 237, 0.42)";
      context.lineWidth = 5;
      context.beginPath();
      context.roundRect(22, 22, 212, 212, 54);
      context.fill();
      context.stroke();
      context.strokeStyle = accent;
      context.fillStyle = accent;
      context.lineWidth = 11;
      context.lineCap = "round";
      context.lineJoin = "round";
      if (type === "platform") {
        context.strokeRect(61, 68, 134, 112);
        context.beginPath();
        context.moveTo(61, 94);
        context.lineTo(195, 94);
        context.stroke();
        [78, 94, 110].forEach((x) => {
          context.beginPath();
          context.arc(x, 82, 4, 0, Math.PI * 2);
          context.fill();
        });
      } else if (type === "shield") {
        context.beginPath();
        context.moveTo(128, 56);
        context.lineTo(184, 78);
        context.lineTo(176, 145);
        context.quadraticCurveTo(165, 181, 128, 199);
        context.quadraticCurveTo(91, 181, 80, 145);
        context.lineTo(72, 78);
        context.closePath();
        context.stroke();
        context.beginPath();
        context.moveTo(101, 128);
        context.lineTo(121, 148);
        context.lineTo(158, 109);
        context.stroke();
      } else if (type === "cloud") {
        context.beginPath();
        context.moveTo(76, 168);
        context.bezierCurveTo(48, 164, 48, 119, 80, 111);
        context.bezierCurveTo(89, 72, 142, 66, 161, 101);
        context.bezierCurveTo(202, 98, 215, 158, 177, 170);
        context.closePath();
        context.stroke();
      } else if (type === "commerce") {
        context.strokeRect(76, 92, 104, 92);
        context.beginPath();
        context.arc(101, 190, 9, 0, Math.PI * 2);
        context.arc(158, 190, 9, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(62, 69);
        context.lineTo(75, 69);
        context.lineTo(86, 144);
        context.lineTo(174, 144);
        context.stroke();
      } else if (type === "device") {
        context.strokeRect(78, 70, 100, 116);
        context.strokeRect(101, 96, 54, 54);
        [90, 110, 130, 150, 170].forEach((value) => {
          context.beginPath();
          context.moveTo(62, value);
          context.lineTo(78, value);
          context.moveTo(178, value);
          context.lineTo(194, value);
          context.stroke();
        });
      } else if (type === "data") {
        [76, 112, 148].forEach((y, index) => {
          context.beginPath();
          context.ellipse(128, y, 54, 16, 0, 0, Math.PI * 2);
          context.stroke();
          if (index < 2) {
            context.beginPath();
            context.moveTo(74, y);
            context.lineTo(74, y + 36);
            context.moveTo(182, y);
            context.lineTo(182, y + 36);
            context.stroke();
          }
        });
        context.beginPath();
        context.moveTo(128, 164);
        context.lineTo(128, 194);
        context.moveTo(92, 194);
        context.lineTo(164, 194);
        context.stroke();
      } else if (type === "workflow") {
        [[78, 84], [178, 84], [128, 168]].forEach(([x, y]) => {
          context.beginPath();
          context.roundRect(x - 26, y - 20, 52, 40, 12);
          context.stroke();
        });
        context.beginPath();
        context.moveTo(104, 84);
        context.lineTo(152, 84);
        context.moveTo(178, 104);
        context.quadraticCurveTo(164, 138, 128, 148);
        context.moveTo(78, 104);
        context.quadraticCurveTo(92, 138, 128, 148);
        context.stroke();
        context.beginPath();
        context.moveTo(114, 168);
        context.lineTo(125, 180);
        context.lineTo(146, 154);
        context.stroke();
      } else if (type === "logistics") {
        context.strokeRect(58, 110, 78, 52);
        context.beginPath();
        context.moveTo(136, 124);
        context.lineTo(172, 124);
        context.lineTo(194, 145);
        context.lineTo(194, 162);
        context.lineTo(136, 162);
        context.closePath();
        context.stroke();
        [82, 170].forEach((x) => {
          context.beginPath();
          context.arc(x, 176, 12, 0, Math.PI * 2);
          context.stroke();
        });
        context.beginPath();
        context.moveTo(70, 86);
        context.quadraticCurveTo(123, 45, 186, 86);
        context.stroke();
      } else if (type === "support") {
        context.beginPath();
        context.roundRect(62, 70, 132, 86, 24);
        context.stroke();
        context.beginPath();
        context.moveTo(98, 156);
        context.lineTo(82, 190);
        context.lineTo(124, 158);
        context.stroke();
        [98, 128, 158].forEach((x) => {
          context.beginPath();
          context.arc(x, 113, 5, 0, Math.PI * 2);
          context.fill();
        });
      } else if (type === "ops") {
        context.beginPath();
        context.arc(94, 86, 21, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.moveTo(62, 164);
        context.quadraticCurveTo(94, 123, 126, 164);
        context.stroke();
        context.strokeRect(136, 72, 48, 92);
        [92, 118, 144].forEach((value) => {
          context.beginPath();
          context.moveTo(148, value);
          context.lineTo(173, value);
          context.stroke();
        });
      } else if (type === "payments") {
        context.strokeRect(82, 58, 92, 142);
        context.beginPath();
        context.moveTo(102, 92);
        context.lineTo(154, 92);
        context.moveTo(102, 119);
        context.lineTo(142, 119);
        context.moveTo(128, 148);
        context.lineTo(112, 172);
        context.lineTo(148, 136);
        context.lineTo(133, 136);
        context.lineTo(146, 112);
        context.stroke();
      } else {
        context.beginPath();
        context.arc(128, 128, 24, 0, Math.PI * 2);
        context.fill();
        [[128, 60], [66, 160], [190, 160]].forEach(([x, y]) => {
          context.beginPath();
          context.moveTo(128, 128);
          context.lineTo(x, y);
          context.stroke();
          context.beginPath();
          context.arc(x, y, 13, 0, Math.PI * 2);
          context.stroke();
        });
      }
    }
    const texture = new THREE.CanvasTexture(iconCanvas);
    texture.encoding = THREE.sRGBEncoding;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.94,
        depthTest: false,
        depthWrite: false,
      }),
    );
    sprite.scale.set(0.56, 0.56, 1);
    sprite.renderOrder = 7;
    return sprite;
  }
  const connectionLabels = [];
  const connectionIcons = [];
  const connections = [];
  const connectionHitTargets = [];
  const customerConnections = [
    {
      destination: new THREE.Vector3(-0.82, 0.42, 0.38),
      label: "Customer Product",
      short: "Product",
      detail: "Apps people can use",
      contribution: "Customer portals, dashboards, and tools connect to Lesnar-built services without feeling fragile.",
      accent: "#69b9c2",
      icon: "platform",
      route: "Products reach customers",
    },
    {
      destination: new THREE.Vector3(-0.28, 0.92, -0.38),
      label: "Trust and Security",
      short: "Trust",
      detail: "Proof before launch",
      contribution: "Threats, audit trails, and payment risks route back into testing before customers ever feel them.",
      accent: "#a08fc0",
      icon: "shield",
      route: "Trust protects launches",
    },
    {
      destination: new THREE.Vector3(0.74, 0.62, -0.3),
      label: "Cloud Regions",
      short: "Cloud",
      detail: "Live operations",
      contribution: "Production systems send health, traffic, and recovery signals through one clear operating route.",
      accent: "#a4bb78",
      icon: "cloud",
      route: "Cloud keeps work alive",
    },
    {
      destination: new THREE.Vector3(-0.86, -0.34, -0.36),
      label: "Payments and Commerce",
      short: "Payments",
      detail: "Payment to fulfilment",
      contribution: "Orders, M-Pesa proof, merchants, and customers stay joined from checkout to delivery.",
      accent: "#c1848d",
      icon: "payments",
      route: "Money becomes fulfilment",
    },
    {
      destination: new THREE.Vector3(0.86, -0.5, 0.22),
      label: "Field Devices",
      short: "Devices",
      detail: "Physical systems",
      contribution: "Robots, cameras, and devices feed real-world status back into the same engineering loop.",
      accent: "#d1aa63",
      icon: "device",
      route: "Devices report reality",
    },
    {
      destination: new THREE.Vector3(0.18, -0.88, 0.44),
      label: "Operations Desk",
      short: "Ops",
      detail: "Human approvals",
      contribution: "People stay in control: reviews, approvals, and customer updates stay visible from Nairobi to the world.",
      accent: "#e2d6be",
      icon: "ops",
      route: "People approve outcomes",
    },
    {
      destination: new THREE.Vector3(-0.42, 0.05, 0.98),
      label: "Data Pipelines",
      short: "Data",
      detail: "Clean operating views",
      contribution: "Events, reports, and decision data move from messy sources into clean operating views.",
      accent: "#8fb8ff",
      icon: "data",
      route: "Data becomes decisions",
    },
    {
      destination: new THREE.Vector3(0.52, 0.08, 0.92),
      label: "Workflow Automation",
      short: "Workflow",
      detail: "Staff handoffs",
      contribution: "Handoffs, reminders, approvals, and staff work stay visible instead of living in guesswork.",
      accent: "#7fd0a5",
      icon: "workflow",
      route: "Workflows stay coordinated",
    },
    {
      destination: new THREE.Vector3(-0.18, -0.18, -1.06),
      label: "Logistics Network",
      short: "Logistics",
      detail: "Dispatch to doorstep",
      contribution: "Orders, routes, delivery proof, and customer updates stay joined from dispatch to doorstep.",
      accent: "#efb36b",
      icon: "logistics",
      route: "Movement stays traceable",
    },
    {
      destination: new THREE.Vector3(0.45, -0.02, -0.98),
      label: "Support Channels",
      short: "Support",
      detail: "Customer context",
      contribution: "WhatsApp, email, portals, and internal teams share one clear customer context.",
      accent: "#eda6cf",
      icon: "support",
      route: "Support stays human",
    },
  ];
  customerConnections.forEach(({ destination, label, short, detail, contribution, accent, icon, route }, index) => {
    const destinationNormal = destination.clone().normalize();
    const orbitRadius = 1.64 + (index % 3) * 0.085;
    const destinationPoint = destinationNormal.clone().multiplyScalar(orbitRadius);
    const connectionColor = new THREE.Color(accent);
    const referenceAxis =
      Math.abs(destinationNormal.y) > 0.82
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0);
    const orbitSide = new THREE.Vector3()
      .crossVectors(destinationNormal, referenceAxis)
      .normalize()
      .applyAxisAngle(destinationNormal, index * 0.41);
    const orbitDepth = new THREE.Vector3()
      .crossVectors(destinationNormal, orbitSide)
      .normalize();
    const loopPointCount = isTouch ? 38 : (isLaptopProfile ? 58 : 86);
    const loopPoints = [];
    for (let segment = 0; segment < loopPointCount; segment++) {
      const angle = (segment / loopPointCount) * Math.PI * 2;
      const loopPoint = destinationNormal
        .clone()
        .multiplyScalar(Math.cos(angle) * orbitRadius)
        .addScaledVector(orbitSide, Math.sin(angle) * orbitRadius);
      loopPoint.addScaledVector(
        orbitDepth,
        Math.sin(angle * 2) * (0.055 + (index % 2) * 0.025),
      );
      loopPoints.push(loopPoint);
    }
    const curve = new THREE.CatmullRomCurve3(loopPoints, true, "centripetal");
    const focusHorizontal = Math.max(Math.hypot(destinationNormal.x, destinationNormal.z), 0.001);
    const focusRotation = {
      x: Math.max(-0.82, Math.min(0.82, Math.atan2(destinationNormal.y, focusHorizontal))),
      y: Math.atan2(-destinationNormal.x, destinationNormal.z),
    };
    const cord = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        isTouch ? 28 : (isLaptopProfile ? 42 : 68),
        isTouch ? 0.0055 : 0.0075,
        isTouch || isLaptopProfile ? 4 : 6,
        true,
      ),
      new THREE.MeshBasicMaterial({
        color: connectionColor,
        transparent: true,
        opacity: isTouch ? 0.24 : 0.28,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    cord.renderOrder = 2;
    connectionGroup.add(cord);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        curve.getPoints(isTouch ? 44 : (isLaptopProfile ? 72 : 112)),
      ),
      new THREE.LineBasicMaterial({
        color: connectionColor,
        transparent: true,
        opacity: isTouch ? 0.8 : 0.88,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    line.renderOrder = 3;
    connectionGroup.add(line);
    const routeLift = (index % 2 === 0 ? 1 : -1) * (0.18 + (index % 4) * 0.035);
    const routeCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 0, 0),
        destinationNormal.clone().multiplyScalar(0.42).addScaledVector(orbitSide, routeLift * 0.7),
        destinationNormal.clone().multiplyScalar(1.05).addScaledVector(orbitDepth, routeLift),
        destinationPoint.clone(),
      ],
      false,
      "centripetal",
    );
    const routeArc = new THREE.Mesh(
      new THREE.TubeGeometry(
        routeCurve,
        isTouch ? 24 : (isLaptopProfile ? 36 : 56),
        isTouch ? 0.004 : 0.006,
        isTouch || isLaptopProfile ? 4 : 6,
        false,
      ),
      new THREE.MeshBasicMaterial({
        color: connectionColor,
        transparent: true,
        opacity: isTouch ? 0.28 : 0.36,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    routeArc.renderOrder = 3;
    connectionGroup.add(routeArc);
    const routeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        routeCurve.getPoints(isTouch ? 30 : (isLaptopProfile ? 48 : 72)),
      ),
      new THREE.LineBasicMaterial({
        color: connectionColor,
        transparent: true,
        opacity: isTouch ? 0.5 : 0.62,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    routeLine.renderOrder = 4;
    connectionGroup.add(routeLine);
    const endpoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, isTouch ? 10 : 18, isTouch ? 8 : 14),
      new THREE.MeshBasicMaterial({
        color: connectionColor,
        transparent: true,
        opacity: 0.92,
        depthTest: false,
      }),
    );
    endpoint.position.copy(destinationPoint);
    endpoint.userData.connectorIndex = index;
    connectionGroup.add(endpoint);
    const endpointHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.006, 6, isTouch ? 24 : 42),
      new THREE.MeshBasicMaterial({
        color: connectionColor,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        depthTest: false,
      }),
    );
    endpointHalo.position.copy(destinationPoint);
    endpointHalo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), destinationNormal);
    endpointHalo.userData.connectorIndex = index;
    connectionGroup.add(endpointHalo);
    const iconSprite = createIconSprite(icon, accent);
    iconSprite.position.copy(destinationPoint);
    iconSprite.userData.connectorIndex = index;
    connectionGroup.add(iconSprite);
    connectionIcons.push(iconSprite);
    const hitSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        transparent: true,
        opacity: 0.001,
        depthTest: false,
        depthWrite: false,
      }),
    );
    hitSprite.position.copy(iconSprite.position);
    hitSprite.scale.setScalar(isTouch ? 0.72 : 0.54);
    hitSprite.userData.connectorIndex = index;
    connectionGroup.add(hitSprite);
    connectionHitTargets.push(hitSprite, iconSprite, endpoint, endpointHalo);
    const labelSprite = createTextSprite(label, detail, accent);
    labelSprite.position
      .copy(destinationNormal)
      .multiplyScalar(orbitRadius + 0.34)
      .add(new THREE.Vector3(index % 2 ? -0.16 : 0.16, index < 2 ? 0.12 : -0.05, 0.16));
    labelSprite.visible = false;
    connectionGroup.add(labelSprite);
    connectionLabels.push(labelSprite);
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, isTouch ? 8 : 10, isTouch ? 6 : 8),
      new THREE.MeshBasicMaterial({
        color: connectionColor,
        transparent: true,
        opacity: 0.92,
        depthTest: false,
      }),
    );
    connectionGroup.add(pulse);
    connections.push({
      curve,
      cord,
      line,
      routeArc,
      routeLine,
      endpoint,
      pulse,
      endpointHalo,
      iconSprite,
      labelSprite,
      destinationNormal,
      label,
      short,
      detail,
      contribution,
      accent,
      route,
      focusRotation,
      direction: index % 2 === 0 ? 1 : -1,
      offset: index / customerConnections.length,
    });
  });
  const signalSpinePoints = [];
  const signalSpineSegments = isTouch ? 48 : 80;
  for (let index = 0; index <= signalSpineSegments; index++) {
    const progress = index / signalSpineSegments;
    signalSpinePoints.push(
      new THREE.Vector3(
        Math.sin(progress * Math.PI * 2) * 0.08,
        (progress - 0.5) * 4.5,
        Math.cos(progress * Math.PI * 3) * 0.05,
      ),
    );
  }
  const signalSpine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(signalSpinePoints),
    new THREE.LineBasicMaterial({
      color: 0xb99a64,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    }),
  );
  signalSpine.rotation.z = 0.12;
  sculpture.add(signalSpine);
  let identityPlate;
  if (isTouch) {
    identityPlate = new THREE.Object3D();
  } else {
    const identityCanvas = document.createElement("canvas");
    identityCanvas.width = 1024;
    identityCanvas.height = 256;
    const identityContext = identityCanvas.getContext("2d");
    if (identityContext) {
      identityContext.clearRect(0, 0, identityCanvas.width, identityCanvas.height);
      identityContext.fillStyle = "rgba(7, 8, 8, 0.94)";
      identityContext.fillRect(0, 0, identityCanvas.width, identityCanvas.height);
      identityContext.strokeStyle = "rgba(191, 211, 209, 0.58)";
      identityContext.lineWidth = 3;
      identityContext.strokeRect(3, 3, identityCanvas.width - 6, identityCanvas.height - 6);
      identityContext.fillStyle = "#b99a64";
      identityContext.fillRect(36, 38, 6, 104);
      identityContext.fillStyle = "#f1f0eb";
      identityContext.font = "700 80px sans-serif";
      identityContext.letterSpacing = "7px";
      identityContext.fillText("LESNAR AI LTD", 66, 122);
      identityContext.fillStyle = "#9bb6b5";
      identityContext.font = "500 27px monospace";
      identityContext.fillText("NAIROBI  ·  ENGINEERING STUDIO  ·  WORLDWIDE", 69, 184);
    }
    const identityTexture = new THREE.CanvasTexture(identityCanvas);
    identityTexture.encoding = THREE.sRGBEncoding;
    identityPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(3.9, 0.975),
      new THREE.MeshBasicMaterial({
        map: identityTexture,
        transparent: true,
        opacity: 0.94,
        side: THREE.FrontSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
  }
  scene.add(identityPlate);
  const globeGround = new THREE.Group();
  const groundDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.65, isTouch ? 24 : 64),
    new THREE.MeshBasicMaterial({
      color: 0x071012,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  groundDisc.rotation.x = -Math.PI / 2;
  groundDisc.scale.set(1.15, 0.72, 1);
  globeGround.add(groundDisc);
  const groundingRings = [];
  [0.82, 1.18, 1.58].forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, index === 0 ? 0.018 : 0.01, 6, isTouch ? 32 : 96),
      new THREE.MeshBasicMaterial({
        color: index === 2 ? 0xb99a64 : 0x7ea9ad,
        transparent: true,
        opacity: 0.34 - index * 0.07,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.scale.y = 0.58;
    globeGround.add(ring);
    groundingRings.push(ring);
  });
  scene.add(globeGround);
  const orbitMaterial = new THREE.LineBasicMaterial({
    color: 0x9185a2,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  [
    { radius: 2.15, x: 1.1, y: 0.2 },
    { radius: 2.55, x: 0.4, y: 1.15 },
    { radius: 2.92, x: 1.45, y: -0.45 },
  ].forEach(({ radius, x, y }) => {
    const points = [];
    const count = isTouch ? 48 : 150;
    for (let index = 0; index <= count; index++) {
      const angle = (index / count) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }
    const orbit = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      orbitMaterial,
    );
    orbit.rotation.set(x, y, 0);
    orbitGroup.add(orbit);
  });
  const satellites = [];
  const dust = new THREE.Object3D();
  sculpture.add(dust);
  satelliteGroup.visible = false;
  dust.visible = false;
  const targetRotation = { x: -0.12, y: 0.28 };
  const pointer = {
    x: 0.48,
    y: 0.08,
    previousX: 0.18,
    previousY: -0.04,
    energy: isTouch ? 0.18 : 0.28,
    targetEnergy: isTouch ? 0.18 : 0.28,
  };
  const globeFocusControl = document.querySelector("[data-globe-focus]");
  const globeTitle = globeFocusControl?.querySelector("[data-globe-title]");
  const globeDetail = globeFocusControl?.querySelector("[data-globe-detail]");
  const globeStatus = globeFocusControl?.querySelector("[data-globe-status]");
  const globePopover = globeFocusControl?.querySelector("[data-globe-popover]");
  const globeCue = globeFocusControl?.querySelector("[data-globe-cue]");
  const globeCount = globeFocusControl?.querySelector("[data-globe-count]");
  const globeConnectorRail = globeFocusControl?.querySelector("[data-globe-connector-rail]");
  const connectorRaycaster = new THREE.Raycaster();
  const connectorPointer = new THREE.Vector2();
  const connectorButtons = [];
  const visitedConnectors = new Set();
  let activeConnectorIndex = -1;
  let globeFocusActive = false;
  let sculptureBaseScale = 1;
  let globeGroundBaseScale = 1;
  const globeDrag = {
    active: false,
    moved: false,
    intent: null,
    pointerId: null,
    x: 0,
    y: 0,
    suppressClick: false,
    velocityX: 0,
    velocityY: 0,
  };
  const globeMomentum = { x: 0, y: 0 };
  function setGlobeFocus(active) {
    globeFocusActive = active;
    document.body.classList.toggle("globe-focus", active);
    globeFocusControl?.setAttribute("aria-expanded", String(active));
  }
  function updateGlobeConnectorCopy(connection) {
    if (!globeFocusControl || !globeTitle || !globeDetail || !globeStatus) return;
    globeFocusControl.classList.toggle("has-connector", Boolean(connection));
    if (!connection) {
      globeFocusControl.style.removeProperty("--globe-accent");
      globeTitle.textContent = "Explore the globe";
      globeDetail.textContent = "Drag gently, tap a glowing icon, or use this card for a guided tour.";
      globeStatus.textContent = "Lesnar connects work to the world";
      if (globeCue) globeCue.textContent = "Tap to start the connection tour";
      if (globeCount) globeCount.textContent = `00 / ${String(connections.length).padStart(2, "0")}`;
      globePopover?.setAttribute("aria-label", "Start the Lesnar world connection tour");
      return;
    }
    globeFocusControl.style.setProperty("--globe-accent", connection.accent);
    globeTitle.textContent = connection.label;
    globeDetail.textContent = connection.contribution;
    globeStatus.textContent = `${connection.route || connection.detail} through Lesnar`;
    if (globeCue) globeCue.textContent = "Tap for another world connection";
    if (globeCount) {
      globeCount.textContent = `${String(activeConnectorIndex + 1).padStart(2, "0")} / ${String(connections.length).padStart(2, "0")}`;
    }
    globePopover?.setAttribute("aria-label", `Show another connection after ${connection.label}`);
  }
  function updateConnectorButtons() {
    connectorButtons.forEach((button, index) => {
      const isActive = index === activeConnectorIndex;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }
  function setActiveConnector(index) {
    const connection = connections[index];
    activeConnectorIndex = connection ? index : -1;
    updateGlobeConnectorCopy(connection);
    updateConnectorButtons();
    if (connection) {
      visitedConnectors.add(index);
      setGlobeFocus(true);
      pointer.targetEnergy = Math.max(pointer.targetEnergy, isTouch ? 0.26 : 0.48);
      const fullTurn = Math.PI * 2;
      const focusY =
        connection.focusRotation.y +
        Math.round((targetRotation.y - connection.focusRotation.y) / fullTurn) * fullTurn;
      targetRotation.x = connection.focusRotation.x;
      targetRotation.y = focusY;
      globeMomentum.x = 0;
      globeMomentum.y = 0;
    }
  }
  updateGlobeConnectorCopy(null);
  function getNextConnectorIndex() {
    if (!connections.length) return -1;
    const startIndex = activeConnectorIndex >= 0 ? activeConnectorIndex : -1;
    for (let step = 1; step <= connections.length; step++) {
      const candidate = (startIndex + step + connections.length) % connections.length;
      if (!visitedConnectors.has(candidate)) return candidate;
    }
    visitedConnectors.clear();
    if (activeConnectorIndex >= 0) visitedConnectors.add(activeConnectorIndex);
    return (startIndex + 1 + connections.length) % connections.length;
  }
  globePopover?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const nextIndex = getNextConnectorIndex();
    if (nextIndex < 0) return;
    globePopover.classList.remove("is-switching");
    void globePopover.offsetWidth;
    globePopover.classList.add("is-switching");
    setActiveConnector(nextIndex);
    window.setTimeout(() => globePopover.classList.remove("is-switching"), 520);
  });
  ["pointerdown", "pointerup"].forEach((eventName) => {
    globePopover?.addEventListener(eventName, (event) => {
      event.stopPropagation();
    });
  });
  document.addEventListener("lesnar:globe-fallback-select", (event) => {
    const index = Number(event.detail?.index);
    if (!Number.isInteger(index)) return;
    setActiveConnector(index);
  });
  function buildConnectorRail() {
    if (!globeConnectorRail) return;
    globeConnectorRail.removeAttribute("hidden");
    globeConnectorRail.replaceChildren();
    connectorButtons.length = 0;
    connections.forEach((connection, index) => {
      const button = document.createElement("button");
      const detail = document.createElement("small");
      button.type = "button";
      button.style.setProperty("--connector-accent", connection.accent);
      button.setAttribute("aria-label", `Show ${connection.label} connection`);
      button.setAttribute("aria-pressed", "false");
      button.dataset.connectorIndex = String(index);
      button.append(document.createTextNode(connection.short || connection.label));
      detail.textContent = connection.detail || connection.route || "World connector";
      button.append(detail);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setActiveConnector(index);
      });
      ["pointerdown", "pointerup"].forEach((eventName) => {
        button.addEventListener(eventName, (event) => event.stopPropagation());
      });
      globeConnectorRail.appendChild(button);
      connectorButtons.push(button);
    });
    updateConnectorButtons();
  }
  buildConnectorRail();
  function pickConnector(event) {
    if (!renderer || !camera || !connectionHitTargets.length) return -1;
    const rect = renderer.domElement.getBoundingClientRect();
    connectorPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    connectorPointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    connectorRaycaster.setFromCamera(connectorPointer, camera);
    const hit = connectorRaycaster
      .intersectObjects(connectionHitTargets, false)
      .find((entry) => Number.isInteger(entry.object.userData.connectorIndex));
    if (hit) return hit.object.userData.connectorIndex;

    const iconWorldPosition = new THREE.Vector3();
    const screenPosition = new THREE.Vector3();
    const hitRadius = isTouch ? 168 : 188;
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    connections.forEach((connection, index) => {
      connection.iconSprite.getWorldPosition(iconWorldPosition);
      screenPosition.copy(iconWorldPosition).project(camera);
      if (screenPosition.z < -1 || screenPosition.z > 1) return;
      const x = rect.left + (screenPosition.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-screenPosition.y * 0.5 + 0.5) * rect.height;
      const distance = Math.hypot(event.clientX - x, event.clientY - y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    if (nearestDistance <= hitRadius) return nearestIndex;

    const controlRect = globeFocusControl?.getBoundingClientRect();
    if (controlRect) {
      const insideControl =
        event.clientX >= controlRect.left &&
        event.clientX <= controlRect.right &&
        event.clientY >= controlRect.top &&
        event.clientY <= controlRect.bottom;
      if (insideControl) {
        const x = (event.clientX - controlRect.left) / Math.max(controlRect.width, 1);
        const y = (event.clientY - controlRect.top) / Math.max(controlRect.height, 1);
        const anchors = compactLayout
          ? [
              [0.18, 0.42],
              [0.4, 0.18],
              [0.73, 0.31],
              [0.82, 0.5],
              [0.72, 0.73],
              [0.5, 0.79],
              [0.24, 0.66],
              [0.44, 0.5],
              [0.33, 0.78],
              [0.59, 0.21],
            ]
          : [
              [0.18, 0.38],
              [0.38, 0.17],
              [0.7, 0.25],
              [0.83, 0.46],
              [0.76, 0.72],
              [0.52, 0.82],
              [0.23, 0.66],
              [0.46, 0.46],
              [0.33, 0.76],
              [0.58, 0.2],
            ];
        let fallbackIndex = 0;
        let fallbackDistance = Number.POSITIVE_INFINITY;
        anchors.forEach(([anchorX, anchorY], index) => {
          const distance = Math.hypot(x - anchorX, y - anchorY);
          if (distance < fallbackDistance) {
            fallbackDistance = distance;
            fallbackIndex = index;
          }
        });
        if (fallbackDistance <= (isTouch ? 0.46 : 0.38)) return fallbackIndex;
      }
    }
    return -1;
  }
  let identityBaseY = -2.25;
  let compactLayout = false;
  function placeSculpture() {
    const compact = window.innerWidth <= 900;
    compactLayout = compact;
    waveField.scale.set(compact ? 1.58 : 1.28, compact ? 1.36 : 1.18, 1);
    waveLines.scale.copy(waveField.scale);
    sculpture.position.set(compact ? 0.04 : 3.28, compact ? -1.14 : -0.08, compact ? -1.12 : -0.72);
    sculptureBaseScale = compact ? 0.5 : 0.78;
    sculpture.scale.setScalar(sculptureBaseScale);
    globeGround.position.set(
      sculpture.position.x,
      sculpture.position.y - (compact ? 0.72 : 1.16),
      sculpture.position.z + 0.04,
    );
    globeGroundBaseScale = compact ? 0.76 : 1.12;
    globeGround.scale.setScalar(globeGroundBaseScale);
    identityBaseY = sculpture.position.y - (compact ? 0.9 : 1.34);
    identityPlate.position.set(compact ? 0 : 2.56, identityBaseY - 0.18, compact ? 0.62 : 0.92);
    identityPlate.scale.setScalar(compact ? 0.32 : 0.54);
    connectionLabels.forEach((label) => {
      label.visible = false;
    });
    connectionIcons.forEach((icon) => {
      icon.scale.setScalar(compact ? 0.7 : 0.86);
    });
  }
  placeSculpture();
  globeFocusControl?.addEventListener("click", (event) => {
    if (globeDrag.suppressClick) {
      event.preventDefault();
      globeDrag.suppressClick = false;
      return;
    }
    const connectorIndex = pickConnector(event);
    if (connectorIndex >= 0) {
      event.preventDefault();
      delete globeFocusControl.dataset.fallbackConnectorIndex;
      setActiveConnector(connectorIndex);
      return;
    }
    const fallbackConnectorIndex = Number(globeFocusControl.dataset.fallbackConnectorIndex);
    if (Number.isInteger(fallbackConnectorIndex) && fallbackConnectorIndex >= 0) {
      event.preventDefault();
      delete globeFocusControl.dataset.fallbackConnectorIndex;
      setActiveConnector(fallbackConnectorIndex);
      return;
    }
    if (activeConnectorIndex >= 0) {
      event.preventDefault();
      setActiveConnector(-1);
      setGlobeFocus(false);
    }
  });
  globeFocusControl?.addEventListener(
    "pointerdown",
    (event) => {
      if (isMagicOff()) return;
      const touchLikePointer = event.pointerType === "touch" || event.pointerType === "pen";
      globeDrag.active = true;
      globeDrag.moved = false;
      globeDrag.intent = touchLikePointer ? null : "rotate";
      globeDrag.pointerId = event.pointerId;
      globeDrag.x = event.clientX;
      globeDrag.y = event.clientY;
      globeDrag.velocityX = 0;
      globeDrag.velocityY = 0;
      globeMomentum.x = 0;
      globeMomentum.y = 0;
      document.body.classList.add("globe-dragging");
      setGlobeFocus(true);
      if (!touchLikePointer) globeFocusControl.setPointerCapture?.(event.pointerId);
    },
    { passive: true },
  );
  globeFocusControl?.addEventListener(
    "pointermove",
    (event) => {
      if (!globeDrag.active || isMagicOff()) return;
      const dx = event.clientX - globeDrag.x;
      const dy = event.clientY - globeDrag.y;
      const horizontal = Math.abs(dx);
      const vertical = Math.abs(dy);
      const crossedThreshold = horizontal + vertical > 8;
      const touchLikePointer = event.pointerType === "touch" || event.pointerType === "pen";
      if (!globeDrag.intent && crossedThreshold) {
        if (touchLikePointer && vertical > horizontal * 1.25) {
          globeDrag.active = false;
          globeDrag.moved = false;
          globeDrag.suppressClick = false;
          globeDrag.intent = null;
          globeDrag.pointerId = null;
          document.body.classList.remove("globe-dragging");
          return;
        }
        globeDrag.intent = "rotate";
        globeFocusControl.setPointerCapture?.(event.pointerId);
      }
      if (globeDrag.intent === "rotate" && (crossedThreshold || globeDrag.moved)) {
        globeDrag.moved = true;
        globeDrag.suppressClick = true;
        event.preventDefault();
        const rotateSpeed = isTouch ? 0.0066 : 0.0048;
        targetRotation.y += dx * rotateSpeed;
        targetRotation.x = Math.max(-1.08, Math.min(0.96, targetRotation.x + dy * rotateSpeed * 0.72));
        globeDrag.velocityX = dx * rotateSpeed;
        globeDrag.velocityY = dy * rotateSpeed * 0.72;
        pointer.targetEnergy = Math.max(pointer.targetEnergy, isTouch ? 0.36 : 0.46);
      }
      globeDrag.x = event.clientX;
      globeDrag.y = event.clientY;
    },
    { passive: false },
  );
  ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
    globeFocusControl?.addEventListener(
      eventName,
      (event) => {
        if (!globeDrag.active) return;
        globeDrag.active = false;
        document.body.classList.remove("globe-dragging");
        if (globeDrag.moved) {
          globeFocusControl.dataset.dragSuppressClick = "true";
          window.setTimeout(() => {
            delete globeFocusControl.dataset.dragSuppressClick;
          }, 180);
          globeMomentum.x = Math.max(-0.045, Math.min(0.045, globeDrag.velocityX * 1.15));
          globeMomentum.y = Math.max(-0.032, Math.min(0.032, globeDrag.velocityY * 0.95));
        }
        globeFocusControl.releasePointerCapture?.(event.pointerId);
        if (eventName === "pointerup" && !globeDrag.moved) {
          const connectorIndex = pickConnector(event);
          if (connectorIndex >= 0) {
            event.preventDefault();
            setActiveConnector(connectorIndex);
          }
        }
        globeDrag.intent = null;
        globeDrag.pointerId = null;
        window.setTimeout(() => {
          if (!globeDrag.moved) globeDrag.suppressClick = false;
        }, 60);
      },
      { passive: false },
    );
  });
  window.addEventListener(
    "pointermove",
    (event) => {
      if (isMagicOff()) return;
      const nextX = (event.clientX / window.innerWidth) * 2 - 1;
      const nextY = -(event.clientY / window.innerHeight) * 2 + 1;
      const movement = Math.hypot(nextX - pointer.x, nextY - pointer.y);
      pointer.previousX += (pointer.x - pointer.previousX) * 0.44;
      pointer.previousY += (pointer.y - pointer.previousY) * 0.44;
      pointer.x = nextX;
      pointer.y = nextY;
      pointer.targetEnergy = Math.min(isTouch ? 0.42 : 0.72, (isTouch ? 0.18 : 0.28) + movement * (isTouch ? 0.82 : 2.6));
      waveUniforms.uPointer.value.set(pointer.x, pointer.y);
      waveUniforms.uPreviousPointer.value.set(pointer.previousX, pointer.previousY);
    },
    { passive: true },
  );
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (isMagicOff()) return;
      pointer.previousX = pointer.x;
      pointer.previousY = pointer.y;
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
      pointer.targetEnergy = isTouch ? 0.46 : 0.7;
      waveUniforms.uPointer.value.set(pointer.x, pointer.y);
      waveUniforms.uPreviousPointer.value.set(pointer.previousX, pointer.previousY);
    },
    { passive: true },
  );
  window.addEventListener(
    "pointerup",
    () => {
      pointer.targetEnergy = isTouch ? 0.18 : 0.28;
    },
    { passive: true },
  );
  let animationId = null;
  let heroVisible = true;
  let lastTimestamp = 0;
  let lastRenderTimestamp = 0;
  function render(timestamp) {
    if (document.hidden || isMagicOff()) {
      animationId = null;
      return;
    }
    animationId = requestAnimationFrame(render);
    const frameInterval = isTouch ? (touchWide ? 42 : 50) : (isLaptopProfile ? 33 : 0);
    if (frameInterval && timestamp - lastRenderTimestamp < frameInterval) return;
    lastRenderTimestamp = timestamp;
    const elapsed = timestamp * 0.001;
    const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
    lastTimestamp = timestamp;
    const ease = Math.min(delta * 5.5, 1);
    waveUniforms.uTime.value = elapsed;
    pointer.targetEnergy += ((isTouch ? 0.16 : 0.24) - pointer.targetEnergy) * Math.min(delta * 0.45, 1);
    pointer.energy += (pointer.targetEnergy - pointer.energy) * Math.min(delta * 5.2, 1);
    waveUniforms.uPointerEnergy.value = pointer.energy;
    targetRotation.y += delta * (activeConnectorIndex >= 0 ? 0.012 : 0.035) + globeMomentum.x;
    targetRotation.x = Math.max(-1.08, Math.min(0.96, targetRotation.x + globeMomentum.y));
    globeMomentum.x *= 0.93;
    globeMomentum.y *= 0.9;
    sculpture.visible = heroVisible;
    globeGround.visible = heroVisible;
    identityPlate.visible = false;
    sculpture.rotation.x += (targetRotation.x + pointer.y * 0.08 - sculpture.rotation.x) * ease;
    sculpture.rotation.y += (targetRotation.y + pointer.x * 0.1 - sculpture.rotation.y) * ease;
    const globeEase = Math.min(delta * 4.2, 1);
    const targetSculptureScale = sculptureBaseScale * (globeFocusActive ? (compactLayout ? 1.06 : 1.04) : 1);
    const targetGroundScale = globeGroundBaseScale * (globeFocusActive ? 1.08 : 1);
    sculpture.scale.setScalar(sculpture.scale.x + (targetSculptureScale - sculpture.scale.x) * globeEase);
    globeGround.scale.setScalar(globeGround.scale.x + (targetGroundScale - globeGround.scale.x) * globeEase);
    wire.rotation.x = elapsed * 0.11;
    wire.rotation.z = elapsed * -0.08;
    wovenStrands.forEach((strand, index) => {
      const breathe = 1 + Math.sin(elapsed * 0.72 + strand.userData.phase) * 0.018;
      strand.scale.set(
        breathe + pointer.x * 0.008,
        1 + Math.cos(elapsed * 0.58 + index * 0.17) * 0.012 + pointer.y * 0.008,
        breathe,
      );
    });
    ribbon.rotation.y = elapsed * 0.16;
    ribbon.rotation.z = -0.4 + Math.sin(elapsed * 0.45) * 0.12;
    orbitGroup.rotation.y = elapsed * -0.08;
    orbitGroup.rotation.z = elapsed * 0.035;
    satelliteGroup.rotation.y = elapsed * 0.12;
    satelliteGroup.rotation.z = elapsed * -0.045;
    dust.rotation.y = elapsed * -0.025;
    core.scale.setScalar(1 + Math.sin(elapsed * 1.25) * 0.022);
    glassShell.scale.setScalar(1 + Math.sin(elapsed * 0.72) * 0.012);
    glassShell.material.opacity = 0.035 + Math.sin(elapsed * 0.72) * 0.006;
    cyanLight.intensity = 1.7 + Math.sin(elapsed * 0.58) * 0.12;
    violetLight.intensity = 1.45 + Math.cos(elapsed * 0.47) * 0.1;
    sourceNode.scale.setScalar(1 + Math.sin(elapsed * 2.1) * 0.16);
    sourceHalos.forEach((halo, index) => {
      const haloPulse = 1 + Math.sin(elapsed * (0.72 + index * 0.11) + index) * 0.12;
      halo.scale.setScalar(haloPulse);
      halo.rotation.z += delta * (index % 2 === 0 ? 0.14 : -0.11);
      halo.material.opacity = 0.58 - index * 0.12 + Math.sin(elapsed * 1.2 + index) * 0.08;
    });
    motherNodeLabel.material.opacity = 0.9 + Math.sin(elapsed * 1.15) * 0.06;
    groundDisc.material.opacity = 0.34 + Math.sin(elapsed * 0.8) * 0.04;
    groundingRings.forEach((ring, index) => {
      const pulse = 1 + Math.sin(elapsed * (0.75 + index * 0.08) - index * 0.7) * 0.08;
      ring.scale.set(pulse, 0.58 * pulse, pulse);
      ring.material.opacity = 0.28 - index * 0.05 + Math.sin(elapsed + index) * 0.04;
    });
    connections.forEach(({ curve, cord, line, routeArc, routeLine, endpoint, pulse, endpointHalo, iconSprite, labelSprite, offset, direction }, index) => {
      const isActiveConnector = activeConnectorIndex === index;
      const progress = (
        elapsed * (0.075 + index * 0.005) * direction +
        offset +
        10
      ) % 1;
      pulse.position.copy(curve.getPoint(progress));
      pulse.scale.setScalar((0.75 + Math.sin(progress * Math.PI) * 0.55) * (isActiveConnector ? 1.35 : 1));
      pulse.material.opacity = (0.56 + Math.sin(progress * Math.PI) * 0.34) * (isActiveConnector ? 1.22 : 1);
      endpoint.scale.setScalar(isActiveConnector ? 1.34 + Math.sin(elapsed * 2.2) * 0.1 : 1);
      endpoint.material.opacity = isActiveConnector ? 1 : 0.88;
      endpointHalo.scale.setScalar((1 + Math.sin(elapsed * 1.45 + index) * 0.12) * (isActiveConnector ? 1.42 : 1));
      endpointHalo.material.opacity = isActiveConnector ? 0.82 : 0.42 + Math.sin(elapsed * 1.45 + index) * 0.12;
      iconSprite.scale.setScalar((compactLayout ? 0.7 : 0.86) * (isActiveConnector ? 1.22 : 1));
      iconSprite.material.opacity = isActiveConnector ? 1 : 0.84;
      line.material.opacity = isActiveConnector ? 0.86 : (isTouch ? 0.34 : 0.46);
      cord.material.opacity = isActiveConnector ? (isTouch ? 0.38 : 0.46) : (isTouch ? 0.16 : 0.2);
      routeArc.material.opacity = isActiveConnector ? (isTouch ? 0.46 : 0.62) : (isTouch ? 0.22 : 0.32);
      routeLine.material.opacity = isActiveConnector ? (isTouch ? 0.82 : 0.96) : (isTouch ? 0.42 : 0.58);
      labelSprite.visible = false;
      labelSprite.material.opacity = 0;
    });
    satellites.forEach((satellite, index) => {
      satellite.rotation.x = elapsed * (0.25 + index * 0.018);
      satellite.rotation.y = elapsed * (-0.18 - index * 0.013);
    });
    camera.position.x += (pointer.x * 0.16 - camera.position.x) * 0.025;
    camera.position.y += (2.6 + pointer.y * 0.18 - camera.position.y) * 0.025;
    camera.lookAt(0, -0.2, -1.4);
    identityPlate.position.y = identityBaseY + Math.sin(elapsed * 0.7) * 0.04;
    identityPlate.quaternion.copy(camera.quaternion);
    identityPlate.rotateZ(-0.025);
    renderer.render(scene, camera);
  }
  function startAnimation() {
    if (!animationId && !document.hidden) {
      lastTimestamp = performance.now();
      animationId = requestAnimationFrame(render);
    }
  }
  function stopAnimation() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        heroVisible = entry.isIntersecting && entry.intersectionRatio > 0.08;
      },
      { threshold: [0, 0.08] },
    );
    observer.observe(hero);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAnimation();
    else startAnimation();
  });
  document.addEventListener("lesnar:magic-change", (event) => {
    if (event.detail.enabled) {
      document.getElementById("webgl-container")?.removeAttribute("hidden");
      startAnimation();
    } else {
      stopAnimation();
    }
  });
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    waveUniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, maxPixelRatio);
    placeSculpture();
  });
  startAnimation();
  };
  if (!reduceMotion && !isMagicOff()) initializeWebgl();
});
