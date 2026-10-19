// $QPF migration: Solana SPL $QPF → native QPF on quantumproof-1, 1:1.
// The holder sends $QPF on Solana (Token-2022 TransferChecked) to the migration wallet in ONE transaction that also carries a memo naming the
// destination: "qpf-migrate:v1:<qpf1 address>". Phantom signs it, so only the owner can send and only the owner picks
// the destination. The server reads the confirmed transaction from Solana, checks signer, mint, recipient, amount and memo,
// and records the allocation. Every allocation is public and goes into the quantumproof-1 genesis file.
'use strict';
module.exports = ({ S, QPF_MINT, save }) => {
  const RPCS = (process.env.SOL_RPC || 'https://api.mainnet-beta.solana.com').split(',').map((s) => s.trim()).filter(Boolean);
  const sol = async (method, params) => { let last; for (const url of RPCS) { try { const j = await (await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json(); if (j.error) { last = j.error.message; continue; } return j.result; } catch (e) { last = e.message; } } throw new Error('Solana RPC: ' + (last || 'unavailable')); };
  const DEST = process.env.MIGRATION_WALLET || 'AdjVwWTb8YiBMSsr5E6iEP8tWFixJVhnVA15rAb1Xsgt';
  const DEC = 6, MEMO_PREFIX = 'qpf-migrate:v1:';
  S.migr = S.migr || { list: [], bySig: {}, alloc: {} };
  const M = S.migr;
  const isSol = (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a || ''), isQpf = (a) => /^qpf1[0-9a-f]{40}$/.test(a || '');
  const ui = (raw) => Number(BigInt(raw)) / 10 ** DEC;
  const stats = () => { const holders = new Set(M.list.map((m) => m.sol)); const raw = M.list.reduce((s, m) => s + BigInt(m.raw), 0n);
    return { mint: QPF_MINT, wallet: DEST, decimals: DEC, memoPrefix: MEMO_PREFIX, migrations: M.list.length, holders: holders.size, addresses: Object.keys(M.alloc).length, migrated: ui(raw), migratedRaw: raw.toString(), recent: M.list.slice(-40).reverse() }; };

  async function prep(owner) {
    const [ta, bh, dt] = await Promise.all([sol('getTokenAccountsByOwner', [owner, { mint: QPF_MINT }, { encoding: 'jsonParsed', commitment: 'confirmed' }]), sol('getLatestBlockhash', [{ commitment: 'confirmed' }]), sol('getTokenAccountsByOwner', [DEST, { mint: QPF_MINT }, { encoding: 'jsonParsed' }])]);
    const dest = dt.value && dt.value[0]; if (!dest) throw new Error('migration wallet has no $QPF token account');
    const accounts = (ta.value || []).map((a) => ({ pubkey: a.pubkey, program: a.account.owner, raw: a.account.data.parsed.info.tokenAmount.amount, ui: +a.account.data.parsed.info.tokenAmount.uiAmountString })).filter((a) => a.raw !== '0').sort((a, b) => (BigInt(b.raw) > BigInt(a.raw) ? 1 : -1));
    return { owner, accounts, held: accounts.reduce((s, a) => s + a.ui, 0), blockhash: bh.value.blockhash, wallet: DEST, dest: dest.pubkey, decimals: DEC, mint: QPF_MINT };
  }

  async function record(sig, qpf) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig || '')) return [400, 'bad transaction signature'];
    if (!isQpf(qpf)) return [400, 'bad qpf1 address'];
    if (M.bySig[sig]) return [200, M.bySig[sig]];
    const t = await sol('getTransaction', [sig, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }]);
    if (!t) return [404, 'not confirmed yet'];
    if (t.meta && t.meta.err) return [400, 'transaction failed on Solana, nothing was sent'];
    const keys = t.transaction.message.accountKeys.map((k) => (typeof k === 'string' ? { pubkey: k, signer: false } : k));
    const owner = keys[0].pubkey; if (!keys[0].signer) return [400, 'fee payer did not sign'];
    const ix = t.transaction.message.instructions.concat(...((t.meta && t.meta.innerInstructions) || []).map((i) => i.instructions));
    const memo = ix.filter((i) => i.program === 'spl-memo').map((i) => (typeof i.parsed === 'string' ? i.parsed : '')).find((m) => m.startsWith(MEMO_PREFIX));
    if (!memo) return [400, 'no migration memo in this transaction'];
    if (memo.slice(MEMO_PREFIX.length) !== qpf) return [400, 'memo names a different qpf1 address'];
    const ownerOf = {}; for (const b of (t.meta && t.meta.postTokenBalances) || []) if (b.mint === QPF_MINT && keys[b.accountIndex]) ownerOf[keys[b.accountIndex].pubkey] = b.owner;
    let raw = 0n; for (const i of ix) { const p = i.parsed; if (!p || !/^spl-token/.test(i.program) || p.type !== 'transferChecked') continue;
      if (p.info.mint !== QPF_MINT || p.info.authority !== owner || ownerOf[p.info.destination] !== DEST) continue; raw += BigInt(p.info.tokenAmount ? p.info.tokenAmount.amount : p.info.amount); }
    if (raw <= 0n) return [400, 'no $QPF transfer to the migration wallet signed by the owner in this transaction'];
    const m = { sig, sol: owner, qpf, raw: raw.toString(), amount: ui(raw), slot: t.slot, at: (t.blockTime || Math.floor(Date.now() / 1000)) * 1000 };
    M.list.push(m); M.bySig[sig] = m; M.alloc[qpf] = (BigInt(M.alloc[qpf] || '0') + raw).toString(); save();
    return [200, { ...m, allocation: ui(M.alloc[qpf]) }];
  }

  return async function route(p, req, res, u, send, body) {
    if (p === '/api/migrate' && req.method === 'GET') return send(200, stats()), true;
    if (p === '/api/migrate/prep') { const o = u.searchParams.get('sol') || ''; if (!isSol(o)) return send(400, { error: 'bad Solana address' }), true;
      try { send(200, await prep(o)); } catch (e) { send(502, { error: String(e.message || e) }); } return true; }
    if (p.startsWith('/api/migrate/of/')) { const k = decodeURIComponent(p.slice(16)); const list = M.list.filter((m) => m.sol === k || m.qpf === k);
      return send(200, { key: k, migrations: list, allocation: isQpf(k) ? ui(M.alloc[k] || '0') : list.reduce((s, m) => s + m.amount, 0) }), true; }
    if (p === '/api/migrate/genesis') return send(200, { chain: 'quantumproof-1', mint: QPF_MINT, decimals: DEC, wallet: DEST, rule: '1 $QPF sent to the migration wallet on Solana = 1 QPF at genesis', allocations: Object.entries(M.alloc).map(([address, raw]) => ({ address, raw, amount: ui(raw) })).sort((a, b) => b.amount - a.amount), proofs: M.list.map((m) => m.sig) }), true;
    if (p === '/api/migrate' && req.method === 'POST') { const { sig, qpf } = await body();
      try { const [c, r] = await record(sig, qpf); send(c, typeof r === 'string' ? { error: r } : r); } catch (e) { send(502, { error: String(e.message || e) }); } return true; }
    return false;
  };
};
