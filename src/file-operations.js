let cancel;

export function cancelFileOperation() { cancel?.(); }

function run(operation, args) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./file-worker.js', import.meta.url), { type: 'module' });
    const finish = (error, result) => {
      worker.terminate();
      cancel = null;
      if (error) reject(error); else resolve(result);
    };
    cancel = () => finish(new Error('File operation cancelled.'));
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.result);
    worker.onerror = () => finish(new Error('File processing failed. Try a smaller file or another browser.'));
    worker.postMessage({ operation, args }, args.data instanceof Uint8Array ? [args.data.buffer] : []);
  });
}

export const encrypt = args => run('encrypt', args);
export const decrypt = args => run('decrypt', args);
export const sign = args => run('sign', args);
export const verify = args => run('verify', args);
