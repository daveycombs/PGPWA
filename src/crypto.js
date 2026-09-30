import * as pgp from 'openpgp';

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const LARGE_FILE_SIZE = 100 * 1024 * 1024;
// Bound decompression as well as input size for untrusted encrypted files.
pgp.config.maxDecompressedMessageSize = 25 * 1024 * 1024;
export async function importKeys(input, protection = '') {
  const keys = await pgp.readKeys(typeof input === 'string' ? { armoredKeys: input } : { binaryKeys: input });
  if (!keys.length) throw new Error('No OpenPGP keys found.');
  return Promise.all(keys.map(async original => {
    let key = original;
    if (key.isPrivate() && key.isDecrypted()) {
      if (protection.length < 12) throw new Error('This private key is unprotected. Enter a new passphrase of at least 12 characters before importing.');
      key = await pgp.encryptKey({ privateKey: key, passphrase: protection });
    }
    return {
      id: key.getFingerprint(), users: key.getUserIDs(),
      publicKey: key.toPublic().armor(), privateKey: key.isPrivate() ? key.armor() : null,
      created: key.getCreationTime().toISOString(),
      algorithm: key.getAlgorithmInfo().algorithm
    };
  }));
}
export async function generateIdentity({ name, email, passphrase, algorithm = 'ecc' }) {
  if (passphrase.length < 12) throw new Error('Use a passphrase of at least 12 characters.');
  if (!name.trim()) throw new Error('Enter a name for this key.');
  return pgp.generateKey({
    type: algorithm, ...(algorithm === 'rsa' ? { rsaBits: 4096 } : { curve: 'curve25519Legacy' }),
    userIDs: [{ name: name.trim(), ...(email.trim() ? { email: email.trim() } : {}) }],
    passphrase, keyExpirationTime: 2 * 365 * 24 * 60 * 60,
    format: 'armored'
  });
}
async function unlock(armoredKey, passphrase) {
  if (!armoredKey) throw new Error('Choose a private key first.');
  const key = await pgp.readPrivateKey({ armoredKey });
  return key.isDecrypted() ? key : pgp.decryptKey({ privateKey: key, passphrase });
}
const publicKeys = records => Promise.all(records.map(r => pgp.readKey({ armoredKey: r.publicKey })));
const message = (data, filename) => typeof data === 'string' ? pgp.createMessage({ text: data }) : pgp.createMessage({ binary: data, filename });
async function signatureStatus(signatures) {
  if (!signatures.length) return { kind: 'unsigned', text: 'Not signed. Sender identity is not verified.' };
  const checks = await Promise.all(signatures.map(async s => {
    try { await s.verified; return `Valid signature · ${s.keyID.toHex()}`; }
    catch { return null; }
  }));
  return checks.every(Boolean)
    ? { kind: 'valid', text: checks.join('\n') + '\nConfirm the signer’s full fingerprint through a trusted channel.' }
    : { kind: 'unverified', text: 'Signature not verified: a signing key is missing, the signature is invalid, or the key is expired/revoked. Do not trust the sender identity.' };
}
export async function encrypt({ data, filename, recipients, signer, passphrase, binaryOutput = false }) {
  if (!recipients.length) throw new Error('Choose at least one recipient.');
  return pgp.encrypt({ message: await message(data, filename), encryptionKeys: await publicKeys(recipients),
    ...(signer ? { signingKeys: await unlock(signer.privateKey, passphrase) } : {}), format: binaryOutput ? 'binary' : 'armored' });
}
export async function decrypt({ data, identity, passphrase, contacts, binary = false, largeFiles = false }) {
  const config = { maxDecompressedMessageSize: (largeFiles ? 125 : 25) * 1024 * 1024 };
  const msg = await pgp.readMessage({ ...(typeof data === 'string' ? { armoredMessage: data } : { binaryMessage: data }), config });
  const result = await pgp.decrypt({ message: msg, decryptionKeys: await unlock(identity?.privateKey, passphrase),
    verificationKeys: await publicKeys(contacts), format: binary ? 'binary' : 'utf8', config });
  return { data: result.data, status: await signatureStatus(result.signatures) };
}
export async function sign({ data, filename, identity, passphrase }) {
  const signingKeys = await unlock(identity?.privateKey, passphrase);
  return typeof data === 'string'
    ? pgp.sign({ message: await pgp.createCleartextMessage({ text: data }), signingKeys })
    : pgp.sign({ message: await message(data, filename), signingKeys, detached: true });
}
export async function verify({ data, signature, contacts }) {
  const result = await pgp.verify({
    message: typeof data === 'string' ? await pgp.readCleartextMessage({ cleartextMessage: data }) : await message(data),
    ...(typeof data !== 'string' ? { signature: await pgp.readSignature({ armoredSignature: signature }) } : {}),
    verificationKeys: await publicKeys(contacts), format: typeof data === 'string' ? 'utf8' : 'binary'
  });
  return { data: result.data, status: await signatureStatus(result.signatures) };
}
