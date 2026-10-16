// qpf.js: the QuantumProof SDK. One ES module, no build step. Works in browsers and Node 18+.
//   import { QPF, wallet } from 'https://quantumproofchain.net/qpf.js';
//   const qpf = new QPF();                       // defaults to https://quantumproofchain.net/rpc
//   await qpf.blockNumber();
//   const w = await wallet();                    // new ML-DSA-44 wallet (or wallet(seedHex) to restore)
//   await qpf.send(w, 'qpf1…', 25);              // signs ML-DSA-44 locally, submits via qpf_sendTransaction
const NOBLE = 'https://cdn.jsdelivr.net/npm/@noble/post-quantum@0.2.1/ml-dsa.js/+esm', SHA3 = 'https://cdn.jsdelivr.net/npm/@noble/hashes@1.5.0/sha3.js/+esm';
export const CHAIN_ID = 'quantumproof-testnet-1', FEE = 0.001;
const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, '0')).join(''), unhex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const canon = (o) => JSON.stringify(o, Object.keys(o).sort());
let lib; const load = async () => lib || (lib = Promise.all([import(NOBLE), import(SHA3)]).then(([a, b]) => ({ ml: a.ml_dsa44, sha3: b.sha3_256 })));

/** Create or restore an ML-DSA-44 wallet. The secret never leaves this process. */
export async function wallet(seedHex) {
  const { ml, sha3 } = await load(); const seed = seedHex || hex(crypto.getRandomValues(new Uint8Array(32)));
  const k = ml.keygen(unhex(seed)), pub = hex(k.publicKey);
  return { seed, pub, address: 'qpf1' + hex(sha3(unhex(pub))).slice(0, 40), sign: (msg) => hex(ml.sign(k.secretKey, typeof msg === 'string' ? new TextEncoder().encode(msg) : msg)) };
}

export class QPF {
  constructor(url = (typeof location !== 'undefined' && /quantumproof|localhost/.test(location.host) ? location.origin : 'https://quantumproofchain.net') + '/rpc') { this.url = url; this.id = 0; }
  async call(method, ...params) { const r = await (await fetch(this.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++this.id, method, params }) })).json();
    if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code }); return r.result; }
  chainId() { return this.call('qpf_chainId'); }
  blockNumber() { return this.call('qpf_blockNumber'); }
  getBlock(k = 'latest', full = false) { return this.call('qpf_getBlock', k, full); }
  getBalance(a) { return this.call('qpf_getBalance', a); }
  getAccount(a) { return this.call('qpf_getAccount', a); }
  getTransaction(h) { return this.call('qpf_getTransaction', h); }
  verify(msg, pub, sig, alg = 'ML-DSA-44') { return this.call('qpf_verify', msg, pub, sig, alg); }
  getValidators() { return this.call('qpf_getValidators'); }
  getPool() { return this.call('qpf_getPool'); }
  getVault(a) { return this.call('qpf_getVault', a); }
  /** Sign a transfer with an ML-DSA-44 wallet and submit it. Resolves to { hash, verified }. */
  async send(w, to, amount) { const { nonce } = await this.getAccount(w.address);
    const t = { from: w.address, to, amount, nonce, fee: FEE, pub: w.pub }; t.sig = w.sign(canon({ amount, chain: CHAIN_ID, fee: FEE, from: t.from, nonce, to }));
    return this.call('qpf_sendTransaction', t); }
  /** Poll until a tx hash is finalized in a block. */
  async wait(hash, ms = 30000) { const end = Date.now() + ms; for (;;) { const t = await this.getTransaction(hash); if (t) return t; if (Date.now() > end) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 1000)); } }
}
