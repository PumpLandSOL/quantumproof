// builds the page's burn message for a real $QPF holder and simulates it on Solana mainnet (no signature, no send)
const fs = require('fs'); const html = fs.readFileSync(__dirname + '/../client/migrate.html', 'utf8');
const a = html.indexOf('const B58 ='), b = html.indexOf('let SOL = null');
eval(html.slice(a, b).replace('function burnMessage', 'global.burnMessage = function').replace('function b58enc', 'global.b58enc = function'));

const R = 'https://api.mainnet-beta.solana.com', rpc = async (m, p) => (await (await fetch(R, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: m, params: p }) })).json());
(async () => { const sigs = (await rpc('getSignaturesForAddress', ['9vxJnC1er9jyK1VxUHJEV21BddEyQnVqezTs89XpZBN2', { limit: 15 }])).result;
  for (const x of sigs) { const tr = (await rpc('getTransaction', [x.signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }])).result; if (!tr) continue; const owner = tr.transaction.message.accountKeys[0];
    const oi = (await rpc('getAccountInfo', [owner, { encoding: 'base64' }])).result.value; if (!oi || oi.owner !== '11111111111111111111111111111111') continue; // need a normal wallet as fee payer
    const P = await (await fetch('http://localhost:8257/api/migrate/prep?sol=' + owner)).json(); const acc = P.accounts && P.accounts[0]; if (!acc) continue;
    const msg = burnMessage(owner, acc.pubkey, P.mint, acc.program, P.blockhash, BigInt(acc.raw) / 10n, 6, 'qpf-migrate:v1:qpf1' + 'ab'.repeat(20));
    const tx = Buffer.concat([Buffer.from([1]), Buffer.alloc(64), Buffer.from(msg)]);
    const s = await rpc('simulateTransaction', [tx.toString('base64'), { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true }]);
    console.log('owner', owner, 'held', P.held, 'program', acc.program); console.log('err', JSON.stringify(s.result.value.err)); console.log((s.result.value.logs || []).join('\n')); return; } })();
