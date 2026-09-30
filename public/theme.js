// Apply before the page renders. Only the display preference is persisted here.
(() => {
  const preferenceKey = 'pgpwa-theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem(preferenceKey); } catch { /* Storage may be disabled. */ }
  if (preference !== 'dark' && preference !== 'light') preference = null;

  function applyTheme() {
    const dark = preference ? preference === 'dark' : systemTheme.matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#141c19' : '#183e36';
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.setAttribute('aria-pressed', String(dark));
  }

  applyTheme();
  document.addEventListener('DOMContentLoaded', applyTheme);
  systemTheme.addEventListener('change', () => { if (!preference) applyTheme(); });
  document.addEventListener('click', event => {
    if (!event.target.closest('#theme-toggle')) return;
    preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(preferenceKey, preference); } catch { /* Keep the choice for this visit. */ }
    applyTheme();
  });
})();
