// Small enhancements only: the page works without them.

/** Drag-to-rotate for the hero building, with a slow idle turn unless reduced motion is preferred. */
function heroBuilding() {
  const scene = document.getElementById("scene");
  const bldg = document.getElementById("bldg");
  if (!scene || !bldg) return;
  let rx = -14;
  let ry = -34;
  let dragging = false;
  let last = { x: 0, y: 0 };
  const apply = () => {
    bldg.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  scene.addEventListener("pointerdown", (e) => {
    dragging = true;
    last = { x: e.clientX, y: e.clientY };
    scene.setPointerCapture(e.pointerId);
  });
  scene.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    ry += (e.clientX - last.x) * 0.4;
    rx = Math.max(-45, Math.min(10, rx - (e.clientY - last.y) * 0.4));
    last = { x: e.clientX, y: e.clientY };
    apply();
  });
  const stop = () => {
    dragging = false;
  };
  scene.addEventListener("pointerup", stop);
  scene.addEventListener("pointercancel", stop);
  apply();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let t0 = performance.now();
  const sway = (t: number) => {
    if (!dragging) {
      ry += Math.sin((t - t0) / 2600) * 0.05;
      apply();
    } else {
      t0 = t;
    }
    requestAnimationFrame(sway);
  };
  requestAnimationFrame(sway);
}

/** Live character count under the message box. */
function messageCounter() {
  const box = document.querySelector<HTMLTextAreaElement>("#message");
  const out = document.getElementById("message-count");
  if (!box || !out) return;
  const update = () => {
    out.textContent = `${box.value.length} / ${box.maxLength}`;
  };
  box.addEventListener("input", update);
  update();
}

function year() {
  const el = document.getElementById("year");
  if (el) el.textContent = String(new Date().getFullYear());
}

heroBuilding();
messageCounter();
year();
