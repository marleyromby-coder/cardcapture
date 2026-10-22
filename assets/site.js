// CardCapture — the site's only script: play the hero loop while it is on screen, keep it still
// for anyone who asked for less motion or less data, and tilt the 3D cards toward the pointer.
// No tracking. The one network call is the waitlist form, sent only when someone submits it, to
// CardCapture's own Worker (Server/waitlist) — the address typed, the page's language, nothing else.
(() => {
  const form = document.querySelector(".waitlist-form");
  if (form) {
    const messages = JSON.parse(form.dataset.messages);
    const status = form.querySelector(".waitlist-status");
    const input = form.querySelector("#waitlist-email");
    const button = form.querySelector("button");
    const say = (text, kind) => { status.textContent = text; status.className = "waitlist-status " + (kind || ""); };
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = input.value.trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      input.setAttribute("aria-invalid", valid ? "false" : "true");
      if (!valid) { say(messages.invalid, "bad"); input.focus(); return; }
      button.disabled = true;
      say(messages.sending);
      try {
        const response = await fetch(form.dataset.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, lang: form.dataset.lang, website: form.elements.website.value }),
        });
        if (response.ok) { say(messages.ok, "ok"); form.reset(); }
        else if (response.status === 503) { say(messages.full, "bad"); }
        else if (response.status === 400) { say(messages.invalid, "bad"); }
        else { say(messages.error, "bad"); }
      } catch (error) {
        say(messages.error, "bad");
      }
      button.disabled = false;
    });
  }

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
