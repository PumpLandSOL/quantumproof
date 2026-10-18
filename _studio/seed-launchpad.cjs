// Seeds a local launchpad board for captures: real ML-DSA wallets + real signed launches/trades through the real API.
// Tech repos are answered by a GitHub stand-in (local capture server only). Keeps running on :8299 until killed.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto'), { execFileSync } = require('child_process');
process.env.DATA_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qpfseed-')), 'data.json'); process.env.PORT = '8299';
const sha3 = (b) => crypto.createHash('sha3-256').update(b).digest('hex'), canon = (o) => JSON.stringify(o, Object.keys(o).sort()), CH = 'quantumproof-testnet-1';
const wallet = () => { const k = crypto.generateKeyPairSync('ml-dsa-44'), pub = Buffer.from(k.publicKey.export({ format: 'jwk' }).pub, 'base64url').toString('hex'); return { pub, addr: 'qpf1' + sha3(Buffer.from(pub, 'hex')).slice(0, 40), sign: (m) => crypto.sign(null, Buffer.from(m), k.privateKey).toString('hex') }; };
const REPOS = { 'qpf-labs/lattice-sign': ['Rust', 412, 'ML-DSA signing for any app'], 'qpf-labs/pq-relay': ['TypeScript', 96, 'post-quantum message relay'], 'qpf-labs/qvault-cli': ['Go', 58, 'multisig vault CLI'] }; const PROOFS = {};
const realFetch = global.fetch;
global.fetch = async (u, o) => { u = String(u); const m = u.match(/^https:\/\/api\.github\.com\/repos\/(qpf-labs\/[a-z-]+)(.*)$/);
  if (m && REPOS[m[1]]) { const [lang, stars, desc] = REPOS[m[1]]; if (!m[2]) return new Response(JSON.stringify({ full_name: m[1], html_url: 'https://github.com/' + m[1], private: false, fork: false, pushed_at: new Date(Date.now() - 2 * 864e5).toISOString(), stargazers_count: stars, language: lang, description: desc, homepage: 'https://quantumproofchain.net' }));
    return new Response(PROOFS[m[1]] || '', { status: m[2].includes('quantumproof.txt') && PROOFS[m[1]] ? 200 : 404 }); }
  return realFetch(u, o); };
require('../server/index.js'); const U = 'http://localhost:8299';
const post = async (p, b) => (await realFetch(U + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json();
const get = async (p) => (await realFetch(U + p)).json();
// token art: square crops of the QPF brand graphics
const SRC = ['qpf-keyart', 'qpf-lattice', 'qpf-pfp', 'qpf-threat', 'qpf-layers', 'qpf-consensus', 'qpf-sigsize', 'qpf-anatomy', 'qpf-harvest'], TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'qpfimg-'));
const img = (i, x, y) => { const out = path.join(TMP, i + '.jpg'); execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(__dirname, '..', 'brand', SRC[i % SRC.length] + '.png'), '-vf', `crop=ih*0.62:ih*0.62:${x}:${y},scale=256:256`, '-q:v', '4', out]); return 'data:image/jpeg;base64,' + fs.readFileSync(out).toString('base64'); };
async function launch(w, o) { const acc = await get('/api/launchpad/account/' + w.addr), b = { desc: '', repo: '', devBuy: 0, ...o, lnonce: acc.lnonce, from: w.addr, pub: w.pub };
  b.sig = w.sign(canon({ chain: CH, desc: b.desc, devBuy: b.devBuy, from: w.addr, img: sha3(b.image), kind: 'lp-launch', lnonce: b.lnonce, name: b.name, repo: b.repo, symbol: b.symbol, type: b.type })); return post('/api/launchpad/launch', b); }
async function trade(w, id, side, amount) { const acc = await get('/api/launchpad/account/' + w.addr), b = { id, side, amount, minOut: 0, lnonce: acc.lnonce, from: w.addr, pub: w.pub };
  b.sig = w.sign(canon({ amount, chain: CH, from: w.addr, id, kind: 'lp-trade', lnonce: b.lnonce, minOut: 0, side })); return post('/api/launchpad/trade', b); }
(async () => { await new Promise((r) => setTimeout(r, 600));
  const T = [['tech', 'Lattice Sign', 'LSIGN', 'ML-DSA signing SDK for wallets and apps. Open source, audited roadmap.', 'qpf-labs/lattice-sign', 400],
    ['meme', 'Shor Doge', 'SHORDOGE', 'the doge that survived Q-day', '', 300], ['tech', 'PQ Relay', 'RELAY', 'Encrypted, post-quantum message relay for QuantumProof dapps.', 'qpf-labs/pq-relay', 200],
    ['meme', 'Lattice Cat', 'LCAT', 'nine lives, zero elliptic curves', '', 150], ['meme', 'Qubit', 'QUBIT', 'superposition of up only and down only', '', 120], ['tech', 'QVault CLI', 'QVAULT', 'Multisig vaults from your terminal. ML-DSA approvals.', 'qpf-labs/qvault-cli', 100],
    ['meme', 'Harvest Now', 'HARVEST', 'they stored your keys. we stored memes.', '', 60], ['meme', 'Dilithium Frog', 'DFROG', 'ribbit in 2,420 bytes', '', 80]];
  const ids = []; let i = 0;
  for (const [type, name, symbol, desc, repo, dev] of T) { const w = wallet(); await post('/api/faucet', { address: w.addr }); if (repo) PROOFS[repo] = 'launcher: ' + w.addr;
    const r = await launch(w, { type, name, symbol, desc, repo: repo ? 'https://github.com/' + repo : '', devBuy: dev, image: img(i, 40 + (i * 97) % 300, 20 + (i * 61) % 120) }); if (r.error) console.log(symbol, r.error); else ids.push([symbol, r.token.id]); i++; }
  // trading: a crowd of wallets, Shor Doge graduates
  const crowd = Array.from({ length: 14 }, wallet); for (const w of crowd) await post('/api/faucet', { address: w.addr });
  const by = Object.fromEntries(ids);
  for (const w of crowd.slice(0, 10)) await trade(w, by.SHORDOGE, 'buy', 900);
  for (const [k, sym] of [[0, 'LSIGN'], [1, 'LSIGN'], [2, 'RELAY'], [3, 'LCAT'], [4, 'QUBIT'], [5, 'LSIGN'], [6, 'DFROG'], [7, 'RELAY']]) await trade(crowd[10 + (k % 4)], by[sym], 'buy', 40 + k * 15);
  await trade(crowd[11], by.LSIGN, 'sell', 2_000_000);
  console.log('seeded', ids.map((x) => x[0]).join(' '), '· open', U + '/launchpad'); console.log('IDS', JSON.stringify(by));
})().catch((e) => { console.error(e); process.exit(1); });
