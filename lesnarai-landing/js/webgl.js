(function () {
  const canvas = document.getElementById("webgl-canvas");
  if (!canvas || typeof THREE === "undefined") return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    canvas.style.display = "none";
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(-10, 0, 30);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const orbitGroup = new THREE.Group();
  scene.add(orbitGroup);

  const lineMat = new THREE.LineBasicMaterial({
    color: 0x007aff,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
  });

  const dimLineMat = new THREE.LineBasicMaterial({
    color: 0x007aff,
    transparent: true,
    opacity: 0.1,
  });

  function createOrbit(radiusX, radiusY, segments, mat) {
    const curve = new THREE.EllipseCurve(0, 0, radiusX, radiusY, 0, 2 * Math.PI, false, 0);
    const points = curve.getPoints(segments);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.Line(geometry, mat);
  }

  const orbit1 = createOrbit(25, 25, 128, lineMat);
  orbit1.rotation.x = Math.PI / 2.2;
  orbitGroup.add(orbit1);

  const orbit2 = createOrbit(35, 15, 128, dimLineMat);
  orbit2.rotation.x = Math.PI / 1.8;
  orbit2.rotation.y = Math.PI / 4;
  orbitGroup.add(orbit2);

  const orbit3 = createOrbit(40, 40, 128, dimLineMat);
  orbit3.rotation.x = Math.PI / 2;
  orbitGroup.add(orbit3);

  const pGeo = new THREE.BufferGeometry();
  const pCount = 1500;
  const pArray = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount * 3; i++) {
    pArray[i] = (Math.random() - 0.5) * 100;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pArray, 3));

  const pMat = new THREE.PointsMaterial({
    color: 0x007aff,
    size: 0.05,
    transparent: true,
    opacity: 0.4,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  orbitGroup.position.set(15, 0, -10);

  let targetX = 0;
  let targetY = 0;
  let animationId = null;
  let isVisible = true;

  window.addEventListener("mousemove", (e) => {
    targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  const clock = new THREE.Clock();

  function animate() {
    if (!isVisible) return;
    animationId = requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    orbitGroup.rotation.y = time * 0.05;
    orbitGroup.rotation.z = time * 0.02;
    particles.rotation.y = time * 0.01;

    camera.position.x += (targetX * 2 - 10 - camera.position.x) * 0.02;
    camera.position.y += (-targetY * 2 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);

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
