// Launchpad E2E: real ML-DSA-44 signatures (node:crypto), real server in-process, real GitHub for the failure paths,
// a stand-in GitHub response for the success path (no public repo carries a test wallet's address).
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const DATA = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qpflp-')), 'data.json'); process.env.DATA_PATH = DATA; process.env.PORT = '8297';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m); };
const sha3 = (b) => crypto.createHash('sha3-256').update(b).digest('hex'), canon = (o) => JSON.stringify(o, Object.keys(o).sort()), CH = 'quantumproof-testnet-1';
const wallet = () => { const k = crypto.generateKeyPairSync('ml-dsa-44'), pub = Buffer.from(k.publicKey.export({ format: 'jwk' }).pub, 'base64url').toString('hex'); return { pub, addr: 'qpf1' + sha3(Buffer.from(pub, 'hex')).slice(0, 40), sign: (m) => crypto.sign(null, Buffer.from(m), k.privateKey).toString('hex') }; };
// GitHub stand-in only for repo "qpf-test/real-tool"; everything else goes to the real api.github.com
const realFetch = global.fetch; let PROOF = '';
global.fetch = async (u, o) => { u = String(u);
  if (u.startsWith('https://api.github.com/repos/qpf-test/real-tool')) {
    if (u.endsWith('/real-tool')) return new Response(JSON.stringify({ full_name: 'qpf-test/real-tool', html_url: 'https://github.com/qpf-test/real-tool', private: false, fork: false, pushed_at: new Date(Date.now() - 3 * 864e5).toISOString(), stargazers_count: 240, forks_count: 12, language: 'Rust', description: 'post-quantum signing toolkit', homepage: 'https://example.com' }), { status: 200 });
    if (u.includes('quantumproof.txt')) return new Response(PROOF, { status: PROOF ? 200 : 404 }); return new Response('# real-tool', { status: 200 }); }
  return realFetch(u, o); };
require('../server/index.js'); const U = 'http://localhost:8297';
const post = async (p, b) => { const r = await realFetch(U + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, ...(await r.json()) }; };
const get = async (p) => (await realFetch(U + p)).json();
const IMG = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '..', 'client', 'favicon.png')).toString('base64');
async function launch(w, o) { const acc = await get('/api/launchpad/account/' + w.addr), b = { desc: '', repo: '', devBuy: 0, image: IMG, ...o, lnonce: acc.lnonce, from: w.addr, pub: w.pub };
  b.sig = w.sign(canon({ chain: CH, desc: b.desc, devBuy: b.devBuy, from: w.addr, img: sha3(b.image), kind: 'lp-launch', lnonce: b.lnonce, name: b.name, repo: b.repo, symbol: b.symbol, type: b.type })); return post('/api/launchpad/launch', b); }
async function trade(w, id, side, amount, minOut = 0, tamper) { const acc = await get('/api/launchpad/account/' + w.addr), b = { id, side, amount, minOut, lnonce: acc.lnonce, from: w.addr, pub: w.pub };
  b.sig = w.sign(canon({ amount, chain: CH, from: w.addr, id, kind: 'lp-trade', lnonce: b.lnonce, minOut, side })); if (tamper) b.amount = amount * 10; return post('/api/launchpad/trade', b); }
const fund = (w) => post('/api/faucet', { address: w.addr });
(async () => { await new Promise((r) => setTimeout(r, 500));
  console.log('meme launch + trading');
  const dev = wallet(), a = wallet(), b = wallet(); for (const w of [dev, a, b]) await fund(w);
  let r = await launch(dev, { type: 'meme', name: 'Lattice Cat', symbol: 'LCAT', desc: 'the first post-quantum cat', devBuy: 100 });
  ok(r.ok && r.token.holders === 1, 'meme launched with a 100 tQPF dev buy: ' + (r.error || r.token.id.slice(0, 12)));
  const id = r.token.id;
  ok((await launch(a, { type: 'meme', name: 'Copycat', symbol: 'LCAT' })).error?.includes('taken'), 'duplicate ticker rejected');
  ok((await launch(a, { type: 'meme', name: 'No pic', symbol: 'NOPIC', image: 'x' })).error?.includes('image'), 'image required');
  const acc0 = await get('/api/launchpad/account/' + dev.addr); ok(Math.abs(acc0.tQPF - (1000 - 20 - 100 + 0.5)) < 1e-6, 'dev paid 20 fee + 100 dev buy, got back 0.5 creator fee on own buy (balance ' + acc0.tQPF + ')');
  ok((await trade(a, id, 'buy', 200, 0, true)).error?.includes('signature'), 'tampered trade rejected (ML-DSA signature fails)');
  const bt = await trade(a, id, 'buy', 200); ok(bt.ok && bt.tokens > 0, 'buy 200 tQPF → ' + Math.round(bt.tokens).toLocaleString() + ' $LCAT');
  const tok = await get('/api/launchpad/token/' + id), fee = 2; ok(Math.abs(tok.creatorFees - 1.5) < 1e-6, 'creator earned half of the 1% fee: 0.5 + 1.0 tQPF (' + tok.creatorFees + ')');
  ok((await trade(a, id, 'buy', 200, bt.tokens * 2)).error?.includes('slippage'), 'slippage guard (minOut) enforced');
  const half = bt.tokens / 2, sl = await trade(a, id, 'sell', half); ok(sl.ok && sl.tqpf > 90 && sl.tqpf < 198, 'sell half back → ' + sl.tqpf.toFixed(2) + ' tQPF (top half of the curve, minus 1% fee)');
  ok((await trade(b, id, 'sell', 1000)).error?.includes('not enough'), 'cannot sell tokens you do not hold');
  const tx = (await get('/api/blocks?n=5')); await new Promise((z) => setTimeout(z, 9000));
  const blocks = await get('/api/blocks?n=6'); let kinds = []; for (const s of blocks) { const blk = await get('/api/block/' + s.height); kinds = kinds.concat(blk.txList.map((t) => t.kind)); }
  ok(kinds.includes('lp-launch') && kinds.includes('lp-buy') && kinds.includes('lp-sell'), 'launch, buy and sell are written into blocks (' + [...new Set(kinds)].join(', ') + ')');
  console.log('graduation');
  const whales = Array.from({ length: 10 }, wallet); for (const w of whales) await fund(w); let grad = null;
  for (const w of whales) { const x = await trade(w, id, 'buy', 950); if (x.error) console.log('    whale:', x.error); if (x.token && x.token.graduated) { grad = x.token; break; } }
  ok(grad && grad.raised >= 7800, 'token graduated at ' + (grad ? Math.round(grad.raised) : '?') + ' tQPF raised');
  ok((await get('/api/launchpad?f=graduated')).tokens.some((t) => t.id === id), 'graduated tab lists it');
  console.log('tech launch: GitHub verification');
  const t1 = wallet(); await fund(t1);
  let v = await post('/api/launchpad/verify', { repo: 'https://github.com/PumpLandSOL/quantumproof', address: t1.addr });
  ok(!v.ok && v.checks && v.checks.publicRepo && v.checks.ownership === false, 'REAL GitHub: public repo found, ownership proof missing → blocked: ' + (v.why || '').slice(0, 60));
  v = await post('/api/launchpad/verify', { repo: 'https://github.com/PumpLandSOL/definitely-not-a-repo-xyz', address: t1.addr }); ok(!v.ok && /not found/.test(v.why), 'REAL GitHub: missing repo → ' + v.why);
  v = await post('/api/launchpad/verify', { repo: 'gitlab.com/x/y', address: t1.addr }); ok(!v.ok && /github\.com/.test(v.why), 'non-GitHub link rejected');
  ok((await launch(t1, { type: 'tech', name: 'Real Tool', symbol: 'TOOL', repo: 'https://github.com/qpf-test/real-tool' })).error?.includes('quantumproof.txt'), 'tech launch blocked until the repo carries the launcher address');
  PROOF = 'launcher: ' + t1.addr;
  v = await post('/api/launchpad/verify', { repo: 'https://github.com/qpf-test/real-tool', address: t1.addr }); ok(v.ok && v.score >= 80 && v.proofIn === 'quantumproof.txt', 'proof present → verified, Tech Score ' + v.score);
  r = await launch(t1, { type: 'tech', name: 'Real Tool', symbol: 'TOOL', repo: 'https://github.com/qpf-test/real-tool', devBuy: 50 }); ok(r.ok && r.token.type === 'tech' && r.token.tech.verified, 'tech token launched with the TECH ✓ badge');
  const t2 = wallet(); await fund(t2); PROOF = 'launcher: ' + t1.addr + '\n' + t2.addr;
  ok((await launch(t2, { type: 'tech', name: 'Clone', symbol: 'CLONE', repo: 'https://github.com/qpf-test/real-tool' })).error?.includes('already launched'), 'one token per repo');
  const lt = await get('/api/launchpad?f=tech&sort=score'); ok(lt.tokens.length === 1 && lt.tokens[0].symbol === 'TOOL', 'Tech tab shows only verified tech');
  ok(lt.stats.tokens === 2 && lt.stats.graduated === 1 && lt.stats.burned > 20, `stats: ${lt.stats.tokens} tokens, ${lt.stats.graduated} graduated, ${lt.stats.burned.toFixed(1)} tQPF burned`);
  ok((await realFetch(U + '/launchpad')).status === 200 && (await (await realFetch(U + '/api/launchpad/img/' + id)).arrayBuffer()).byteLength > 100, 'page + token image served');
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
