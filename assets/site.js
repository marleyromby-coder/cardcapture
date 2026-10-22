// CardCapture — the site's only script: play the hero loop while it is on screen, keep it still
// for anyone who asked for less motion or less data, and tilt the 3D cards toward the pointer.
// No tracking, no network calls.
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = navigator.connection && navigator.connection.saveData;

  const video = document.querySelector(".hero-video");
  if (video) {
    if (reduce || saveData) {
      video.removeAttribute("autoplay");
      video.pause();
    } else {
      // The autoplay attribute alone is not always honoured, so start it by hand — and pause
      // it when it scrolls away, so it costs nothing while nobody is looking.
      video.muted = true;
      const play = () => video.play().catch(() => {});
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((entries) => {
          entries.forEach((entry) => (entry.isIntersecting ? play() : video.pause()));
        }).observe(video);
      } else {
        play();
      }
    }
  }

  const finePointer = window.matchMedia("(pointer: fine)").matches;
  if (reduce || !finePointer) return;

  document.querySelectorAll(".trio-item").forEach((item) => {
    const card = item.querySelector(".trio-card");
    if (!card) return;
    item.addEventListener("pointermove", (event) => {
      const box = item.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      card.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 18}deg) translateZ(10px)`;
    });
    item.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });
})();
