/* =========================================================
   UCHPA · Rock Inka — Navegación horizontal por paneles
   ========================================================= */

(() => {
  'use strict';

  const deck       = document.getElementById('deck');
  const panels     = Array.from(document.querySelectorAll('.panel'));
  const btnPrev    = document.querySelector('.hud__btn--prev');
  const btnNext    = document.querySelector('.hud__btn--next');
  const elCurrent  = document.querySelector('.hud__current');
  const elTotal    = document.querySelector('.hud__total');
  const yearEl     = document.getElementById('year');

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Generar chispas titilando ---------- */
  const sparksHost = document.querySelector('.ambient__sparks');
  if (sparksHost && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const count = Number(sparksHost.dataset.sparkCount) || 40;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      const size = (1.5 + Math.random() * 3).toFixed(2); // 1.5–4.5 px
      s.style.width  = `${size}px`;
      s.style.height = `${size}px`;
      s.style.left   = `${(Math.random() * 100).toFixed(2)}%`;
      // Concentrar en el tercio superior, con algo de dispersión
      s.style.top    = `${(Math.random() * 100).toFixed(2)}%`;
      s.style.setProperty('--spark-dur',   `${(2 + Math.random() * 3.5).toFixed(2)}s`);
      s.style.setProperty('--spark-delay', `${(Math.random() * 4).toFixed(2)}s`);
      frag.appendChild(s);
    }
    sparksHost.appendChild(frag);
  }

  if (!deck || !panels.length) return;

  const total = panels.length;
  if (elTotal) elTotal.textContent = String(total).padStart(2, '0');

  let currentIndex = 0;
  let isMobileLayout = false;

  const mediaMobile = window.matchMedia('(max-width: 768px), (orientation: portrait)');
  const checkLayout = () => { isMobileLayout = mediaMobile.matches; };
  checkLayout();
  mediaMobile.addEventListener('change', checkLayout);

  /* ---------- Scroll a panel por índice ---------- */
  function goToPanel(index) {
    const clamped = Math.max(0, Math.min(total - 1, index));
    const target = panels[clamped];
    if (!target) return;
    if (isMobileLayout) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      deck.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
    }
  }

  /* ---------- Detección del panel activo via IntersectionObserver ---------- */
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const idx = panels.indexOf(entry.target);
            if (idx !== -1 && idx !== currentIndex) {
              currentIndex = idx;
              updateHUD();
            }
          }
        });
      },
      {
        root: isMobileLayout ? null : deck,
        threshold: [0.5, 0.75]
      }
    );
    panels.forEach((p) => observer.observe(p));
  }

  function updateHUD() {
    if (elCurrent) elCurrent.textContent = String(currentIndex + 1).padStart(2, '0');
    if (btnPrev) btnPrev.disabled = currentIndex === 0;
    if (btnNext) btnNext.disabled = currentIndex === total - 1;
  }
  updateHUD();

  /* ---------- Botones prev / next ---------- */
  if (btnPrev) btnPrev.addEventListener('click', () => goToPanel(currentIndex - 1));
  if (btnNext) btnNext.addEventListener('click', () => goToPanel(currentIndex + 1));

  /* ---------- Teclado: flechas, PageUp/Down, Home, End, espacio ---------- */
  document.addEventListener('keydown', (e) => {
    // No interferir si el foco está dentro de un input, textarea, summary, etc.
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault();
        goToPanel(currentIndex + 1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        goToPanel(currentIndex - 1);
        break;
      case 'Home':
        e.preventDefault();
        goToPanel(0);
        break;
      case 'End':
        e.preventDefault();
        goToPanel(total - 1);
        break;
      case ' ':
        if (tag !== 'BUTTON' && tag !== 'A' && tag !== 'SUMMARY') {
          e.preventDefault();
          goToPanel(currentIndex + (e.shiftKey ? -1 : 1));
        }
        break;
    }
  });

  /* ---------- Rueda del mouse vertical → scroll horizontal (desktop) ---------- */
  // Solo aplicamos cuando el delta vertical predomina y estamos en layout horizontal.
  let wheelLock = false;
  deck.addEventListener('wheel', (e) => {
    if (isMobileLayout) return;
    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    if (absY > absX && absY > 8) {
      e.preventDefault();
      if (wheelLock) return;
      wheelLock = true;
      goToPanel(currentIndex + (e.deltaY > 0 ? 1 : -1));
      // Debounce para evitar saltar varios paneles con un swipe del trackpad
      setTimeout(() => { wheelLock = false; }, 450);
    }
  }, { passive: false });

  /* ---------- Skip link / anchors internos ---------- */
  document.querySelectorAll('a[href^="#panel-"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      const idx = panels.indexOf(target);
      if (idx === -1) return;
      e.preventDefault();
      goToPanel(idx);
      // Devolver foco al panel para lectores de pantalla
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  /* ---------- Detectar paneles vía scroll directo (fallback) ---------- */
  let scrollTick = null;
  deck.addEventListener('scroll', () => {
    if (scrollTick) cancelAnimationFrame(scrollTick);
    scrollTick = requestAnimationFrame(() => {
      if (isMobileLayout) return;
      const scrollLeft = deck.scrollLeft;
      const panelWidth = window.innerWidth;
      const idx = Math.round(scrollLeft / panelWidth);
      if (idx !== currentIndex && idx >= 0 && idx < total) {
        currentIndex = idx;
        updateHUD();
      }
    });
  }, { passive: true });

  /* ---------- Focus del deck al cargar para que el teclado funcione ---------- */
  // Pequeño delay para no robar foco si el usuario llega vía deep-link.
  window.addEventListener('load', () => {
    if (window.location.hash) return;
    deck.focus({ preventScroll: true });
  });

  /* =========================================================
     MODAL DE VIDEO YouTube
     ========================================================= */
  const modal       = document.getElementById('video-modal');
  const modalTitle  = document.getElementById('video-modal-title');
  const modalFrame  = document.getElementById('video-modal-iframe');
  const videoBtns   = document.querySelectorAll('.video__link[data-video-id]');

  if (modal && modalFrame && videoBtns.length) {
    let lastTrigger = null;

    function openVideoModal(videoId, title, trigger) {
      lastTrigger = trigger || null;
      modalTitle.textContent = title || 'Reproductor';
      modalFrame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        modal.classList.add('is-open');
        const closeBtn = modal.querySelector('.video-modal__close');
        if (closeBtn) closeBtn.focus();
      });
    }

    function closeVideoModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      modalFrame.src = ''; // detiene la reproducción
      setTimeout(() => { modal.hidden = true; }, 200);
      document.body.style.overflow = '';
      if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
    }

    videoBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id    = btn.dataset.videoId;
        const title = btn.dataset.videoTitle;
        if (id) openVideoModal(id, title, btn);
      });
    });

    modal.querySelectorAll('[data-modal-close]').forEach((el) => {
      el.addEventListener('click', closeVideoModal);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        e.preventDefault();
        closeVideoModal();
      }
    });
  }

  /* =========================================================
     RIDER · tabs accesibles (lista izq + panel der)
     ========================================================= */
  const riderTabs   = Array.from(document.querySelectorAll('.rider-tab'));
  const riderPanels = Array.from(document.querySelectorAll('.rider-panel'));

  if (riderTabs.length && riderPanels.length) {
    function activateRiderTab(tab, setFocus = false) {
      riderTabs.forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle('is-active', isActive);
        t.setAttribute('aria-selected', String(isActive));
        t.setAttribute('tabindex', isActive ? '0' : '-1');
      });
      const targetId = tab.getAttribute('aria-controls');
      riderPanels.forEach((p) => {
        const show = p.id === targetId;
        p.hidden = !show;
        p.classList.toggle('is-active', show);
      });
      if (setFocus) tab.focus();
    }

    riderTabs.forEach((tab) => {
      tab.addEventListener('click', () => activateRiderTab(tab));

      tab.addEventListener('keydown', (e) => {
        const idx = riderTabs.indexOf(tab);
        let nextIdx = idx;
        switch (e.key) {
          case 'ArrowDown':
          case 'ArrowRight':
            e.preventDefault();
            nextIdx = (idx + 1) % riderTabs.length;
            break;
          case 'ArrowUp':
          case 'ArrowLeft':
            e.preventDefault();
            nextIdx = (idx - 1 + riderTabs.length) % riderTabs.length;
            break;
          case 'Home':
            e.preventDefault();
            nextIdx = 0;
            break;
          case 'End':
            e.preventDefault();
            nextIdx = riderTabs.length - 1;
            break;
          default:
            return;
        }
        if (nextIdx !== idx) activateRiderTab(riderTabs[nextIdx], true);
      });
    });
  }
})();
