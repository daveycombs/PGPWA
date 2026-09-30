import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as pgp from 'openpgp';
import * as crypto from '../src/crypto.js';
let alice, bob, outsider, generated;
const passphrase = 'a long test passphrase';
before(async () => {
  generated = await crypto.generateIdentity({ name: 'Alice', email: 'alice@example.test', passphrase });
  [alice] = await crypto.importKeys(generated.privateKey);
  [bob] = await crypto.importKeys((await crypto.generateIdentity({ name: 'Bob', email: '', passphrase })).privateKey);
  [outsider] = await crypto.importKeys((await crypto.generateIdentity({ name: 'Eve', email: '', passphrase })).privateKey);
});
test('generated private keys are protected; public exports contain no secret material', async () => {
  assert.equal((await pgp.readPrivateKey({ armoredKey: alice.privateKey })).isDecrypted(), false);
  assert.equal((await pgp.readKey({ armoredKey: alice.publicKey })).isPrivate(), false);
  assert.match(generated.revocationCertificate, /BEGIN PGP PUBLIC KEY BLOCK/);
});
test('multi-recipient signed encryption and Unicode round trip', async () => {
  const text = 'Private hello 🌍\nLine two.';
  const data = await crypto.encrypt({ data: text, recipients: [alice, bob], signer: alice, passphrase });
  for (const identity of [alice, bob]) {
    const result = await crypto.decrypt({ data, identity, passphrase, contacts: [alice, bob] });
    assert.equal(result.data, text); assert.equal(result.status.kind, 'valid');
  }
  await assert.rejects(crypto.decrypt({ data, identity: outsider, passphrase, contacts: [] }));
  await assert.rejects(crypto.decrypt({ data, identity: alice, passphrase: 'wrong', contacts: [] }));
});
test('binary payload remains byte exact and unsigned messages are labeled', async () => {
  const bytes = new Uint8Array([0, 255, 128, 10, 13, 42]);
  const data = await crypto.encrypt({ data: bytes, filename: 'file.bin', recipients: [alice] });
  const result = await crypto.decrypt({ data, identity: alice, passphrase, contacts: [], binary: true });
  assert.deepEqual(result.data, bytes); assert.equal(result.status.kind, 'unsigned');
});
test('cleartext signatures verify and tampering is not trusted', async () => {
  const data = await crypto.sign({ data: 'original text', identity: alice, passphrase });
  assert.equal((await crypto.verify({ data, contacts: [alice] })).status.kind, 'valid');
  assert.equal((await crypto.verify({ data: data.replace('original text', 'modified text'), contacts: [alice] })).status.kind, 'unverified');
  assert.equal((await crypto.verify({ data, contacts: [bob] })).status.kind, 'unverified');
});
test('detached binary signatures reject changed bytes', async () => {
  const data = new Uint8Array([1,2,3,255]);
  const signature = await crypto.sign({ data, identity: alice, passphrase });
  assert.equal((await crypto.verify({ data, signature, contacts: [alice] })).status.kind, 'valid');
  assert.equal((await crypto.verify({ data: new Uint8Array([1,2,4,255]), signature, contacts: [alice] })).status.kind, 'unverified');
});
test('plaintext private imports require protection before persistence', async () => {
  const raw = await pgp.decryptKey({ privateKey: await pgp.readPrivateKey({ armoredKey: alice.privateKey }), passphrase });
  await assert.rejects(crypto.importKeys(raw.armor()), /unprotected/);
  const [protectedKey] = await crypto.importKeys(raw.armor(), passphrase);
  assert.equal((await pgp.readPrivateKey({ armoredKey: protectedKey.privateKey })).isDecrypted(), false);
});
test('empty recipients and malformed keys fail closed', async () => {
  await assert.rejects(crypto.encrypt({ data: 'hi', recipients: [] }), /recipient/);
  await assert.rejects(crypto.importKeys('not a key'));
  await assert.rejects(crypto.generateIdentity({ name: 'A', email: '', passphrase: 'weak' }), /12 characters/);
});

test('revoked and expired recipients cannot be used for encryption', async () => {
  const { publicKey } = await pgp.revokeKey({ key: await pgp.readKey({ armoredKey: alice.publicKey }), revocationCertificate: generated.revocationCertificate });
  const [revoked] = await crypto.importKeys(publicKey);
  await assert.rejects(crypto.encrypt({ data: 'secret', recipients: [revoked] }));
  const expired = await pgp.generateKey({ type: 'ecc', curve: 'curve25519Legacy', userIDs: [{ name: 'Expired' }], date: new Date('2020-01-01'), keyExpirationTime: 60 });
  const [old] = await crypto.importKeys(expired.publicKey);
  await assert.rejects(crypto.encrypt({ data: 'secret', recipients: [old] }));
});

test('large-file decompression allowance is scoped to each operation', async () => {
  const bytes = new Uint8Array(26 * 1024 * 1024).fill(7);
  const data = await pgp.encrypt({
    message: await pgp.createMessage({ binary: bytes }),
    encryptionKeys: await pgp.readKey({ armoredKey: alice.publicKey }),
    format: 'binary', config: { preferredCompressionAlgorithm: pgp.enums.compression.zlib }
  });
  const args = { data, identity: alice, passphrase, contacts: [], binary: true };
  await assert.rejects(crypto.decrypt(args));
  const result = await crypto.decrypt({ ...args, largeFiles: true });
  assert.deepEqual(result.data, bytes);
  await assert.rejects(crypto.decrypt(args));
});
