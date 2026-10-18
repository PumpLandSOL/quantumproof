// server/migrate.js verification logic against mocked Solana getTransaction responses
const MINT = 'JCsfUhtjjHpfMuRTDk2VXTStGU2z1Uz17aWHjkPdpump', OWN = '2tgUbS9UMoQD6GkDZBiqKYCURnGrSb6ocYwRABrSJUvY', Q = 'qpf1' + 'ab'.repeat(20);
const SIG = (c) => c.repeat(88);
const mk = (o = {}) => ({ slot: 1, blockTime: 1760000000, meta: { err: o.err || null, innerInstructions: [] }, transaction: { message: { accountKeys: [{ pubkey: o.payer || OWN, signer: true }],
  instructions: [{ program: 'spl-memo', parsed: o.memo ?? 'qpf-migrate:v1:' + Q }, { program: 'spl-token-2022', parsed: { type: 'burnChecked', info: { mint: o.mint || MINT, authority: o.auth || OWN, account: 'x', tokenAmount: { amount: o.raw || '2500000000' } } } }] } } });
const TX = { [SIG('a')]: mk(), [SIG('b')]: mk({ memo: 'hello' }), [SIG('c')]: mk({ mint: 'So11111111111111111111111111111111111111112' }), [SIG('d')]: mk({ err: { x: 1 } }), [SIG('e')]: mk({ auth: '11111111111111111111111111111111' }), [SIG('f')]: mk({ raw: '1000000' }) };
global.fetch = async (u, o) => { const b = JSON.parse(o.body); return { json: async () => ({ result: b.method === 'getTransaction' ? TX[b.params[0]] || null : null }) }; };
const S = {}; const route = require('../server/migrate.js')({ S, QPF_MINT: MINT, save: () => {} });
const call = async (p, method = 'GET', b) => { let out; await route(p, { method }, null, new URL('http://x' + p), (c, o) => { out = [c, o]; }, async () => b); return out; };
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '✓' : '✗', m); };
(async () => {
  let r = await call('/api/migrate', 'POST', { sig: SIG('a'), qpf: Q }); ok(r[0] === 200 && r[1].amount === 2500 && r[1].allocation === 2500, 'valid burn+memo credits 2,500');
  r = await call('/api/migrate', 'POST', { sig: SIG('a'), qpf: Q }); ok(r[0] === 200 && S.migr.list.length === 1, 'same signature is not credited twice');
  r = await call('/api/migrate', 'POST', { sig: SIG('a').slice(0, 87) + 'z', qpf: Q }); ok(r[0] === 404, 'unknown tx → 404 (still confirming)');
  r = await call('/api/migrate', 'POST', { sig: SIG('b'), qpf: Q }); ok(r[0] === 400 && /memo/.test(r[1].error), 'no migration memo rejected');
  r = await call('/api/migrate', 'POST', { sig: SIG('c'), qpf: Q }); ok(r[0] === 400, 'wrong mint rejected');
  r = await call('/api/migrate', 'POST', { sig: SIG('d'), qpf: Q }); ok(r[0] === 400 && /failed/.test(r[1].error), 'failed tx rejected');
  r = await call('/api/migrate', 'POST', { sig: SIG('e'), qpf: Q }); ok(r[0] === 400, 'burn by someone else rejected');
  r = await call('/api/migrate', 'POST', { sig: SIG('f'), qpf: 'qpf1' + 'cd'.repeat(20) }); ok(r[0] === 400 && /different/.test(r[1].error), 'memo/address mismatch rejected');
  r = await call('/api/migrate', 'POST', { sig: SIG('f'), qpf: Q }); ok(r[0] === 200 && r[1].allocation === 2501, 'second burn adds to allocation');
  r = await call('/api/migrate'); ok(r[1].migrations === 2 && r[1].holders === 1 && r[1].migrated === 2501, 'stats');
  r = await call('/api/migrate/genesis'); ok(r[1].allocations[0].address === Q && r[1].allocations[0].amount === 2501 && r[1].proofs.length === 2, 'genesis file');
  r = await call('/api/migrate/of/' + OWN); ok(r[1].migrations.length === 2, 'lookup by Solana wallet');
  console.log(pass + '/' + (pass + fail)); process.exit(fail ? 1 : 0); })();
