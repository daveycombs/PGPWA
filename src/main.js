import './style.css';
import { setupInstall } from './install.js';
import * as crypto from './crypto.js';
import * as fileOperations from './file-operations.js';
import { listKeys, saveKey, deleteKey } from './store.js';

const $ = selector => document.querySelector(selector);
const el = (tag, text, className) => { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; };
let keys = [], mode = 'encrypt', output = null, busy = false, generation = 0;
const names = { encrypt: 'Encrypt', decrypt: 'Decrypt', sign: 'Sign', verify: 'Verify' };
$('#app').innerHTML = `
<aside class="sidebar">
  <a class="brand" href="./"><img src="./icon.svg" alt="" />PGPWA</a>
  <div class="nav-label">WORKSPACE</div>
  <nav aria-label="Main"><button class="nav active" data-page="workspace"><span>◈</span> Messages & files</button><button class="nav" data-page="keys"><span>⚿</span> Keyring <span id="key-count" class="count">0</span></button><button class="nav" data-page="about"><span>ⓘ</span> About & install</button></nav>
  <div class="local-note"><span class="dot"></span> Local storage<p>Keys are stored in this browser.<br>Messages are processed on this device.</p><small id="offline-state">Preparing offline access…</small></div>
</aside>
<main>
  <header><button data-install class="secondary" type="button">Install as PWA</button><button id="theme-toggle" class="secondary" type="button" aria-pressed="false">Dark mode</button><button id="clear" class="quiet">Clear session</button></header>
  <section id="workspace" class="page">
    <div class="heading"><div><h1>Messages & files</h1><p>Encrypt, decrypt, sign, or verify text and files using OpenPGP.</p></div><span class="pill">Processed on this device</span></div>
    <div class="tabs" role="tablist" aria-label="Operation">${Object.entries(names).map(([key, label]) => `<button role="tab" aria-selected="${key === mode}" data-mode="${key}">${label}</button>`).join('')}</div>
    <div class="workspace-grid">
      <form id="operation" class="card">
        <div class="card-top"><h2 id="operation-title">Encrypt message</h2><span class="step">01 / INPUT</span></div>
        <fieldset class="input-switch"><legend class="sr-only">Input type</legend><label><input type="radio" name="input-type" value="text" checked /> Text</label><label><input type="radio" name="input-type" value="file" /> File</label></fieldset>
        <div id="text-input"><label for="message">Message</label><textarea id="message" spellcheck="false" placeholder="Enter the message to encrypt or sign…"></textarea></div>
        <div id="file-input" hidden><label for="file">Choose a file</label><input type="file" id="file" /><label class="check"><input id="large-files" type="checkbox" /> Allow larger files (up to 100 MB)</label><p class="hint">Default: 20 MB. Larger-file mode uses binary .pgp encryption and accepts encrypted input up to 140 MB. Files still occupy memory; use a desktop for larger files. Clear session cancels processing.</p></div>
        <div id="signature-input" hidden><label for="signature">Detached signature (.asc)</label><textarea id="signature" spellcheck="false" placeholder="Paste the armored signature…"></textarea><input id="signature-file" type="file" aria-label="Load detached signature" /></div>
        <div id="recipient-field"><div class="label-row"><label>To</label><button type="button" class="text-button" id="add-recipient">+ Import public key</button></div><div id="recipients" class="recipients"></div><p class="hint">Check fingerprints with your recipient. Select your own key too if you want to decrypt a copy.</p></div>
        <label id="sign-option" class="check"><input id="also-sign" type="checkbox" /> Sign with my private key</label>
        <div id="identity-field" hidden><label for="identity">Your private key</label><select id="identity"></select><label for="passphrase">Key passphrase</label><input type="password" id="passphrase" autocomplete="off" placeholder="Used for this operation only" /></div>
        <p id="verify-hint" class="hint" hidden>Import the sender’s public key into your keyring first. A valid signature proves key ownership, not a person’s identity.</p>
        <button id="run" class="primary" type="submit">Encrypt message <span>↗</span></button>
      </form>
      <section class="card result-card"><div class="card-top"><h2>Result</h2><span class="step">02 / OUTPUT</span></div><div id="empty-result"><h3>No output yet</h3><p>Run an operation to view, copy, or download its result.</p></div><div id="result-content" hidden><p id="signature-status"></p><textarea id="result" readonly spellcheck="false" aria-label="Result"></textarea><div class="actions"><button id="copy" class="secondary">Copy text</button><button id="download" class="secondary">Download</button></div></div><div class="result-foot">Output is kept in memory until the session is cleared.</div></section>
    </div>
    <p class="bottom-note">SESSION DATA <span>Messages and passphrases are never saved. Clear the session when you’re done.</span></p>
  </section>
  <section id="keys" class="page" hidden><div class="heading"><div><h1>Keyring</h1><p>Import, create, export, and remove public and private keys.</p></div><button id="new-key" class="primary">+ Create a key</button></div><div class="card"><h2>Import a key</h2><p class="hint">Paste an armored public or private key, or choose a key file. Multiple keys are supported.</p><form id="import-form"><label for="import-title">Title (optional)</label><input id="import-title" type="text" maxlength="120" placeholder="e.g. Work key or Alex" /><p class="hint">A local label; it does not change the key. For multiple keys, the title applies to each. Leave blank to keep existing titles.</p><label for="key-text">PGP key</label><textarea id="key-text" spellcheck="false" placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"></textarea><input id="key-file" type="file" aria-label="Import key file" /><label for="protect-pass">Protect an unencrypted private key</label><input id="protect-pass" type="password" autocomplete="new-password" placeholder="New passphrase, at least 12 characters (only if needed)" /><button class="primary" type="submit">Import into keyring</button></form></div><div id="key-list"></div></section>
  <section id="about" class="page" hidden><h1>About & installation</h1><div class="card prose"><h2>Offline, after the first visit</h2><p>Wait for “Ready for offline use” before disconnecting. The app and cryptography library are stored together on your device. No analytics, remote fonts, keyservers, or cloud accounts.</p><h2>Install on your devices</h2><p>iPhone / iPad: open in Safari, tap Share, then Add to Home Screen. Android: use your browser’s Install app or Add to Home screen menu. Windows, macOS, and Linux: use Install in Chrome or Edge; on supported macOS versions, Safari offers Add to Dock. Firefox can run the app in a browser tab.</p><button id="install" data-install class="secondary" type="button">Install as PWA</button><h2>Keep a backup</h2><p>Browser storage can be cleared or evicted. Export your protected private key and store its passphrase separately. New keys expire after two years. Download the revocation certificate when creating a key and keep it safe: anyone with it can revoke your key.</p><h2>What this protects</h2><p>Messages are encrypted with OpenPGP.js. Private keys are saved only with passphrase protection. Plaintext and passphrases are held temporarily in memory, then cleared after 30 seconds in the background or five minutes of inactivity. JavaScript cannot guarantee memory erasure.</p><p>Contact names and public keys are stored unencrypted. A compromised device, browser extension, or hosting server can compromise this app. This app has not had an independent security audit. Confirm full key fingerprints through another trusted channel.</p><h2>Supported operations</h2><p>Text and files, multiple recipients, signed encryption, cleartext signatures, detached file signatures, key import/export, and key generation. No email integration or automatic key discovery. Manage certifications, expiration changes, and revocation publishing in a full OpenPGP tool.</p></div></section>
  <div id="notice" role="status" aria-live="polite" hidden></div>
</main>
<dialog id="install-dialog" aria-labelledby="install-title"><div class="card-top"><h2 id="install-title">Install PGPWA</h2><button id="close-install" type="button" class="quiet" aria-label="Close installation instructions">✕</button></div><p id="install-instructions"></p><p class="hint">If you are viewing this inside another app, open the same address in your regular browser. Installation options depend on your browser and device. If already installed, open PGPWA from your apps.</p><p class="hint">Wait for “Ready for offline use” before disconnecting. Installing does not back up or sync your keys.</p></dialog>
<dialog id="generate-dialog"><form id="generate-form"><div class="card-top"><h2>Create your key</h2><button type="button" id="close-dialog" class="quiet" aria-label="Close">✕</button></div><p class="hint">New keys expire after two years. Back up your private key after creating it.</p><label for="key-name">Name</label><input id="key-name" required autocomplete="off" /><label for="key-email">Email (optional)</label><input id="key-email" type="email" autocomplete="off" /><label for="algorithm">Key type</label><select id="algorithm"><option value="ecc">Curve25519 — fast & compact</option><option value="rsa">RSA 4096 — wider legacy compatibility</option></select><label for="new-pass">Passphrase</label><input id="new-pass" type="password" minlength="12" required autocomplete="new-password" /><label for="confirm-pass">Confirm passphrase</label><input id="confirm-pass" type="password" required autocomplete="new-password" /><button type="submit" class="primary">Create protected key</button></form><div id="revocation-box" hidden><h3>Save your recovery materials</h3><p>Export the private key from your keyring. Save this revocation certificate before closing this dialog.</p><button id="save-revocation" class="secondary">Download revocation certificate</button></div></dialog>`;

function notice(text, error = false) { $('#notice').textContent = text; $('#notice').className = error ? 'error' : ''; $('#notice').hidden = false; }
function page(id) { document.querySelectorAll('.page').forEach(n => n.hidden = n.id !== id); document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.page === id)); }
function resetOutput() { output = null; $('#result').value = ''; $('#signature-status').textContent = ''; $('#result-content').hidden = true; $('#empty-result').hidden = false; }
function clearSession(show = true) { generation++; fileOperations.cancelFileOperation(); document.querySelectorAll('textarea, input[type="password"], input[type="file"]').forEach(n => n.value = ''); resetOutput(); if ($('#generate-dialog').open) $('#generate-dialog').close(); revocation = null; if (show) notice('Session cleared. Your saved keys remain in the keyring.'); }
function updateMode() {
  resetOutput();
  const file = $('input[name="input-type"]:checked').value === 'file';
  $('#text-input').hidden = file; $('#file-input').hidden = !file;
  $('#recipient-field').hidden = mode !== 'encrypt'; $('#sign-option').hidden = mode !== 'encrypt';
  $('#identity-field').hidden = !(mode === 'decrypt' || mode === 'sign' || (mode === 'encrypt' && $('#also-sign').checked));
  $('#verify-hint').hidden = mode !== 'verify'; $('#signature-input').hidden = !(mode === 'verify' && file);
  $('#operation-title').textContent = `${names[mode]} ${file ? 'file' : 'message'}`;
  $('#run').textContent = `${names[mode]} ${file ? 'file' : 'message'} ↗`;
  $('#message').placeholder = mode === 'decrypt' ? 'Paste a PGP encrypted message…' : mode === 'verify' ? 'Paste a PGP signed message…' : 'Enter the message to encrypt or sign…';
  document.querySelectorAll('[data-mode]').forEach(n => n.setAttribute('aria-selected', String(n.dataset.mode === mode)));
}
function download(data, name) { const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' })); const a = el('a', ''); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
async function refreshKeys() {
  keys = await listKeys(); $('#key-count').textContent = keys.length;
  $('#recipients').replaceChildren(); $('#identity').replaceChildren(new Option('Choose your private key…', '')); $('#key-list').replaceChildren();
  if (!keys.length) $('#recipients').append(el('p', 'No keys yet. Import a recipient’s public key to get started.', 'hint'));
  for (const key of keys) {
    const identity = key.users.join(', ') || 'Unnamed key';
    const name = key.title || identity;
    const label = el('label', '', 'recipient'); const check = document.createElement('input'); check.type = 'checkbox'; check.value = key.id;
    const detail = el('span', name); if (key.title) detail.append(el('small', identity)); detail.append(el('small', key.id.toUpperCase().match(/.{1,4}/g).join(' '))); label.append(check, detail); $('#recipients').append(label);
    if (key.privateKey) $('#identity').append(new Option(key.title ? `${name} — ${identity}` : name, key.id));
    const card = el('article', '', 'card key-card'); card.append(el('span', key.privateKey ? 'PRIVATE KEY · PROTECTED' : 'PUBLIC KEY', 'eyebrow'), el('h2', name), el('p', key.id.toUpperCase().match(/.{1,4}/g).join(' '), 'fingerprint'), el('p', `${key.algorithm} · Created ${new Date(key.created).toLocaleDateString()}`, 'hint'));
    if (key.title) card.insertBefore(el('p', identity, 'hint'), card.querySelector('.fingerprint'));
    const titleForm = el('form', '', 'key-title-form');
    const titleLabel = el('label', 'Title (optional)');
    const titleInput = document.createElement('input');
    titleInput.type = 'text'; titleInput.maxLength = 120; titleInput.value = key.title || '';
    titleInput.id = `title-${key.id}`; titleLabel.htmlFor = titleInput.id;
    titleInput.placeholder = 'e.g. Work key or Alex';
    const saveTitle = el('button', 'Save title', 'secondary'); saveTitle.type = 'submit';
    titleForm.append(titleLabel, titleInput, saveTitle);
    titleForm.onsubmit = event => { event.preventDefault(); guarded(async () => {
      await saveKey({ ...key, title: titleInput.value });
      await refreshKeys(); notice('Key title saved on this device.');
    }); };
    card.append(titleForm);
    const actions = el('div', '', 'actions');
    for (const [title, action] of [ ['Export public', () => download(key.publicKey, `${key.id}-public.asc`)], ...(key.privateKey ? [['Backup private', () => download(key.privateKey, `${key.id}-private.asc`)]] : []), ['Remove', async () => { if (confirm('Remove this key from this device? Make sure you have a private-key backup.')) { await deleteKey(key.id); await refreshKeys(); } }] ]) {
      const button = el('button', title, 'secondary'); button.onclick = () => Promise.resolve(action()).catch(e => notice(e.message, true)); actions.append(button);
    }
    card.append(actions); $('#key-list').append(card);
  }
}
async function limitedFile(file, limit = crypto.MAX_FILE_SIZE) { if (!file) throw new Error('Choose a file first.'); if (file.size > limit) throw new Error(`File exceeds the ${limit / 1024 / 1024} MB limit. Enable larger files for files over 20 MB, or choose a smaller file.`); return new Uint8Array(await file.arrayBuffer()); }
async function guarded(action) {
  if (busy) return; busy = true; $('#notice').hidden = true;
  const buttons = [...document.querySelectorAll('button:not(#clear)')]; buttons.forEach(b => b.disabled = true);
  try { await action(); } catch (e) { notice(e.message || 'The operation failed.', true); }
  finally { busy = false; buttons.forEach(b => b.disabled = false); $('#passphrase').value = ''; $('#protect-pass').value = ''; $('#new-pass').value = ''; $('#confirm-pass').value = ''; }
}
document.querySelectorAll('[data-page]').forEach(n => n.onclick = () => page(n.dataset.page));
document.querySelectorAll('[data-mode]').forEach(n => n.onclick = () => { mode = n.dataset.mode; $('#passphrase').value = ''; updateMode(); });
document.querySelectorAll('[name="input-type"], #also-sign').forEach(n => n.onchange = updateMode);
$('#add-recipient').onclick = () => { page('keys'); $('#key-text').focus(); };
$('#clear').onclick = () => clearSession();
$('#operation').onsubmit = event => { event.preventDefault(); guarded(async () => {
  resetOutput(); const token = generation;
  const fileMode = $('input[name="input-type"]:checked').value === 'file'; const file = $('#file').files[0];
  const largeFiles = fileMode && $('#large-files').checked;
  const limit = largeFiles ? (mode === 'decrypt' ? 140 * 1024 * 1024 : crypto.LARGE_FILE_SIZE) : crypto.MAX_FILE_SIZE;
  let data = fileMode ? await limitedFile(file, limit) : $('#message').value;
  if (token !== generation) return;
  const processor = fileMode ? fileOperations : crypto;
  if (fileMode) notice('Processing file… Clear session to cancel.');
  if (!fileMode && !data.trim()) throw new Error('Enter a message first.');
  if (!fileMode && new TextEncoder().encode(data).length > crypto.MAX_FILE_SIZE) throw new Error('Message is too large. Maximum size is 20 MB.');
  const identity = keys.find(k => k.id === $('#identity').value);
  const args = { data, largeFiles, binaryOutput: largeFiles, filename: file?.name, passphrase: $('#passphrase').value, identity, contacts: keys };
  $('#passphrase').value = '';
  let result, status, filename;
  if (mode === 'encrypt') { if ($('#also-sign').checked && !identity) throw new Error('Choose your signing key.'); result = await processor.encrypt({ ...args, recipients: keys.filter(k => [...document.querySelectorAll('#recipients input:checked')].some(n => n.value === k.id)), signer: $('#also-sign').checked ? identity : null }); filename = fileMode ? `${file.name}.${largeFiles ? 'pgp' : 'asc'}` : 'message.asc'; }
  if (mode === 'decrypt') {
    if (fileMode) { const prefix = new TextDecoder().decode(data.subarray(0, 256)); if (prefix.trimStart().startsWith('-----BEGIN PGP MESSAGE-----')) args.data = new TextDecoder().decode(data); }
    ({ data: result, status } = await processor.decrypt({ ...args, binary: fileMode })); filename = fileMode ? file.name.replace(/\.(asc|pgp|gpg)$/i, '') + '.decrypted' : 'decrypted.txt';
  }
  if (mode === 'sign') { result = await processor.sign(args); filename = fileMode ? `${file.name}.sig.asc` : 'signed.asc'; }
  if (mode === 'verify') { ({ data: result, status } = await processor.verify({ ...args, signature: $('#signature').value })); filename = fileMode ? `${file.name}.copy` : 'message.txt'; }
  if (token !== generation) return;
  output = { data: result, filename }; $('#result').value = typeof result === 'string' ? result : `${result.length.toLocaleString()} bytes ready to download.\n\nBinary content is not displayed.`;
  $('#signature-status').textContent = status?.text || ''; $('#signature-status').className = status?.kind || '';
  $('#copy').hidden = typeof result !== 'string'; $('#result-content').hidden = false; $('#empty-result').hidden = true;
  notice(status?.kind === 'unverified' ? 'Completed, but the signature could not be verified.' : 'Operation completed.', status?.kind === 'unverified');
}); };
$('#copy').onclick = async () => { try { await navigator.clipboard.writeText(output.data); notice('Copied. Your system clipboard now contains this text.'); } catch { notice('Clipboard unavailable. Select and copy the result manually.', true); } };
$('#download').onclick = () => output && download(output.data, output.filename);
$('#signature-file').onchange = async () => { try { $('#signature').value = new TextDecoder().decode(await limitedFile($('#signature-file').files[0])); } catch(e) { notice(e.message, true); } };
$('#import-form').onsubmit = event => { event.preventDefault(); guarded(async () => {
  const file = $('#key-file').files[0]; let input = file ? await limitedFile(file) : $('#key-text').value;
  if (file) { const text = new TextDecoder().decode(input); if (text.trimStart().startsWith('-----BEGIN')) input = text; }
  const records = await crypto.importKeys(input, $('#protect-pass').value);
  const title = $('#import-title').value.trim();
  for (const record of records) await saveKey({ ...record, ...(title ? { title } : {}) });
  $('#key-text').value = ''; $('#key-file').value = ''; $('#import-title').value = ''; await refreshKeys(); notice(`${records.length} key(s) imported. Verify fingerprints before use.`);
}); };
let revocation = null;
$('#new-key').onclick = () => { $('#generate-form').reset(); $('#revocation-box').hidden = true; revocation = null; $('#generate-dialog').showModal(); };
$('#close-dialog').onclick = () => $('#generate-dialog').close();
$('#generate-dialog').onclose = () => { revocation = null; $('#new-pass').value = ''; $('#confirm-pass').value = ''; };
$('#generate-form').onsubmit = event => { event.preventDefault(); guarded(async () => {
  if ($('#new-pass').value !== $('#confirm-pass').value) throw new Error('The passphrases do not match.');
  const token = generation;
  const result = await crypto.generateIdentity({ name: $('#key-name').value, email: $('#key-email').value, passphrase: $('#new-pass').value, algorithm: $('#algorithm').value });
  if (token !== generation) return;
  const [key] = await crypto.importKeys(result.privateKey); await saveKey(key); revocation = result.revocationCertificate;
  await refreshKeys(); $('#revocation-box').hidden = false; notice('Key created. Save your private key and revocation certificate.');
}); };
$('#save-revocation').onclick = () => revocation && download(revocation, 'revocation-certificate.asc');
let idleTimer;
function activity() { clearTimeout(idleTimer); idleTimer = setTimeout(() => clearSession(), 5 * 60 * 1000); }
['pointerdown', 'keydown'].forEach(type => document.addEventListener(type, activity)); activity();
// A short grace period lets mobile system file pickers return without losing
// the other file in a detached-signature operation.
let backgroundTimer;
document.addEventListener('visibilitychange', () => {
  clearTimeout(backgroundTimer);
  if (document.hidden) backgroundTimer = setTimeout(() => clearSession(false), 30000);
});
setupInstall(notice);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').then(async () => { await navigator.serviceWorker.ready; $('#offline-state').textContent = 'Ready for offline use'; }).catch(() => { $('#offline-state').textContent = 'Offline setup failed. Reopen online to retry.'; });
} else $('#offline-state').textContent = 'Development mode · offline cache disabled';
if (!window.isSecureContext) notice('Use HTTPS or localhost. Cryptography and offline installation require a secure context.', true);
refreshKeys().catch(e => notice(e.message, true));

