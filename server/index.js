// QuantumProof testnet: a quantum-resistant L1. Every block, attestation and transaction is signed with
// ML-DSA (FIPS 204, lattice-based). Hashing is SHA3-256. Dependency-free Node 24+.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = +process.env.PORT || 8256;
const DATA = process.env.DATA_PATH || path.join(__dirname, '..', 'data.json');
const CLIENT = path.join(__dirname, '..', 'client');
const SLOT_MS = 4000, FAUCET_AMT = 1000, FAUCET_COOLDOWN = 3600e3, FEE = 0.001, KEEP_BLOCKS = 4000;
const QPF_MINT = process.env.QPF_MINT || '';

const sha3 = (b) => crypto.createHash('sha3-256').update(b).digest('hex');
const canon = (o) => JSON.stringify(o, Object.keys(o).sort());
const addrOf = (pubHex) => 'qpf1' + sha3(Buffer.from(pubHex, 'hex')).slice(0, 40);
const pubKey = (hex, alg) => crypto.createPublicKey({ key: { kty: 'AKP', alg, pub: Buffer.from(hex, 'hex').toString('base64url') }, format: 'jwk' });
const verify = (msg, pubHex, sigHex, alg) => { try { return crypto.verify(null, Buffer.from(msg), pubKey(pubHex, alg), Buffer.from(sigHex, 'hex')); } catch { return false; } };

// ---------- state ----------
let S;
function fresh() {
  const vals = ['Kyber', 'Dilithium', 'Falcon', 'Sphincs'].map((name) => {
    const k = crypto.generateKeyPairSync('ml-dsa-65');
    const pub = Buffer.from(k.publicKey.export({ format: 'jwk' }).pub, 'base64url').toString('hex');
    return { name, pub, addr: addrOf(pub), sk: k.privateKey.export({ format: 'pem', type: 'pkcs8' }), produced: 0 };
  });
  return { genesis: Date.now(), height: 0, blocks: [], accounts: {}, faucet: {}, txIndex: {}, validators: vals, totalTx: 0, sigsVerified: 0 };
}
try { S = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch { S = fresh(); }
const skCache = new Map(); const skOf = (v) => skCache.get(v.addr) || (skCache.set(v.addr, crypto.createPrivateKey(v.sk)), skCache.get(v.addr));
let dirty = false; setInterval(() => { if (dirty) { dirty = false; fs.writeFile(DATA, JSON.stringify(S), () => {}); } }, 5000);
const acct = (a) => S.accounts[a] || (S.accounts[a] = { bal: 0, nonce: 0, pub: null, txs: 0 });
let mempool = [];

// ---------- transactions ----------
// tx = { from, to, amount, nonce, fee, pub, sig } ; signed message = canon({from,to,amount,nonce,fee,chain})
const CHAIN_ID = 'quantumproof-testnet-1';
function txBody(t) { return canon({ amount: t.amount, chain: CHAIN_ID, fee: t.fee, from: t.from, nonce: t.nonce, to: t.to }); }
function checkTx(t) {
  if (!t || typeof t !== 'object') return 'bad tx';
  if (!/^qpf1[0-9a-f]{40}$/.test(t.from || '') || !/^qpf1[0-9a-f]{40}$/.test(t.to || '')) return 'bad address';
  if (!(t.amount > 0) || !isFinite(t.amount) || t.amount > 1e12) return 'bad amount';
  if (t.fee !== FEE) return 'fee must be ' + FEE;
  if (!/^[0-9a-f]{2624}$/.test(t.pub || '')) return 'pubkey must be an ML-DSA-44 key (1312 bytes)';
  if (addrOf(t.pub) !== t.from) return 'pubkey does not match from address';
  if (!/^[0-9a-f]{4840}$/.test(t.sig || '')) return 'signature must be ML-DSA-44 (2420 bytes)';
  if (!verify(txBody(t), t.pub, t.sig, 'ML-DSA-44')) return 'invalid ML-DSA signature';
  S.sigsVerified++;
  const a = acct(t.from), pend = mempool.filter((m) => m.from === t.from);
  if (t.nonce !== a.nonce + pend.length) return 'bad nonce (expected ' + (a.nonce + pend.length) + ')';
  const spent = pend.reduce((s, m) => s + m.amount + m.fee, 0);
  if (a.bal - spent < t.amount + t.fee - 1e-9) return 'insufficient balance';
  return null;
}
const txHash = (t) => sha3(txBody(t) + t.sig);

// ---------- block production: rotating ML-DSA-65 proposer + 3-of-4 attestations ----------
function produce() {
  const v = S.validators[S.height % S.validators.length];
  const prev = S.blocks.length ? S.blocks[S.blocks.length - 1].hash : '0'.repeat(64);
  const txs = mempool.splice(0, 200); const applied = [];
  for (const t of txs) {
    const a = acct(t.from), b = acct(t.to);
    if (a.bal < t.amount + t.fee - 1e-9 || t.nonce !== a.nonce) continue;
    a.bal -= t.amount + t.fee; a.nonce++; a.pub = t.pub; a.txs++; b.bal += t.amount; b.txs++;
    applied.push({ hash: txHash(t), from: t.from, to: t.to, amount: t.amount, fee: t.fee, nonce: t.nonce, kind: t.kind || 'transfer', sigBytes: 2420 });
  }
  const fees = applied.reduce((s, t) => s + t.fee, 0); acct(v.addr).bal += fees;
  const txRoot = sha3(applied.map((t) => t.hash).join('') || 'empty');
  const header = { height: S.height + 1, prev, time: Date.now(), txRoot, proposer: v.addr, txCount: applied.length };
  const hash = sha3(canon(header));
  const sign = (val) => crypto.sign(null, Buffer.from(hash), skOf(val)).toString('hex');
  const atts = S.validators.filter((x) => x !== v).map((x) => ({ validator: x.addr, name: x.name, sig: sign(x) }));
  const block = { ...header, hash, proposerName: v.name, sig: sign(v), attestations: atts, alg: 'ML-DSA-65', hashAlg: 'SHA3-256', fees, txList: applied };
  // self-check: every signature must verify against the validator's public key before the block is accepted
  const ok = verify(hash, v.pub, block.sig, 'ML-DSA-65') && atts.filter((a) => verify(hash, S.validators.find((x) => x.addr === a.validator).pub, a.sig, 'ML-DSA-65')).length >= 2;
  if (!ok) { mempool = txs.concat(mempool); return; }
  S.sigsVerified += 1 + atts.length;
  for (const t of applied) S.txIndex[t.hash] = block.height;
  S.height = block.height; S.totalTx += applied.length; v.produced++;
  S.blocks.push(block); if (S.blocks.length > KEEP_BLOCKS) S.blocks.splice(0, S.blocks.length - KEEP_BLOCKS);
  dirty = true; broadcast(block);
}
setInterval(produce, SLOT_MS);

// ---------- live feed (SSE) ----------
const subs = new Set();
function broadcast(b) { const m = 'data: ' + JSON.stringify(slim(b)) + '\n\n'; for (const r of subs) r.write(m); }
const slim = (b) => ({ height: b.height, hash: b.hash, time: b.time, proposerName: b.proposerName, txCount: b.txCount, sigs: 1 + b.attestations.length });

// ---------- http ----------
const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/png', '.mp4': 'video/mp4', '.pdf': 'application/pdf' };
const body = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 2e5) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });
function stats() {
  const last = S.blocks.slice(-30); const span = last.length > 1 ? (last[last.length - 1].time - last[0].time) / 1000 : 1;
  return { chain: CHAIN_ID, height: S.height, totalTx: S.totalTx, accounts: Object.keys(S.accounts).length, sigsVerified: S.sigsVerified, mempool: mempool.length,
    tps: +(last.reduce((s, b) => s + b.txCount, 0) / span).toFixed(2), slotMs: SLOT_MS, validators: S.validators.map((v) => ({ name: v.name, addr: v.addr, produced: v.produced, pubBytes: v.pub.length / 2 })),
    alg: { blocks: 'ML-DSA-65', tx: 'ML-DSA-44', hash: 'SHA3-256' }, sizes: { ed25519Sig: 64, mldsa44Sig: 2420, mldsa65Sig: 3309, mldsa44Pub: 1312 }, mint: QPF_MINT };
}
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname;
  try {
    if (p === '/api/stats') return send(res, 200, stats());
    if (p === '/api/blocks') { const n = Math.min(50, +u.searchParams.get('n') || 20); return send(res, 200, S.blocks.slice(-n).reverse().map(slim)); }
    if (p.startsWith('/api/block/')) { const k = p.slice(11); const b = S.blocks.find((x) => String(x.height) === k || x.hash === k); return b ? send(res, 200, b) : send(res, 404, { error: 'not found' }); }
    if (p.startsWith('/api/tx/') && req.method === 'GET') { const h = p.slice(8), b = S.blocks.find((x) => x.height === S.txIndex[h]); const t = b && b.txList.find((x) => x.hash === h);
      return t ? send(res, 200, { ...t, block: b.height, blockHash: b.hash, time: b.time }) : send(res, 404, { error: 'not found' }); }
    if (p.startsWith('/api/account/')) { const a = p.slice(13); const ac = S.accounts[a] || { bal: 0, nonce: 0, txs: 0 }; const pend = mempool.filter((m) => m.from === a).length;
      const recent = []; for (let i = S.blocks.length - 1; i >= 0 && recent.length < 25; i--) for (const t of S.blocks[i].txList || []) if (t.from === a || t.to === a) recent.push({ ...t, block: S.blocks[i].height, time: S.blocks[i].time });
      return send(res, 200, { address: a, balance: ac.bal, nonce: ac.nonce + pend, pubKnown: !!ac.pub, txs: ac.txs, recent }); }
    if (p === '/api/faucet' && req.method === 'POST') { const { address } = await body(req);
      if (!/^qpf1[0-9a-f]{40}$/.test(address || '')) return send(res, 400, { error: 'bad address' });
      const last = S.faucet[address] || 0; if (Date.now() - last < FAUCET_COOLDOWN) return send(res, 429, { error: 'faucet cooldown', retryIn: Math.ceil((FAUCET_COOLDOWN - (Date.now() - last)) / 60000) + ' min' });
      S.faucet[address] = Date.now(); acct(address).bal += FAUCET_AMT; dirty = true; return send(res, 200, { ok: true, amount: FAUCET_AMT }); }
    if (p === '/api/tx' && req.method === 'POST') { const t = await body(req); t.fee = FEE; const err = checkTx(t); if (err) return send(res, 400, { error: err });
      mempool.push(t); return send(res, 200, { ok: true, hash: txHash(t), verified: 'ML-DSA-44' }); }
    if (p === '/api/live') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' }); res.write(': hi\n\n'); subs.add(res); req.on('close', () => subs.delete(res)); return; }
    // static
    const routes = { '/': 'index.html', '/explorer': 'explorer.html', '/wallet': 'wallet.html', '/docs': 'docs.html', '/whitepaper': 'whitepaper.html' };
    let f = routes[p] || p.slice(1); if (p.startsWith('/explorer/')) f = 'explorer.html';
    const fp = path.join(CLIENT, path.normalize(f).replace(/^(\.\.[\/\\])+/, ''));
    if (!fp.startsWith(CLIENT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res);
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}).listen(PORT, () => console.log('QuantumProof testnet on :' + PORT, 'height', S.height));
