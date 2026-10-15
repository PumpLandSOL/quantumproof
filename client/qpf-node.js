#!/usr/bin/env node
// QuantumProof validator node. Requires Node 24+ (native ML-DSA). No dependencies.
//   node qpf-node.js "Your Validator Name"
// First run creates qpf-validator.json (your ML-DSA-65 key, keep it secret), funds it from the testnet faucet,
// stakes 500 tQPF and joins the validator set. Then it signs every block header with ML-DSA-65 on this machine.
//   node qpf-node.js --exit     unstake and leave the set
'use strict';
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const RPC = process.env.QPF_RPC || 'https://quantumproofchain.net';
const KEYFILE = process.env.QPF_KEY || path.join(process.cwd(), 'qpf-validator.json');
const CHAIN = 'quantumproof-testnet-1';
if (+process.versions.node.split('.')[0] < 24) { console.error('Node 24+ required (native ML-DSA). You have ' + process.version); process.exit(1); }
const sha3 = (b) => crypto.createHash('sha3-256').update(b).digest('hex');
const canon = (o) => JSON.stringify(o, Object.keys(o).sort());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (p, body) => { const r = await fetch(RPC + p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}); return { status: r.status, ...(await r.json()) }; };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function loadKey(name) {
  if (fs.existsSync(KEYFILE)) return JSON.parse(fs.readFileSync(KEYFILE, 'utf8'));
  if (!name) { console.error('usage: node qpf-node.js "Validator Name"'); process.exit(1); }
  const k = crypto.generateKeyPairSync('ml-dsa-65');
  const pub = Buffer.from(k.publicKey.export({ format: 'jwk' }).pub, 'base64url').toString('hex');
  const key = { name, pub, addr: 'qpf1' + sha3(Buffer.from(pub, 'hex')).slice(0, 40), sk: k.privateKey.export({ format: 'pem', type: 'pkcs8' }) };
  fs.writeFileSync(KEYFILE, JSON.stringify(key, null, 1), { mode: 0o600 }); log('new ML-DSA-65 validator key ->', KEYFILE);
  return key;
}
(async () => {
  const args = process.argv.slice(2), K = loadKey(args.find((a) => !a.startsWith('--')));
  const sk = crypto.createPrivateKey(K.sk), sign = (m) => crypto.sign(null, Buffer.from(m), sk).toString('hex');
  const regSig = (kind) => sign(canon({ chain: CHAIN, kind, name: K.name, pub: K.pub }));
  log('validator', K.name, K.addr, '·', RPC);
  if (args.includes('--exit')) { log(await api('/api/validator/exit', { name: K.name, pub: K.pub, sig: regSig('exit-validator') })); return; }
  let r = await api('/api/validator/register', { name: K.name, pub: K.pub, sig: regSig('register-validator') });
  if (!r.ok && /need/.test(r.error || '')) { log('funding stake from faucet…', await api('/api/faucet', { address: K.addr })); r = await api('/api/validator/register', { name: K.name, pub: K.pub, sig: regSig('register-validator') }); }
  if (!r.ok) { log('register failed:', r.error); process.exit(1); }
  log(r.already ? 'already registered' : 'staked ' + r.stake + ' tQPF, joined the validator set');
  let last = '', n = 0;
  for (;;) {
    try {
      const p = await api('/api/pending');
      if (p.hash && p.hash !== last) {
        // recompute the header hash locally before signing: never sign a hash you did not derive yourself
        if (p.chain !== CHAIN || sha3(canon(p.header)) !== p.hash) { log('header hash mismatch, refusing to sign', p.height); last = p.hash; continue; }
        const a = await api('/api/attest', { addr: K.addr, hash: p.hash, sig: sign(p.hash) }); last = p.hash;
        if (a.ok) { n++; log(`#${p.height} ${a.proposer ? 'PROPOSED' : 'attested'} · ML-DSA-65 3,309 B · total ${n}`); }
        else if (a.status !== 409) log('#' + p.height, a.error);
      }
    } catch (e) { log('rpc error:', e.message); await sleep(3000); }
    await sleep(500);
  }
})();
