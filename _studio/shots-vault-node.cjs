// Vaults + browser-validator captures/E2E against a local server: node shots-vault-node.cjs http://localhost:8299
// Co-signers 2 and 3 are real ML-DSA-44 keys held by this script (node:crypto); signer 1 is the browser wallet.
const { open, sleep } = require('./cdp.cjs'); const crypto = require('crypto'); const U = process.argv[2] || 'http://localhost:8299';
const sha3 = (b) => crypto.createHash('sha3-256').update(b).digest('hex'), canon = (o) => JSON.stringify(o, Object.keys(o).sort()), CH = 'quantumproof-testnet-1';
const mk = () => { const k = crypto.generateKeyPairSync('ml-dsa-44'), pub = Buffer.from(k.publicKey.export({ format: 'jwk' }).pub, 'base64url').toString('hex'); return { k, pub, addr: 'qpf1' + sha3(Buffer.from(pub, 'hex')).slice(0, 40), sign: (m) => crypto.sign(null, Buffer.from(m), k.privateKey).toString('hex') }; };
const post = async (p, b) => (await fetch(U + p, { method: 'POST', body: JSON.stringify(b) })).json();
(async () => { const B = mk(), C = mk(); const S = (c, n) => c.shot('shots-new/' + n + '.png');
  // ---- vaults
  const c = await open(U + '/wallet', 1280, 1100, 9741); await sleep(4000);
  await c.ev(`(async()=>{document.getElementById('gen').click();await new Promise(r=>setTimeout(r,2500));document.getElementById('fau').click();await new Promise(r=>setTimeout(r,1500));return 1})()`);
  await c.ev(`location.href='${U}/vault'`); await sleep(2000); for (let i = 0; i < 40 && !/^qpf1/.test(await c.ev(`document.getElementById('me').textContent`)); i++) await sleep(500); await sleep(800); const me = await c.ev(`document.getElementById('me').textContent`);
  await c.ev(`document.getElementById('vn').value='QuantumProof Treasury';document.getElementById('vs').value='${B.addr} ${C.addr}'.replace(' ','\\n');document.getElementById('vs').oninput();document.getElementById('vt').value='2'`); await sleep(300); await S(c, 'vault-create');
  await c.ev(`document.getElementById('mk').click()`); await sleep(2500); console.log('me', me, 'msg', await c.ev(`document.getElementById('msg').textContent+' | '+document.getElementById('vs').value`)); const va = (await (await fetch(U + '/api/vaults?member=' + me)).json()).vaults[0].addr; console.log('vault', va);
  await c.ev(`document.getElementById('d_${va}').value='600';deposit('${va}')`); await sleep(9000);
  const recip = 'qpf1' + 'ab'.repeat(20);
  await c.ev(`document.getElementById('pt_${va}').value='${recip}';document.getElementById('pa_${va}').value='250';document.getElementById('pm_${va}').value='grant: audit firm';propose('${va}',0)`); await sleep(2500);
  await c.ev('document.activeElement.blur();scrollTo(0,300)'); await sleep(5500); await S(c, 'vault-pending');
  const pr = (await (await fetch(U + '/api/vault/' + va)).json()).proposals[0]; console.log('pending', pr.status, pr.approvals.length);
  console.log('forged', await post('/api/vault/approve', { vault: va, pid: 0, from: B.addr, pub: B.pub, sig: C.sign('x') }));
  console.log('stranger', await post('/api/vault/approve', { vault: va, pid: 0, from: mk().addr, pub: B.pub, sig: B.sign('x') }));
  const r = await post('/api/vault/approve', { vault: va, pid: 0, from: B.addr, pub: B.pub, sig: B.sign(canon({ amount: 250, chain: CH, kind: 'vault-approve', pid: 0, to: recip, vault: va })) }); console.log('approve2', r.proposal && r.proposal.status);
  await sleep(5500); await c.ev('scrollTo(0,300)'); await sleep(500); await S(c, 'vault-exec');
  const v = await (await fetch(U + '/api/vault/' + va)).json(), rc = await (await fetch(U + '/api/account/' + recip)).json(); console.log('vault bal', v.balance, 'recipient', rc.balance);
  await sleep(4000); const h = await c.ev(`fetch('/api/blocks?n=20').then(r=>r.json()).then(async bs=>{for(const b of bs){const x=await (await fetch('/api/block/'+b.height)).json();if(x.txList.some(t=>t.kind==='vault-execute'))return b.height}})`);
  const tx = (await (await fetch(U + '/api/block/' + h)).json()).txList.find((t) => t.kind === 'vault-execute'); console.log('exec tx', h, tx.detail);
  await c.ev(`location.href='${U}/explorer/account/${va}'`); await sleep(4000); await S(c, 'vault-explorer'); c.close();
  // ---- browser validator
  const d = await open(U + '/node', 1280, 1100, 9757); await sleep(5000); await S(d, 'node-start');
  await d.ev(`document.getElementById('nm').value='Lattice Larry';document.getElementById('go').click()`); await sleep(26000); await S(d, 'node-running');
  console.log('node', await d.ev(`document.getElementById('c1').textContent+' signed / '+document.getElementById('c2').textContent+' proposed / rank '+document.getElementById('c4').textContent`));
  const vs = await (await fetch(U + '/api/validators')).json(); console.log('community', JSON.stringify(vs.community.map((x) => [x.name, x.browser, x.online, x.attested, x.produced, x.missed])));
  d.close(); })().catch((e) => { console.error(e); process.exit(1); });
