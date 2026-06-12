document.addEventListener("DOMContentLoaded", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const hasGsap = typeof gsap !== "undefined";

  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
  }

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

  if (hasGsap && !reduceMotion) {
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.to(".char", {
      y: "0%",
      opacity: 1,
      duration: 1.5,
      stagger: 0.02,
      delay: 0.1,
    }).to(
      ".hero-fade",
      { y: 0, opacity: 1, duration: 1.2, stagger: 0.1 },
      "-=1.0",
    );

    gsap.utils.toArray("h2.split-text").forEach((header) => {
      gsap.to(header.querySelectorAll(".char"), {
        y: "0%",
        opacity: 1,
        duration: 1,
        stagger: 0.015,
        ease: "expo.out",
        scrollTrigger: { trigger: header, start: "top 85%", once: true },
      });
    });

    gsap.utils.toArray(".card, .contact-sector .fade-up").forEach((el) => {
      const delayClass = Array.from(el.classList).find((c) => c.startsWith("delay-"));
      const delay = delayClass ? parseInt(delayClass.split("-")[1], 10) * 0.1 : 0;
      gsap.to(el, {
        y: 0,
        opacity: 1,
        duration: 1,
        delay,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    });
  } else {
    document.querySelectorAll(".char, .fade-up, .hero-fade").forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  }

  if (!isTouch && !reduceMotion) {
    const cursor = document.getElementById("cursor-dot");
    const ring = document.getElementById("cursor-ring");
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    window.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (cursor) {
        cursor.style.transform = `translate(${mouseX - 2}px, ${mouseY - 2}px)`;
      }
    });

    function renderCursor() {
      ringX += (mouseX - ringX) * 0.2;
      ringY += (mouseY - ringY) * 0.2;
      if (ring) {
        ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
      }
      requestAnimationFrame(renderCursor);
    }
    renderCursor();

    if (hasGsap) {
      document.querySelectorAll("[data-magnetic]").forEach((btn) => {
        btn.addEventListener("mousemove", (e) => {
          const rect = btn.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;
          gsap.to(btn, { x: x * 0.4, y: y * 0.4, duration: 0.4, ease: "power2.out" });
          if (ring) {
            ring.style.borderColor = "var(--accent)";
            ring.style.width = "60px";
            ring.style.height = "60px";
          }
        });
        btn.addEventListener("mouseleave", () => {
          gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.3)" });
          if (ring) {
            ring.style.borderColor = "var(--accent-dim)";
            ring.style.width = "40px";
            ring.style.height = "40px";
          }
        });
      });
    }
  }

  if (reduceMotion || isTouch || typeof THREE === "undefined") return;

  const canvas = document.getElementById("webgl-canvas");
  if (!canvas) return;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030303, 0.015);

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(15, 0, 40);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const swarmGroup = new THREE.Group();
  scene.add(swarmGroup);

  const irisGeo = new THREE.SphereGeometry(4, 32, 32);
  const irisMat = new THREE.PointsMaterial({
    color: 0xff2a00,
    size: 0.15,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  });
  const iris = new THREE.Points(irisGeo, irisMat);
  swarmGroup.add(iris);

  const shellGeo = new THREE.BufferGeometry();
  const shellCount = 4000;
  const shellPos = new Float32Array(shellCount * 3);
  for (let i = 0; i < shellCount * 3; i += 3) {
    const r = 8 + Math.random() * 6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    shellPos[i] = r * Math.sin(phi) * Math.cos(theta);
    shellPos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
    shellPos[i + 2] = r * Math.cos(phi);
  }
  shellGeo.setAttribute("position", new THREE.BufferAttribute(shellPos, 3));
  const shellMat = new THREE.PointsMaterial({
    color: 0x444444,
    size: 0.05,
    transparent: true,
    opacity: 0.4,
  });
  const shell = new THREE.Points(shellGeo, shellMat);
  swarmGroup.add(shell);

  swarmGroup.position.set(8, 0, 0);

  const target = new THREE.Vector3();
  const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const lookDummy = new THREE.Object3D();

  window.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(mousePlane, target);
  });

  const clock = new THREE.Clock();
  let animationId = null;
  let isVisible = true;

  function animate() {
    if (!isVisible) return;
    animationId = requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    iris.scale.setScalar(1 + Math.sin(time * 2) * 0.05);
    shell.rotation.y = time * 0.05;
    shell.rotation.z = time * 0.02;

    const lookAtTarget = target.clone();
    lookAtTarget.z += 20;

    lookDummy.position.copy(swarmGroup.position);
    lookDummy.lookAt(lookAtTarget);
    swarmGroup.quaternion.slerp(lookDummy.quaternion, 0.05);

    swarmGroup.position.y = Math.sin(time) * 1.5;

    renderer.render(scene, camera);
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting || entry.intersectionRatio > 0;
          if (isVisible && !animationId) animate();
          if (!isVisible && animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
          }
        });
      },
      { threshold: 0 },
    );
    observer.observe(document.body);
  }

  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
});
