// Auto-apply `numeric-large` class to numeric UI elements for better contrast
function isNumericText(s) {
  if (!s) return false;
  const t = s.trim();
  // allow numbers with commas, dots, spaces, currency symbols, plus/minus
  return /^[+\-\s]*[₫$€£]?\s*[0-9][0-9,\.\s]*$/.test(t);
}

function enhanceOnce(root = document) {
  try {
    const selectors = [
      '.stat-card .stat-value',
      '.stat-value',
      '.big-number',
      '.balance-value',
      '.numeric-large',
      'td .font-mono',
      '.count',
      '.stat-number',
      '.stat-count',
      '.stat .value'
    ];

    selectors.forEach(sel => {
      root.querySelectorAll(sel).forEach(el => {
        if (!el.classList.contains('numeric-large')) el.classList.add('numeric-large');
      });
    });

    // Find table cells or divs that contain pure numeric text and mark them
    root.querySelectorAll('td, span, div, p').forEach(el => {
      if (el.classList && el.classList.contains('numeric-large')) return;
      if (el.children && el.children.length > 0) return; // skip containers
      const text = el.textContent || '';
      if (isNumericText(text) && text.trim().length > 0 && text.trim().length < 40) {
        el.classList.add('numeric-large');
      }
    });
  } catch (e) {
    // ignore
  }
}

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.addedNodes && m.addedNodes.length) {
      enhanceOnce(m.target || document);
    }
  }
  enhanceOnce(document);
});

window.addEventListener('load', () => {
  enhanceOnce(document);
  const content = document.querySelector('.dashboard-content') || document.body;
  observer.observe(content, { childList: true, subtree: true });
});

export {};
