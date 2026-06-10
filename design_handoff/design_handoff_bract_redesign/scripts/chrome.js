/* Bract — shared sidebar renderer.
   Usage: <aside class="sidebar" id="bract-sidebar" data-active="dashboard"></aside>
   Active item via data-active. Module collapse state persists in localStorage. */
(function () {
  const NAV = {
    top: [
      { id: 'dashboard', label: 'ダッシュボード', icon: 'layout-dashboard', href: 'Bract Dashboard.html' },
    ],
    modules: [
      {
        id: 'sales', label: '営業', items: [
          { id: 'accounts', label: '取引先', icon: 'building-2', count: 128, href: 'Bract Accounts List.html' },
          { id: 'contacts', label: '人物', icon: 'users', href: '#' },
          { id: 'opportunities', label: '商談', icon: 'trending-up', count: 24, href: 'Bract Opportunities.html' },
          { id: 'activities', label: '活動', icon: 'calendar-clock', href: '#' },
          { id: 'tasks', label: 'ToDo', icon: 'square-check-big', count: 7, href: '#' },
        ],
      },
      {
        id: 'autobody', label: '板金・整備', items: [
          { id: 'vehicles', label: '車両', icon: 'car', href: '#' },
          { id: 'maintenance', label: '整備', icon: 'wrench', count: 9, href: 'Bract Maintenance.html' },
          { id: 'parts', label: '部品', icon: 'cog', href: '#' },
          { id: 'receivables', label: '売掛金', icon: 'banknote', href: '#' },
        ],
      },
      {
        id: 'admin', label: '管理', items: [
          { id: 'quick', label: 'クイック登録', icon: 'sparkles', href: 'Bract Quick Entry.html' },
          { id: 'settings', label: '設定', icon: 'settings', href: 'Bract Admin.html' },
        ],
      },
    ],
  };

  const COLLAPSE_KEY = 'bract.nav.collapsed';
  function getCollapsed() { try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || []; } catch (e) { return []; } }
  function setCollapsed(arr) { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(arr)); }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function itemHTML(it, active) {
    const cls = 'nav-item' + (it.id === active ? ' is-active' : '');
    const count = it.count != null ? `<span class="badge-count">${it.count}</span>` : '';
    return `<a class="${cls}" href="${esc(it.href || '#')}" data-nav="${it.id}"><i data-lucide="${it.icon}"></i>${esc(it.label)}${count}</a>`;
  }

  function moduleHTML(mod, active, collapsed) {
    const hasActive = mod.items.some((i) => i.id === active);
    const isOpen = hasActive || !collapsed.includes(mod.id);
    const items = mod.items.map((i) => itemHTML(i, active)).join('');
    return `
      <button class="nav-module" aria-expanded="${isOpen}" data-module="${mod.id}">
        <i data-lucide="chevron-right" class="chev"></i>
        <span class="m-name">${esc(mod.label)}</span>
        <span class="m-count">${mod.items.length}</span>
      </button>
      <div class="nav-module-items">${items}</div>`;
  }

  function render(el) {
    const active = el.getAttribute('data-active') || 'dashboard';
    const collapsed = getCollapsed();
    const top = NAV.top.map((i) => itemHTML(i, active)).join('');
    const mods = NAV.modules.map((m) => moduleHTML(m, active, collapsed)).join('');
    el.innerHTML = `
      <div class="navprog" style="width:0;"></div>
      <div class="brand-row"><span class="bmark" style="width:20px;height:20px;"></span>Bract</div>
      <nav class="nav">
        <div style="padding:0 1px 2px;">${top}</div>
        ${mods}
      </nav>
      <div class="side-foot">
        <div class="side-user">
          <div class="avatar">田</div>
          <div class="meta"><div class="nm">田中 一郎</div><div class="rl">管理者 · 近藤板金工業</div></div>
          <i data-lucide="chevrons-up-down" class="ic" style="width:15px;height:15px;color:var(--side-text-dim);margin-left:auto;"></i>
        </div>
      </div>`;

    el.addEventListener('click', (e) => {
      const mb = e.target.closest('.nav-module');
      if (mb) {
        const open = mb.getAttribute('aria-expanded') === 'true';
        mb.setAttribute('aria-expanded', String(!open));
        const id = mb.dataset.module;
        let c = getCollapsed();
        if (open) { if (!c.includes(id)) c.push(id); } else { c = c.filter((x) => x !== id); }
        setCollapsed(c);
      }
    });

    if (window.initBractIcons) window.initBractIcons();
  }

  function boot() {
    document.querySelectorAll('#bract-sidebar, [data-bract-sidebar]').forEach(render);
    if (window.initBractIcons) window.initBractIcons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.renderBractSidebar = boot;
})();
