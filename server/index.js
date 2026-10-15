// QuantumProof testnet: a quantum-resistant L1. Every block, attestation and transaction is signed with
// ML-DSA (FIPS 204, lattice-based). Hashing is SHA3-256. Dependency-free Node 24+.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = +process.env.PORT || 8256;
const DATA = process.env.DATA_PATH || path.join(__dirname, '..', 'data.json');
const CLIENT = path.join(__dirname, '..', 'client');
const SLOT_MS = 4000, FAUCET_AMT = 1000, FAUCET_COOLDOWN = 3600e3, FEE = 0.001, KEEP_BLOCKS = 4000;
const QPF_MINT = process.env.QPF_MINT || 'JCsfUhtjjHpfMuRTDk2VXTStGU2z1Uz17aWHjkPdpump';

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

// ---------- block production: rotating ML-DSA-65 proposer + attestations ----------
// Open validator set: anyone can register an ML-DSA-65 key (staking STAKE tQPF), run qpf-node.js and sign blocks
// from their own machine. Each 4s slot the header is published at /api/pending; online community validators sign it
// within SIGN_WINDOW_MS. A community proposer that fails to sign is skipped (missed++) and a core validator takes the slot.
const STAKE = 500, BLOCK_REWARD = 2, ATT_REWARD = 0.25, SIGN_WINDOW_MS = 2600, ONLINE_MS = 20000, MAX_COMMUNITY = 64;
S.community = S.community || [];
const online = (c) => Date.now() - (c.lastSeen || 0) < ONLINE_MS;
let pending = null;
function simulate(txs) { // pick the txs that will apply, without mutating state
  const tmp = {}, get = (k) => tmp[k] || (tmp[k] = { bal: (S.accounts[k] || {}).bal || 0, nonce: (S.accounts[k] || {}).nonce || 0 }), out = [];
  for (const t of txs) { const a = get(t.from), b = get(t.to); if (a.bal < t.amount + t.fee - 1e-9 || t.nonce !== a.nonce) continue; a.bal -= t.amount + t.fee; a.nonce++; b.bal += t.amount; out.push(t); }
  return out;
}
function makeHeader(prop, applied) {
  const prev = S.blocks.length ? S.blocks[S.blocks.length - 1].hash : '0'.repeat(64);
  const txRoot = sha3(applied.map((t) => txHash(t)).join('') || 'empty');
  const header = { height: S.height + 1, prev, time: Date.now(), txRoot, proposer: prop.addr, txCount: applied.length };
  return { header, hash: sha3(canon(header)) };
}
function startSlot() {
  if (pending) return;
  const set = S.validators.concat(S.community.filter(online));
  const prop = set[S.height % set.length];
  const txs = mempool.splice(0, 200), applied = simulate(txs);
  const { header, hash } = makeHeader(prop, applied);
  pending = { header, hash, prop, txs, applied, sigs: new Map(), core: S.validators.includes(prop) };
  setTimeout(finalize, SIGN_WINDOW_MS);
}
function finalize() {
  const P = pending; if (!P) return; pending = null;
  let { prop, header, hash } = P, comm = [...P.sigs.values()];
  const propSig = P.core ? null : P.sigs.get(prop.addr);
  if (!P.core && !propSig) { // community proposer offline: skip it, a core validator takes the slot
    prop.missed = (prop.missed || 0) + 1; prop = S.validators[S.height % S.validators.length];
    ({ header, hash } = makeHeader(prop, P.applied)); comm = [];
  }
  const sign = (val) => crypto.sign(null, Buffer.from(hash), skOf(val)).toString('hex');
  const pSig = S.validators.includes(prop) ? sign(prop) : propSig.sig;
  const atts = S.validators.filter((x) => x !== prop).map((x) => ({ validator: x.addr, name: x.name, sig: sign(x) }))
    .concat(comm.filter((c) => c.addr !== prop.addr).map((c) => ({ validator: c.addr, name: c.name, sig: c.sig, community: true })));
  const valOf = (addr) => S.validators.find((x) => x.addr === addr) || S.community.find((x) => x.addr === addr);
  const ok = verify(hash, prop.pub, pSig, 'ML-DSA-65') && atts.filter((x) => verify(hash, valOf(x.validator).pub, x.sig, 'ML-DSA-65')).length >= 2;
  if (!ok) { mempool = P.txs.concat(mempool); return; }
  const applied = [];
  for (const t of P.applied) { const a = acct(t.from), b = acct(t.to); if (a.bal < t.amount + t.fee - 1e-9 || t.nonce !== a.nonce) continue;
    a.bal -= t.amount + t.fee; a.nonce++; a.pub = t.pub; a.txs++; b.bal += t.amount; b.txs++;
    applied.push({ hash: txHash(t), from: t.from, to: t.to, amount: t.amount, fee: t.fee, nonce: t.nonce, kind: t.kind || 'transfer', sigBytes: 2420 }); if (t.to !== t.from) ptTx(t.from); }
  const fees = applied.reduce((x, t) => x + t.fee, 0);
  acct(prop.addr).bal += fees + BLOCK_REWARD; prop.rewards = (prop.rewards || 0) + fees + BLOCK_REWARD;
  for (const x of atts) { acct(x.validator).bal += ATT_REWARD; const v = valOf(x.validator); v.rewards = (v.rewards || 0) + ATT_REWARD; v.attested = (v.attested || 0) + 1; }
  const block = { ...header, hash, proposerName: prop.name, sig: pSig, attestations: atts, alg: 'ML-DSA-65', hashAlg: 'SHA3-256', fees, reward: BLOCK_REWARD, txList: applied };
  S.sigsVerified += 1 + atts.length;
  for (const t of applied) S.txIndex[t.hash] = block.height;
  S.height = block.height; S.totalTx += applied.length; prop.produced = (prop.produced || 0) + 1;
  S.blocks.push(block); if (S.blocks.length > KEEP_BLOCKS) S.blocks.splice(0, S.blocks.length - KEEP_BLOCKS);
  dirty = true; broadcast(block);
}
setInterval(startSlot, SLOT_MS);
const regBody = (o) => canon({ chain: CHAIN_ID, kind: o.kind, name: o.name || '', pub: o.pub });
const pubVal = (c) => ({ name: c.name, addr: c.addr, stake: c.stake, produced: c.produced || 0, attested: c.attested || 0, missed: c.missed || 0, rewards: +(c.rewards || 0).toFixed(3), joined: c.joined, online: online(c), lastSeen: c.lastSeen || 0 });
const coreVal = (v) => ({ name: v.name, addr: v.addr, produced: v.produced, attested: v.attested || 0, rewards: +(v.rewards || 0).toFixed(3), pubBytes: v.pub.length / 2 });

// ---------- live feed (SSE) ----------
const subs = new Set();
function broadcast(b) { const m = 'data: ' + JSON.stringify(slim(b)) + '\n\n'; for (const r of subs) r.write(m); }
const slim = (b) => ({ height: b.height, hash: b.hash, time: b.time, proposerName: b.proposerName, txCount: b.txCount, sigs: 1 + b.attestations.length });

// ---------- testnet points: Season 0 ----------
// users: PT_TX per applied transfer sent (max TX_CAP/day), PT_FAUCET per faucet claim; validators: attestations + proposals - misses;
// bonus: admin grants for confirmed bug reports (ADMIN_KEY env). Points are a public record of testnet participation.
const PT_TX = 2, TX_CAP = 25, PT_FAUCET = 5, PT_ATT = 1, PT_PROP = 4, PT_MISS = 4, ADMIN_KEY = process.env.ADMIN_KEY || '';
S.pts = S.pts || {};
const ptOf = (a) => S.pts[a] || (S.pts[a] = { tx: 0, faucet: 0, bonus: 0, day: '', today: 0, notes: [] });
const today = () => new Date().toISOString().slice(0, 10);
function ptTx(addr) { const p = ptOf(addr), d = today(); if (p.day !== d) { p.day = d; p.today = 0; } if (p.today >= TX_CAP) return; p.today++; p.tx++; }
function pointsOf(addr) { const p = S.pts[addr] || { tx: 0, faucet: 0, bonus: 0 }, v = S.community.find((x) => x.addr === addr);
  const val = v ? Math.max(0, (v.attested || 0) * PT_ATT + (v.produced || 0) * PT_PROP - (v.missed || 0) * PT_MISS) : 0;
  return { addr, name: v ? v.name : null, validator: !!v, txPts: p.tx * PT_TX, faucetPts: p.faucet * PT_FAUCET, validatorPts: val, bonus: p.bonus, total: p.tx * PT_TX + p.faucet * PT_FAUCET + val + p.bonus }; }
function board() { const addrs = new Set(Object.keys(S.pts).concat(S.community.map((c) => c.addr))); return [...addrs].map(pointsOf).filter((x) => x.total > 0).sort((a, b) => b.total - a.total); }

// ---------- quantum exposure scanner (BTC / ETH / SOL, public chain data) ----------
// A wallet is "exposed" once its public key is visible on-chain: always for Solana (address = Ed25519 pubkey) and Bitcoin
// Taproot (bc1p), and for Bitcoin/Ethereum addresses that have ever signed a spend/tx. Shor's algorithm recovers the
// private key from an exposed public key.
// addresses whose coins are known to sit in raw pay-to-pubkey outputs too old to page to (e.g. the genesis coinbase)
const KNOWN_P2PK = new Set(['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa']);
const SCAN_CACHE = new Map(); let PX = { t: 0, v: {} };
async function prices() { if (Date.now() - PX.t < 60e3) return PX.v;
  try { const r = await (await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd')).json(); PX = { t: Date.now(), v: { BTC: r.bitcoin.usd, ETH: r.ethereum.usd, SOL: r.solana.usd } }; } catch {}
  return PX.v; }
const rpc = async (url, method, params) => (await (await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json()).result;
function chainOf(a) { if (/^0x[0-9a-fA-F]{40}$/.test(a)) return 'ETH'; if (/^(bc1[02-9ac-hj-np-z]{11,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(a)) return 'BTC'; if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return 'SOL'; return null; }
async function scan(a) {
  const chain = chainOf(a); if (!chain) throw new Error('not a Bitcoin, Ethereum or Solana address');
  const c = SCAN_CACHE.get(a); if (c && Date.now() - c.t < 60e3) return c.v;
  const px = await prices(); let bal = 0, exposed = false, reason = '', scheme = '', txs = null;
  if (chain === 'SOL') { const r = await rpc('https://api.mainnet-beta.solana.com', 'getBalance', [a]); bal = (r && r.value || 0) / 1e9; exposed = true; scheme = 'Ed25519';
    reason = 'A Solana address IS its Ed25519 public key. Every Solana wallet is exposed from the moment it exists.'; }
  if (chain === 'ETH') { const R = 'https://ethereum-rpc.publicnode.com'; const [b, n] = await Promise.all([rpc(R, 'eth_getBalance', [a, 'latest']), rpc(R, 'eth_getTransactionCount', [a, 'latest'])]);
    bal = Number(BigInt(b || '0x0')) / 1e18; txs = Number(BigInt(n || '0x0')); scheme = 'ECDSA secp256k1'; exposed = txs > 0;
    reason = exposed ? 'This wallet has signed ' + txs.toLocaleString() + ' transaction' + (txs === 1 ? '' : 's') + '. Each one published its secp256k1 public key on-chain.' : 'This wallet has never sent a transaction, so its public key is still hidden behind a hash. The first send exposes it.'; }
  if (chain === 'BTC') { const r = await (await fetch('https://mempool.space/api/address/' + a)).json(); const cs = r.chain_stats || {};
    bal = ((cs.funded_txo_sum || 0) - (cs.spent_txo_sum || 0)) / 1e8; txs = cs.tx_count || 0; const tap = /^bc1p/.test(a); scheme = tap ? 'Schnorr secp256k1 (Taproot)' : 'ECDSA secp256k1';
    let p2pk = KNOWN_P2PK.has(a); if (!p2pk && !tap && !(cs.spent_txo_count > 0) && /^1/.test(a)) { try { const tx = await (await fetch('https://mempool.space/api/address/' + a + '/txs')).json(); p2pk = tx.some((t) => t.vout.some((o) => o.scriptpubkey_type === 'p2pk')); } catch {} }
    exposed = tap || p2pk || (cs.spent_txo_count || 0) > 0;
    reason = p2pk ? 'Coins here were paid to a raw public key (P2PK, the format of the earliest Bitcoin blocks, including Satoshi’s). The key is in plain sight on-chain.' : tap ? 'Taproot (bc1p) addresses contain the public key directly. Exposed from the first deposit.' : exposed ? 'This address has spent coins, which publishes its public key on-chain. Any coins still sitting here are exposed.' : 'This address has never spent, so its public key is still hidden behind a hash. The first spend exposes it.'; }
  const usd = px[chain] ? bal * px[chain] : null;
  const v = { address: a, chain, scheme, exposed, reason, balance: bal, usd, txs, price: px[chain] || null, at: Date.now() };
  SCAN_CACHE.set(a, { t: Date.now(), v }); return v;
}

// ---------- the Forge Challenge ----------
// An ML-DSA-65 keypair is generated once; only the public key is kept. The secret key is never written anywhere, so
// nobody (including the QuantumProof team) can sign for it. Produce a valid signature over the claim message and the
// bounty is yours. Breaking it means breaking ML-DSA.
if (!S.forge) { const k = crypto.generateKeyPairSync('ml-dsa-65');
  S.forge = { pub: Buffer.from(k.publicKey.export({ format: 'jwk' }).pub, 'base64url').toString('hex'), created: Date.now(), attempts: 0, winner: null }; dirty = true; }
const FORGE_TQPF = 100000, FORGE_QPF = process.env.FORGE_QPF || '';
const forgeMsg = (addr) => 'quantumproof-forge-v1:' + addr;
const forgeAddr = addrOf(S.forge.pub);
const lastTry = new Map();

// ---------- http ----------
const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/png', '.mp4': 'video/mp4', '.pdf': 'application/pdf' };
const body = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 2e5) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });
function stats() {
  const last = S.blocks.slice(-30); const span = last.length > 1 ? (last[last.length - 1].time - last[0].time) / 1000 : 1;
  return { chain: CHAIN_ID, height: S.height, totalTx: S.totalTx, accounts: Object.keys(S.accounts).length, sigsVerified: S.sigsVerified, mempool: mempool.length,
    tps: +(last.reduce((s, b) => s + b.txCount, 0) / span).toFixed(2), slotMs: SLOT_MS, validators: S.validators.map(coreVal), community: S.community.map(pubVal), economics: { stake: STAKE, blockReward: BLOCK_REWARD, attestReward: ATT_REWARD, fee: FEE, signWindowMs: SIGN_WINDOW_MS },
    alg: { blocks: 'ML-DSA-65', tx: 'ML-DSA-44', hash: 'SHA3-256' }, sizes: { ed25519Sig: 64, mldsa44Sig: 2420, mldsa65Sig: 3309, mldsa44Pub: 1312 }, mint: QPF_MINT };
}
http.createServer(async (req, res) => {
  if (req.url.startsWith('/scan/')) { req.url = '/scan'; }
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
      S.faucet[address] = Date.now(); acct(address).bal += FAUCET_AMT; ptOf(address).faucet++; dirty = true; return send(res, 200, { ok: true, amount: FAUCET_AMT }); }
    if (p === '/api/tx' && req.method === 'POST') { const t = await body(req); t.fee = FEE; const err = checkTx(t); if (err) return send(res, 400, { error: err });
      mempool.push(t); return send(res, 200, { ok: true, hash: txHash(t), verified: 'ML-DSA-44' }); }
    if (p === '/api/pending') return send(res, 200, pending ? { chain: CHAIN_ID, height: pending.header.height, hash: pending.hash, proposer: pending.prop.addr, proposerName: pending.prop.name, header: pending.header } : { height: null });
    if (p === '/api/validators') return send(res, 200, { core: S.validators.map(coreVal), community: S.community.map(pubVal), economics: { stake: STAKE, blockReward: BLOCK_REWARD, attestReward: ATT_REWARD, fee: FEE } });
    if (p === '/api/attest' && req.method === 'POST') { const { addr, hash, sig } = await body(req); const c = S.community.find((x) => x.addr === addr);
      if (!c) return send(res, 404, { error: 'unknown validator' }); if (!pending || pending.hash !== hash) return send(res, 409, { error: 'slot closed' });
      if (!/^[0-9a-f]{6618}$/.test(sig || '') || !verify(hash, c.pub, sig, 'ML-DSA-65')) return send(res, 400, { error: 'invalid ML-DSA-65 signature' });
      c.lastSeen = Date.now(); pending.sigs.set(addr, { addr, name: c.name, sig }); S.sigsVerified++; return send(res, 200, { ok: true, height: pending.header.height, proposer: pending.prop.addr === addr }); }
    if (p === '/api/validator/register' && req.method === 'POST') { const o = await body(req); o.kind = 'register-validator';
      if (!/^[0-9a-f]{3904}$/.test(o.pub || '')) return send(res, 400, { error: 'pub must be an ML-DSA-65 key (1952 bytes)' });
      if (!/^[A-Za-z0-9 ._-]{2,24}$/.test(o.name || '')) return send(res, 400, { error: 'name: 2-24 letters, digits, space . _ -' });
      if (!verify(regBody(o), o.pub, o.sig || '', 'ML-DSA-65')) return send(res, 400, { error: 'invalid ML-DSA-65 signature' });
      const addr = addrOf(o.pub); if (S.community.find((x) => x.addr === addr)) return send(res, 200, { ok: true, addr, already: true });
      if (S.community.length >= MAX_COMMUNITY) return send(res, 403, { error: 'validator set full' });
      if (S.validators.concat(S.community).some((x) => x.name.toLowerCase() === o.name.toLowerCase())) return send(res, 400, { error: 'name taken' });
      const ac = acct(addr); if (ac.bal < STAKE) return send(res, 400, { error: 'need ' + STAKE + ' tQPF at ' + addr + ' to stake (balance ' + ac.bal + ')' });
      ac.bal -= STAKE; S.community.push({ name: o.name, pub: o.pub, addr, stake: STAKE, joined: Date.now(), lastSeen: Date.now(), produced: 0, attested: 0, missed: 0, rewards: 0 }); dirty = true;
      return send(res, 200, { ok: true, addr, stake: STAKE }); }
    if (p === '/api/validator/exit' && req.method === 'POST') { const o = await body(req); o.kind = 'exit-validator'; const i = S.community.findIndex((x) => x.pub === o.pub);
      if (i < 0) return send(res, 404, { error: 'unknown validator' }); if (!verify(regBody(o), o.pub, o.sig || '', 'ML-DSA-65')) return send(res, 400, { error: 'invalid ML-DSA-65 signature' });
      const c = S.community[i]; acct(c.addr).bal += c.stake; S.community.splice(i, 1); dirty = true; return send(res, 200, { ok: true, returned: c.stake }); }
    if (p === '/api/points') { const b = board(); return send(res, 200, { season: 'Season 0', rules: { tx: PT_TX, txCapPerDay: TX_CAP, faucet: PT_FAUCET, attest: PT_ATT, propose: PT_PROP, miss: -PT_MISS }, participants: b.length, top: b.slice(0, 100).map((x, i) => ({ rank: i + 1, ...x })) }); }
    if (p.startsWith('/api/points/') && req.method === 'GET') { const a = p.slice(12); const b = board(); const i = b.findIndex((x) => x.addr === a); return send(res, 200, { rank: i < 0 ? null : i + 1, of: b.length, ...pointsOf(a) }); }
    if (p === '/api/points/grant' && req.method === 'POST') { if (!ADMIN_KEY || req.headers['x-admin-key'] !== ADMIN_KEY) return send(res, 403, { error: 'forbidden' });
      const { address, points, note } = await body(req); if (!/^qpf1[0-9a-f]{40}$/.test(address || '') || !Number.isFinite(points)) return send(res, 400, { error: 'address + points' });
      const pp = ptOf(address); pp.bonus += points; pp.notes.push({ points, note: String(note || '').slice(0, 140), at: Date.now() }); dirty = true; return send(res, 200, { ok: true, bonus: pp.bonus }); }
    if (p === '/api/scan') { const a = (u.searchParams.get('a') || '').trim(); try { return send(res, 200, await scan(a)); } catch (e) { return send(res, 400, { error: String(e.message || e) }); } }
    if (p === '/api/forge' && req.method === 'GET') return send(res, 200, { alg: 'ML-DSA-65', pub: S.forge.pub, pubBytes: S.forge.pub.length / 2, address: forgeAddr, created: S.forge.created, attempts: S.forge.attempts, winner: S.forge.winner, bounty: { tqpf: FORGE_TQPF, qpf: FORGE_QPF }, message: 'quantumproof-forge-v1:<your qpf1 address>' });
    if (p === '/api/forge' && req.method === 'POST') { const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress; if (Date.now() - (lastTry.get(ip) || 0) < 1000) return send(res, 429, { error: 'one attempt per second' }); lastTry.set(ip, Date.now());
      const { address, sig } = await body(req); if (!/^qpf1[0-9a-f]{40}$/.test(address || '')) return send(res, 400, { error: 'address must be your qpf1 address' });
      if (S.forge.winner) return send(res, 409, { error: 'already won', winner: S.forge.winner });
      S.forge.attempts++; dirty = true; const ok = /^[0-9a-f]+$/.test(sig || '') && verify(forgeMsg(address), S.forge.pub, sig, 'ML-DSA-65');
      if (!ok) return send(res, 200, { ok: false, attempts: S.forge.attempts, result: 'invalid signature. ML-DSA holds.' });
      S.forge.winner = { address, at: Date.now(), sig }; acct(address).bal += FORGE_TQPF; return send(res, 200, { ok: true, result: 'VALID FORGERY', winner: S.forge.winner }); }
    if (p === '/api/live') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' }); res.write(': hi\n\n'); subs.add(res); req.on('close', () => subs.delete(res)); return; }
    // static
    const routes = { '/': 'index.html', '/explorer': 'explorer.html', '/wallet': 'wallet.html', '/docs': 'docs.html', '/whitepaper': 'whitepaper.html', '/validators': 'validators.html', '/points': 'points.html', '/scan': 'scan.html', '/forge': 'forge.html' };
    let f = routes[p] || p.slice(1); if (p.startsWith('/explorer/')) f = 'explorer.html';
    const fp = path.join(CLIENT, path.normalize(f).replace(/^(\.\.[\/\\])+/, ''));
    if (!fp.startsWith(CLIENT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res);
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}).listen(PORT, () => console.log('QuantumProof testnet on :' + PORT, 'height', S.height));
