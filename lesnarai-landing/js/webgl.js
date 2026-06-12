(function () {
  const canvas = document.getElementById("webgl-canvas");
  if (!canvas || typeof THREE === "undefined") return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    canvas.style.display = "none";
    return;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.z = 5;

  const pGeo = new THREE.BufferGeometry();
  const pCount = 3000;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount * 3; i++) {
    pPos[i] = (Math.random() - 0.5) * 30;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));

  const pMat = new THREE.PointsMaterial({
    color: 0x007aff,
    size: 0.015,
    transparent: true,
    opacity: 0.4,
  });
  const particleSystem = new THREE.Points(pGeo, pMat);
  scene.add(particleSystem);

  const ringGroup = new THREE.Group();
  scene.add(ringGroup);

  const ringMat = new THREE.LineBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.6 });
  const ringMatDim = new THREE.LineBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.2 });

  function makeRing(r, segs, mat) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(geo, mat);
  }

  const r1 = makeRing(2.2, 128, ringMat);
  ringGroup.add(r1);
  const r2 = makeRing(2.2, 128, ringMatDim);
  r2.rotation.y = Math.PI / 2;
  ringGroup.add(r2);
  const r3 = makeRing(2.2, 128, ringMatDim);
  r3.rotation.x = Math.PI / 2;
  ringGroup.add(r3);
  ringGroup.position.set(2.5, -0.2, 0);

  let animationId = null;
  let isVisible = true;
  let mouseX = 0;
  let mouseY = 0;

  document.addEventListener("mousemove", (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 0.5;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 0.5;
  });

  const clock = new THREE.Clock();

  function animate() {
    if (!isVisible) return;
    animationId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    r1.rotation.z = t * 0.2;
    r2.rotation.z = -t * 0.15;

    ringGroup.rotation.x += (mouseY - ringGroup.rotation.x) * 0.05;
    ringGroup.rotation.y += (mouseX + t * 0.05 - ringGroup.rotation.y) * 0.05;
    particleSystem.rotation.y = t * 0.02;

    renderer.render(scene, camera);
  }

  const hero = document.getElementById("hero");
  if (hero && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          if (isVisible) {
            if (!animationId) animate();
          } else if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
          }
        });
      },
      { threshold: 0 },
    );
    observer.observe(hero);
  }

  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
