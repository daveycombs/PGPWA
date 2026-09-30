# PGPWA

PGPWA is an offline-capable web app for OpenPGP encryption, decryption, signing, and key management. The name combines PGP and PWA (Progressive Web App).

Cryptographic operations run in the browser using [OpenPGP.js](https://github.com/openpgpjs/openpgpjs). There is no backend, account system, analytics, or automatic key lookup. Once the app is cached, it can run without a network connection.

## Features

- Encrypt text and files for one or more recipients, with optional signing.
- Decrypt messages and files using an imported private key.
- Sign and verify text; create and verify detached file signatures.
- Import armored or binary public and private keys, including files containing multiple keys.
- Generate Curve25519 or RSA-4096 keys with passphrase protection and two-year expiration.
- Export public keys, back up protected private keys, and download a revocation certificate when creating a key.
- View fingerprints and remove keys from local storage.
- Switch between light and dark mode. The initial theme follows the system setting; manual changes are saved on the device.

File input defaults to 20 MB. Under **File**, enable **Allow larger files** for inputs up to 100 MB. In this mode, encryption produces binary `.pgp` files; decryption accepts inputs up to 140 MB to allow for armored or encrypted overhead. Decompressed messages are capped at 25 MB by default and 125 MB for larger-file operations. Key and detached-signature imports retain their 20 MB limit.

File operations run in a background worker. **Clear session** cancels processing. Files and output are still buffered in memory, so this is not streaming-to-disk support. Larger files can require several times their size in memory; use a desktop browser when possible. The larger-file option is not saved across reloads.

## Run locally

Use Node.js 22.12 or later and npm. From the project directory, run:

```sh
npm ci
npm run dev
```

Open the URL printed in the terminal. These commands work in PowerShell on Windows 11 as well as macOS and Linux terminals.

Development mode does not enable offline caching. To test the production app:

```sh
npm run build
npm run preview
```

Open the preview URL, normally `http://127.0.0.1:4173`, and wait for **Ready for offline use**. Disconnect and reload to check offline operation. If the port is occupied, Vite prints a different URL.

## Usage

### Import or create keys

Open **Keyring** to paste a key or select a key file. You can add an optional title to identify the key in your keyring and selectors. Titles are local labels: they do not change the OpenPGP identity or exported key. Edit or clear a title using **Save title** on the key card. A title entered during a multi-key import applies to every imported key; leaving it blank preserves existing titles. An unprotected private key must be given a passphrase of at least 12 characters before it can be saved. Already-protected keys retain their existing passphrase.

Use **Create a key** if you need a new identity. Back up the private key and download its revocation certificate before closing the dialog. Keep the passphrase separately. The app does not retain the revocation certificate.

### Encrypt and decrypt

1. Import the recipient's public key and confirm its full fingerprint through a trusted channel.
2. Select **Encrypt**, enter text or choose a file, and select the recipients. Include your own public key if you want to decrypt a copy later.
3. Optionally enable signing and select your private key. Run the operation, then copy or download the output.

To decrypt, select **Decrypt**, provide the encrypted text or file, and choose your private key. Enter its passphrase and run the operation. Import the sender's public key if you also want to verify a signature.

### Sign and verify

**Sign** produces a cleartext signature for text or a separate armored signature for a file. File signatures must be shared alongside the original file.

For **Verify**, import the signer's public key first. Paste signed text, or select the original file and provide its detached signature. Check the verification result before trusting the sender. Successful decryption alone does not verify a signature or identity.

## Installation and browser support

Select **Install as PWA** in the top bar or **About & install**. Where supported, this opens the browser’s install prompt. Otherwise, it shows instructions for your device. In an embedded browser, open the app in a regular browser first. The button is hidden when running as an installed app or after the browser reports installation.

PGPWA targets current browsers with Web Crypto, IndexedDB, and service worker support.

| Platform | Installation |
| --- | --- |
| iOS / iPadOS | Open in Safari, then use Share → Add to Home Screen. |
| Android | Use the browser's Install app or Add to Home screen option. |
| Windows / Linux | Use the install option in Chrome or Edge, or run in a browser tab. |
| macOS | Use Chrome or Edge installation, or Safari's Add to Dock where available. |

Firefox can run the app in a browser tab. Installation options depend on the browser and operating system. Automated browser checks run in Edge on Windows; physical-device testing across all listed platforms is still needed.

## Storage and security

| Data | Storage |
| --- | --- |
| Public keys, names, fingerprints, local titles | IndexedDB, unencrypted |
| Private keys | IndexedDB, as passphrase-protected OpenPGP keys |
| Messages, selected files, output, passphrases | Temporary session memory; not intentionally persisted |
| Theme preference | Local storage |
| App files and cryptography library | Service worker cache |

**Clear session** removes temporary fields and output while keeping saved keys. The app also schedules clearing after five minutes of inactivity or 30 seconds in the background. Background timers can be delayed by the browser. JavaScript cannot guarantee memory erasure.

Browser storage can be deleted or evicted. Export key backups before clearing site data, changing browsers, or moving the app to another address. Keys are not synced between devices. Clipboard contents and downloaded files remain outside the app's control; decrypted downloads are unencrypted.

PGPWA has not had an independent security audit. It cannot protect against a compromised device, malicious browser extension, or compromised hosting server. Verify fingerprints separately and use a strong passphrase. File cryptography runs in a worker, but memory limits still depend on the device and browser. Text operations and key generation run on the main thread; RSA key generation can temporarily pause the interface.

Key certification, expiration changes, email integration, and publishing revocations are outside the app's scope. Use a full OpenPGP tool for those tasks.

## Deployment

Run `npm ci` followed by `npm run build`, then publish the contents of `dist/` to an HTTPS static host. No server-side runtime is required. The preview server is for local testing only.

The build uses relative asset paths, so it can be served from a subdirectory, including a GitHub Pages project path. If using a deployment workflow, build the app first and upload `dist/` as the site artifact. The repository's source files alone are not the built website.

HTTPS is required outside localhost. Opening `index.html` directly or serving over plain HTTP on a LAN does not provide the secure context required for cryptography and offline installation.

The HTML includes a restrictive Content Security Policy. Where the host supports custom response headers, also configure:

- `Content-Security-Policy` with `frame-ancestors 'none'`, in addition to the existing policy.
- `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
- HTTPS/HSTS and revalidation for HTML and `sw.js`.

A dedicated origin is preferable for a key-management app. GitHub Pages project sites under the same hostname share an origin; a URL subdirectory is not a storage or security boundary.

Service worker updates wait until all tabs and installed windows using the previous version close. Reopen while online to receive an update. If an old interface remains visible, close all app windows and reopen. Export private keys before clearing site data as a troubleshooting step.

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build the app and offline cache manifest |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run cryptography tests |
| `npm run test:e2e` | Run browser tests against a production build |
| `npm audit` | Check dependencies for reported vulnerabilities |

Run `npm run build` before the browser tests. They use locally installed Microsoft Edge by default. To use Playwright's Chromium elsewhere, remove `channel: 'msedge'` from `playwright.config.js` and run `npx playwright install chromium`.

Tests cover encryption round trips, multiple recipients, wrong keys and passphrases, tampered signatures, binary integrity, private-key protection, revoked and expired keys, offline reloads, key persistence, themes, and responsive layouts.

### Project layout

```text
src/main.js             Interface and session handling
src/crypto.js           OpenPGP operations and input limits
src/file-worker.js      Background file cryptography
src/file-operations.js  Worker lifecycle and cancellation
src/store.js            Local key storage
src/style.css           Responsive layout and themes
public/theme.js         Theme initialization and saved preference
public/                 App icons, manifest, and library notice
tests/                  Cryptography and browser tests
vite.config.js          Build and service worker generation
```

The legacy IndexedDB name is retained so existing users keep their saved keys after the PGPWA rename.

For contributions, include a description of the change and relevant test results. Use generated test keys and sample messages; do not commit real private keys, passphrases, or personal data.

## Dependencies

[OpenPGP.js](https://docs.openpgpjs.org/) supplies the cryptographic implementation and is licensed under LGPL-3.0. Its license notice is included in `public/OPENPGP-LICENSE.txt` and copied into production builds. Vite builds the app; Playwright runs browser tests.

