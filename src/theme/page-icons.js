// Insert unified page icons before page H1 titles and observe SPA changes
const ICON_SVGS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M3 13h4V3H3v10zM9 21h4V7H9v14zM15 17h4V11h-4v6z" fill="currentColor"/></svg>',
  users: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM8 11c1.657 0 3-1.343 3-3S9.657 5 8 5 5 6.343 5 8s1.343 3 3 3zM8 13c-2.667 0-8 1.333-8 4v2h16v-2c0-2.667-5.333-4-8-4zm8 0c-.29 0-.577.02-.86.058C16.03 13.804 18 15.233 18 17v2h6v-2c0-2.667-5.333-4-8-4z" fill="currentColor"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 7h18v10H2z" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor"/></svg>',
  deposit: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v12l4-4"/></svg>',
  withdraw: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 22V10l-4 4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>',
  game: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6 12v6h12v-6"/><path d="M12 6v6"/></svg>',
  default: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/></svg>'
};

function chooseIconKey(title) {
  if (!title) return 'default';
  const t = title.toLowerCase();
  if (t.includes('dashboard') || t.includes('bảng')) return 'dashboard';
  if (t.includes('thành viên') || t.includes('user') || t.includes('người')) return 'users';
  if (t.includes('nạp') || t.includes('deposit')) return 'deposit';
  if (t.includes('rút') || t.includes('withdraw')) return 'withdraw';
  if (t.includes('số dư') || t.includes('balance') || t.includes('wallet')) return 'wallet';
  if (t.includes('cài đặt') || t.includes('setting')) return 'settings';
  if (t.includes('game') || t.includes('trò') || t.includes('plinko') || t.includes('tx')) return 'game';
  return 'default';
}

function injectIcon(h1) {
  if (!h1) return;
  if (h1.querySelector('.page-icon')) return; // already inserted
  const text = h1.textContent || '';
  const key = chooseIconKey(text);
  const wrapper = document.createElement('span');
  wrapper.className = 'page-icon icon-animate';
  wrapper.innerHTML = ICON_SVGS[key] || ICON_SVGS.default;
  h1.prepend(wrapper);
  // add small hover hint for focusable titles
  h1.style.transition = 'transform 180ms ease';
  h1.addEventListener('mouseover', () => { h1.style.transform = 'translateY(-2px)'; });
  h1.addEventListener('mouseout', () => { h1.style.transform = 'translateY(0)'; });
}

function scanAndInject(root = document) {
  const containers = root.querySelectorAll('.dashboard-content h1, .content-inner h1, .settings-container h1');
  containers.forEach(injectIcon);
}

// Observe for SPA changes inside dashboard content
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.addedNodes && m.addedNodes.length) scanAndInject(m.target);
  }
  // also attempt general scan (cheap)
  scanAndInject(document);
});

window.addEventListener('load', () => {
  scanAndInject(document);
  const content = document.querySelector('.dashboard-content') || document;
  observer.observe(content, { childList: true, subtree: true });
});

export {};
