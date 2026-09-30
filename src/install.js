export function setupInstall(notice) {
  const buttons = [...document.querySelectorAll('[data-install]')];
  const dialog = document.querySelector('#install-dialog');
  const standalone = matchMedia('(display-mode: standalone)');
  let promptEvent = null;
  let installed = standalone.matches || navigator.standalone === true;
  let prompting = false;

  function update() {
    buttons.forEach(button => { button.hidden = installed; });
  }
  function showInstructions() {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const text = ios
      ? 'On iPhone or iPad, open this page in Safari, tap Share, then Add to Home Screen. Enable Open as Web App if offered, then tap Add.'
      : /Android/.test(ua)
        ? 'On Android, open the browser menu and choose Install app or Add to Home screen. If this browser does not offer installation, open the page in Chrome.'
        : /Mac/.test(navigator.platform)
          ? 'On macOS, use Safari’s File → Add to Dock where available, or open this page in Chrome or Edge and use the install option in the address bar or browser menu.'
          : 'On Windows or Linux, open this page in Chrome or Edge and use the install option in the address bar or browser menu.';
    document.querySelector('#install-instructions').textContent = text;
    if (!dialog.open) dialog.showModal();
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event;
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    promptEvent = null;
    dialog.close();
    update();
    notice('PGPWA installed. Open it from your device’s apps.');
  });
  standalone.addEventListener('change', () => {
    installed = standalone.matches || navigator.standalone === true;
    update();
  });
  document.querySelector('#close-install').onclick = () => dialog.close();
  buttons.forEach(button => {
    button.onclick = async () => {
      if (installed || prompting) return;
      if (!promptEvent) { showInstructions(); return; }
      const event = promptEvent;
      promptEvent = null; // Browser install prompts are single-use.
      prompting = true;
      try {
        await event.prompt();
        const choice = await event.userChoice;
        notice(choice.outcome === 'accepted'
          ? 'Installation requested. Your browser will complete the installation.'
          : 'Installation dismissed. You can install later from the browser menu.');
      } catch {
        showInstructions();
      } finally { prompting = false; }
    };
  });
  update();
}
