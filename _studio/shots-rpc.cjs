// Public RPC E2E + captures: node shots-rpc.cjs http://localhost:8299
const { open, sleep } = require('./cdp.cjs'); const U = process.argv[2] || 'http://localhost:8299';
const rpc = async (b) => (await fetch(U + '/rpc', { method: 'POST', body: JSON.stringify(b) })).json();
(async () => {
  console.log('single', JSON.stringify(await rpc({ jsonrpc: '2.0', id: 1, method: 'qpf_blockNumber' })));
  console.log('batch', JSON.stringify(await rpc([{ jsonrpc: '2.0', id: 1, method: 'qpf_chainId' }, { jsonrpc: '2.0', id: 2, method: 'qpf_nope' }, { jsonrpc: '2.0', id: 3, method: 'qpf_getBalance', params: ['qpf1' + '0'.repeat(40)] }])));
  console.log('badtx', JSON.stringify(await rpc({ jsonrpc: '2.0', id: 9, method: 'qpf_sendTransaction', params: [{ from: 'x' }] })));
  const c = await open(U + '/rpc', 1280, 1100, 9771); await sleep(5000);
  await c.ev(`document.getElementById('m').value='qpf_getBlock';document.getElementById('pa').value='["latest"]';document.getElementById('run').click()`); await sleep(1500); await c.shot('shots-new/rpc-play.png');
  await c.ev(`document.getElementById('qsr').click()`); for (let i = 0; i < 40 && !(await c.ev(`document.getElementById('qs').innerText`)).includes('finalized'); i++) await sleep(500); await c.ev('scrollTo(0,400)'); await sleep(700); await c.shot('shots-new/rpc-quick.png');
  console.log('quickstart', await c.ev(`document.getElementById('qs').innerText`));
  await c.ev('scrollTo(0,700)'); await sleep(600); await c.shot('shots-new/rpc-methods.png'); c.close();
})().catch((e) => { console.error(e); process.exit(1); });
