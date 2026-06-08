/* Bract DS — theme switching, icon init, persistence */
(function () {
  const root = document.documentElement;
  const LS = {
    brand: 'bract.brand.v2',
    density: 'bract.density.v2',
    radius: 'bract.radius.v2',
    theme: 'bract.theme.v2',
  };

  // restore
  root.setAttribute('data-brand', localStorage.getItem(LS.brand) || 'foliage');
  root.setAttribute('data-density', localStorage.getItem(LS.density) || 'medium');
  root.setAttribute('data-radius', localStorage.getItem(LS.radius) || 'sharp');
  root.setAttribute('data-theme', localStorage.getItem(LS.theme) || 'light');

  window.BractDS = {
    set(kind, value) {
      root.setAttribute('data-' + kind, value);
      localStorage.setItem(LS[kind], value);
      // reflect active state on any control group
      document.querySelectorAll('[data-ctl="' + kind + '"]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.val === value));
      });
    },
    sync() {
      ['brand', 'density', 'radius', 'theme'].forEach((k) => {
        const v = root.getAttribute('data-' + k);
        document.querySelectorAll('[data-ctl="' + k + '"]').forEach((b) => {
          b.setAttribute('aria-pressed', String(b.dataset.val === v));
        });
      });
    },
  };

  // Inject a light/dark theme toggle into every .design-fab (once)
  function injectThemeToggle() {
    document.querySelectorAll('.design-fab').forEach((fab) => {
      if (fab.querySelector('[data-ctl="theme"]')) return;
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', 'テーマ');
      seg.innerHTML =
        '<button data-ctl="theme" data-val="light" title="ライト"><span class="sw" style="background:oklch(0.97 0.004 88)"></span></button>' +
        '<button data-ctl="theme" data-val="dark" title="ダーク"><span class="sw" style="background:oklch(0.22 0.006 80)"></span></button>';
      fab.appendChild(seg);
    });
  }

  function initIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({
        attrs: { 'stroke-width': 2.25, width: 18, height: 18, class: 'ic' },
      });
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ctl]');
    if (btn) {
      window.BractDS.set(btn.dataset.ctl, btn.dataset.val);
    }
  });

  window.addEventListener('DOMContentLoaded', () => {
    injectThemeToggle();
    initIcons();
    window.BractDS.sync();
  });
  // icons may also be requested after dynamic insertion
  window.initBractIcons = initIcons;
})();
