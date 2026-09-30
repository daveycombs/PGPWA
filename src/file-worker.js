import { encrypt, decrypt, sign, verify } from './crypto.js';

const operations = { encrypt, decrypt, sign, verify };
self.onmessage = async ({ data: { operation, args } }) => {
  try {
    const result = await operations[operation](args);
    const bytes = result instanceof Uint8Array ? result : result.data;
    self.postMessage({ result }, bytes instanceof Uint8Array ? [bytes.buffer] : []);
  } catch (error) {
    self.postMessage({ error: error.message || 'File operation failed.' });
  }
};
