// QuantumProof Launchpad: native tokens on the QuantumProof testnet, each on a constant-product bonding curve priced in tQPF.
// Every launch, buy and sell is an ML-DSA-44 signature verified with FIPS 204 and written into the next block.
// Two kinds of launch: MEME (anyone) and TECH (needs a public GitHub repo that proves the launcher controls it).
'use strict';
module.exports = function launchpad(ctx) {
  const { S, acct, sha3, canon, CHAIN_ID, pqAuth, pushTx, ptTx, save } = ctx;
  const SUPPLY = 1_000_000_000, V_Q = 3_000, V_T = 1_073_000_000, CURVE_T = 793_100_000, GRAD_Q = 8_500; // the curve's real reserve when its last token sells
  const LAUNCH_FEE = 20, FEE_BPS = 100, MAX_DEV = 2_000, IMG_MAX = 300_000;
  const GH = process.env.GH_TOKEN || '', REVERIFY_MS = 12 * 3600e3;
  S.lp = S.lp || { tokens: {}, order: [], burned: 0, volume: 0, trades: 0 };
  const L = S.lp, T = () => Object.values(L.tokens);

  const price = (t) => t.vq / t.vt;                   // tQPF per token
  const mcap = (t) => price(t) * SUPPLY;              // fully diluted, in tQPF
  const bal = (t, a) => t.holders[a] || 0;

  // ---------- GitHub verification for TECH launches ----------
  const parseRepo = (u) => { const m = String(u || '').trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]{1,39})\/([A-Za-z0-9_.-]{1,100}?)(?:\.git)?\/?$/i); return m ? { owner: m[1], repo: m[2] } : null; };
  const gh = async (p, accept) => fetch('https://api.github.com' + p, { headers: { 'user-agent': 'QuantumProof-Launchpad', accept: accept || 'application/vnd.github+json', ...(GH ? { authorization: 'Bearer ' + GH } : {}) }, signal: AbortSignal.timeout(12000) });
  async function verifyRepo(url, addr) {
    const r = parseRepo(url); if (!r) return { ok: false, why: 'use a github.com/owner/repo link' };
    const res = await gh(`/repos/${r.owner}/${r.repo}`); if (res.status === 404) return { ok: false, why: 'repo not found or private' };
    if (res.status === 403) return { ok: false, why: 'GitHub rate limit, try again in a few minutes' }; if (!res.ok) return { ok: false, why: 'GitHub error ' + res.status };
    const j = await res.json(); if (j.private) return { ok: false, why: 'repo must be public' }; if (j.fork) return { ok: false, why: 'forks are not accepted, launch from the original repo' };
    const days = (Date.now() - Date.parse(j.pushed_at)) / 864e5; if (days > 180) return { ok: false, why: 'no commits in the last 180 days' };
    // ownership proof: the repo's README or a quantumproof.txt file must contain the launcher's qpf1 address
    let proof = false, where = '';
    for (const [p, w] of [[`/repos/${r.owner}/${r.repo}/contents/quantumproof.txt`, 'quantumproof.txt'], [`/repos/${r.owner}/${r.repo}/readme`, 'README']]) {
      const x = await gh(p, 'application/vnd.github.raw'); if (x.ok && (await x.text()).includes(addr)) { proof = true; where = w; break; } }
    const checks = { publicRepo: true, original: true, active: true, ownership: proof };
    if (!proof) return { ok: false, why: `add your address ${addr} to the repo's README or a quantumproof.txt file`, checks, repo: j.full_name };
    const score = Math.min(100, 30 + (days < 30 ? 20 : days < 90 ? 10 : 4) + Math.min(20, Math.round(Math.log10(1 + j.stargazers_count) * 8)) + (j.language ? 10 : 0) + (j.description ? 10 : 0) + (j.homepage ? 10 : 0));
    return { ok: true, checks, repo: j.full_name, url: j.html_url, stars: j.stargazers_count, forks: j.forks_count, lang: j.language || '', desc: (j.description || '').slice(0, 160), homepage: j.homepage || '', pushed: j.pushed_at, proofIn: where, score };
  }
  // tech tokens are re-checked; if the repo or the proof disappears the TECH badge is pulled
  setInterval(async () => { for (const t of T()) if (t.type === 'tech' && Date.now() - (t.tech.checked || 0) > REVERIFY_MS) {
    try { const v = await verifyRepo(t.tech.url, t.creator); t.tech = v.ok ? { ...v, checked: Date.now(), verified: true } : { ...t.tech, verified: false, why: v.why, checked: Date.now() }; save(); } catch {} } }, 600e3);

  // ---------- signed operations ----------
  const launchBody = (o) => canon({ chain: CHAIN_ID, desc: o.desc || '', devBuy: o.devBuy, from: o.from, img: o.imgHash, kind: 'lp-launch', lnonce: o.lnonce, name: o.name, repo: o.repo || '', symbol: o.symbol, type: o.type });
  const tradeBody = (o) => canon({ amount: o.amount, chain: CHAIN_ID, from: o.from, id: o.id, kind: 'lp-trade', lnonce: o.lnonce, minOut: o.minOut, side: o.side });
  function nonceOk(o) { const a = acct(o.from); a.ln = a.ln || 0; return o.lnonce === a.ln ? null : 'bad lnonce (expected ' + a.ln + ')'; }
  // the last buy before graduation is filled up to the end of the curve; the unused tQPF is refunded (returned as used < q)
  function buy(t, from, q, minOut) {
    let fee = q * FEE_BPS / 1e4, net = q - fee; const k = t.vq * t.vt; let out = t.vt - k / (t.vq + net);
    if (!t.graduated && t.sold + out > CURVE_T) { const rem = CURVE_T - t.sold; if (rem <= 0) return 'curve sold out'; out = rem; net = k / (t.vt - rem) - t.vq; fee = net * FEE_BPS / (1e4 - FEE_BPS); q = net + fee; t.graduated = Date.now(); }
    if (out < minOut) return 'slippage: would receive ' + out.toFixed(2);
    t.vq += net; t.vt -= out; t.realQ += net; t.sold += out; t.holders[from] = bal(t, from) + out;
    acct(t.creator).bal += fee / 2; t.creatorFees += fee / 2; L.burned += fee / 2; return { out, fee, used: q };
  }
  function sell(t, from, n, minOut) {
    if (bal(t, from) < n - 1e-9) return 'not enough ' + t.symbol;
    const k = t.vq * t.vt, gross = t.vq - k / (t.vt + n), fee = gross * FEE_BPS / 1e4, out = gross - fee;
    if (out < minOut) return 'slippage: would receive ' + out.toFixed(4) + ' tQPF';
    t.vq -= gross; t.vt += n; t.realQ -= gross; t.sold -= n; t.holders[from] = bal(t, from) - n; if (t.holders[from] < 1e-6) delete t.holders[from];
    acct(from).bal += out; acct(t.creator).bal += fee / 2; t.creatorFees += fee / 2; L.burned += fee / 2; return { out, fee };
  }
  function record(t, from, side, q, n, hash) { const now = Date.now(), p = price(t);
    t.trades.unshift({ hash, from, side, q, n, p, at: now }); if (t.trades.length > 80) t.trades.length = 80; t.hist.push([now, p]); if (t.hist.length > 500) t.hist.splice(0, t.hist.length - 500);
    t.vol += q; L.volume += q; L.trades++; if (!t.graduated && t.realQ >= GRAD_Q) { t.graduated = now; } }
  async function launch(o) {
    const a = acct(o.from); a.ln = a.ln || 0;
    if (!['meme', 'tech'].includes(o.type)) return 'type must be meme or tech';
    o.name = String(o.name || '').trim(); o.symbol = String(o.symbol || '').trim().toUpperCase().replace(/^\$/, ''); o.desc = String(o.desc || '').slice(0, 280);
    if (!/^.{2,32}$/.test(o.name)) return 'name: 2-32 characters'; if (!/^[A-Z0-9]{2,10}$/.test(o.symbol)) return 'ticker: 2-10 letters/digits';
    if (T().some((t) => t.symbol === o.symbol)) return '$' + o.symbol + ' is taken on QuantumProof';
    if (!/^data:image\/(png|jpeg|gif|webp);base64,/.test(o.image || '') || o.image.length > IMG_MAX) return 'add an image under 300 KB';
    o.imgHash = sha3(o.image); o.devBuy = +o.devBuy || 0; if (!(o.devBuy >= 0 && o.devBuy <= MAX_DEV)) return 'dev buy: 0 to ' + MAX_DEV + ' tQPF';
    const e = pqAuth(o, launchBody(o)); if (e) return e; const n = nonceOk(o); if (n) return n;
    if (a.bal < LAUNCH_FEE + o.devBuy - 1e-9) return 'need ' + (LAUNCH_FEE + o.devBuy) + ' tQPF (launch fee ' + LAUNCH_FEE + ' + dev buy)';
    let tech = null; if (o.type === 'tech') { const v = await verifyRepo(o.repo, o.from); if (!v.ok) return 'tech check failed: ' + v.why;
      if (T().some((t) => t.type === 'tech' && t.tech.repo && t.tech.repo.toLowerCase() === v.repo.toLowerCase())) return 'that repo already launched a token'; tech = { ...v, verified: true, checked: Date.now() }; }
    const id = 'qpf1' + sha3(launchBody(o) + o.sig).slice(0, 40), hash = sha3(launchBody(o) + o.sig);
    const t = L.tokens[id] = { id, name: o.name, symbol: o.symbol, desc: o.desc, image: o.image, type: o.type, tech, creator: o.from, created: Date.now(), links: { x: String(o.x || '').slice(0, 120), site: String(o.site || '').slice(0, 160) },
      vq: V_Q, vt: V_T, realQ: 0, sold: 0, graduated: 0, holders: {}, trades: [], hist: [[Date.now(), V_Q / V_T]], vol: 0, creatorFees: 0 };
    L.order.unshift(id); a.bal -= LAUNCH_FEE; L.burned += LAUNCH_FEE; a.ln++;
    pushTx({ hash, from: o.from, to: id, amount: LAUNCH_FEE, fee: 0, nonce: o.lnonce, kind: 'lp-launch', detail: (o.type === 'tech' ? 'TECH ' : 'MEME ') + '$' + o.symbol + ' launched', sigBytes: 2420 });
    if (o.devBuy > 0) { const r = buy(t, o.from, o.devBuy, 0); a.bal -= r.used; record(t, o.from, 'buy', o.devBuy, r.out, sha3(hash + 'dev')); }
    ptTx(o.from); save(); return { ok: true, token: view(t) };
  }
  function trade(o) {
    const t = L.tokens[o.id]; if (!t) return 'unknown token'; if (!['buy', 'sell'].includes(o.side)) return 'side must be buy or sell';
    if (!(o.amount > 0) || !isFinite(o.amount)) return 'bad amount'; if (!(o.minOut >= 0) || !isFinite(o.minOut)) return 'bad minOut';
    const e = pqAuth(o, tradeBody(o)); if (e) return e; const n = nonceOk(o); if (n) return n; const a = acct(o.from);
    let r; if (o.side === 'buy') { if (a.bal < o.amount - 1e-9) return 'insufficient tQPF'; a.bal -= o.amount; r = buy(t, o.from, o.amount, o.minOut); if (typeof r === 'string') { a.bal += o.amount; return r; } a.bal += o.amount - r.used; }
    else { r = sell(t, o.from, o.amount, o.minOut); if (typeof r === 'string') return r; }
    a.ln++; const hash = sha3(tradeBody(o) + o.sig), q = o.side === 'buy' ? r.used : r.out, nTok = o.side === 'buy' ? r.out : o.amount;
    record(t, o.from, o.side, q, nTok, hash); ptTx(o.from);
    pushTx({ hash, from: o.from, to: t.id, amount: q, fee: r.fee, nonce: o.lnonce, kind: 'lp-' + o.side, detail: `${o.side} ${Math.round(nTok).toLocaleString()} $${t.symbol} for ${q.toFixed(3)} tQPF`, sigBytes: 2420 });
    save(); return { ok: true, hash, side: o.side, tokens: nTok, tqpf: q, fee: r.fee, price: price(t), token: view(t) };
  }
  const view = (t, full) => ({ id: t.id, name: t.name, symbol: t.symbol, desc: t.desc, type: t.type, tech: t.tech && { verified: t.tech.verified, repo: t.tech.repo, url: t.tech.url, stars: t.tech.stars, lang: t.tech.lang, score: t.tech.score, pushed: t.tech.pushed, proofIn: t.tech.proofIn, why: t.tech.why },
    creator: t.creator, created: t.created, links: t.links, image: '/api/launchpad/img/' + t.id, price: price(t), mcap: mcap(t), progress: Math.min(1, t.realQ / GRAD_Q), raised: t.realQ, graduated: t.graduated, holders: Object.keys(t.holders).length, vol: t.vol, creatorFees: t.creatorFees,
    lastTrade: t.trades[0] ? t.trades[0].at : t.created, ...(full ? { trades: t.trades.slice(0, 40), hist: t.hist.slice(-300), top: Object.entries(t.holders).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([a, b]) => ({ addr: a, bal: b, pct: b / SUPPLY })) } : {}) });
  const stats = () => ({ tokens: T().length, tech: T().filter((t) => t.type === 'tech' && t.tech.verified).length, graduated: T().filter((t) => t.graduated).length, volume: L.volume, trades: L.trades, burned: L.burned,
    params: { supply: SUPPLY, launchFee: LAUNCH_FEE, feeBps: FEE_BPS, gradQ: GRAD_Q, maxDev: MAX_DEV, curveTokens: CURVE_T } });

  // ---------- http ----------
  return async function route(p, req, res, u, send, body) {
    if (!p.startsWith('/api/launchpad')) return false;
    if (p === '/api/launchpad' && req.method === 'GET') { const f = u.searchParams.get('f') || 'all', sort = u.searchParams.get('sort') || 'new';
      let list = T(); if (f === 'tech') list = list.filter((t) => t.type === 'tech' && t.tech.verified); else if (f === 'meme') list = list.filter((t) => t.type === 'meme'); else if (f === 'graduated') list = list.filter((t) => t.graduated);
      list.sort(sort === 'mcap' ? (a, b) => mcap(b) - mcap(a) : sort === 'active' ? (a, b) => ((b.trades[0] || {}).at || b.created) - ((a.trades[0] || {}).at || a.created) : sort === 'score' ? (a, b) => ((b.tech || {}).score || 0) - ((a.tech || {}).score || 0) : (a, b) => b.created - a.created);
      send(200, { stats: stats(), tokens: list.slice(0, 120).map((t) => view(t)) }); return true; }
    if (p.startsWith('/api/launchpad/img/')) { const t = L.tokens[p.slice(19)]; const m = t && /^data:(image\/[a-z]+);base64,(.+)$/.exec(t.image); if (!m) { res.writeHead(404); res.end(); return true; } res.writeHead(200, { 'content-type': m[1], 'cache-control': 'public, max-age=86400' }); res.end(Buffer.from(m[2], 'base64')); return true; }
    if (p.startsWith('/api/launchpad/token/')) { const t = L.tokens[p.slice(21)]; t ? send(200, view(t, true)) : send(404, { error: 'not found' }); return true; }
    if (p.startsWith('/api/launchpad/account/')) { const a = p.slice(23), ac = S.accounts[a] || {}; send(200, { address: a, tQPF: ac.bal || 0, lnonce: ac.ln || 0, holdings: T().filter((t) => bal(t, a) > 0).map((t) => ({ id: t.id, symbol: t.symbol, bal: bal(t, a), value: bal(t, a) * price(t) })) }); return true; }
    if (p === '/api/launchpad/verify' && req.method === 'POST') { const o = await body(); try { send(200, await verifyRepo(o.repo, String(o.address || ''))); } catch (e) { send(502, { ok: false, why: 'could not reach GitHub' }); } return true; }
    if (p === '/api/launchpad/launch' && req.method === 'POST') { const r = await launch(await body()); typeof r === 'string' ? send(400, { error: r }) : send(200, r); return true; }
    if (p === '/api/launchpad/trade' && req.method === 'POST') { const r = trade(await body()); typeof r === 'string' ? send(400, { error: r }) : send(200, r); return true; }
    return false;
  };
};
