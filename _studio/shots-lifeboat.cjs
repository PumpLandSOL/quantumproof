// Lifeboat captures against a local server (node shots-lifeboat.cjs http://localhost:8299). Mock Phantom = real WebCrypto Ed25519 key.
const { open, sleep } = require('./cdp.cjs'); const U = process.argv[2] || 'http://localhost:8299';
(async () => { const c = await open(U + '/lifeboat', 1280, 1100, 9733); await sleep(5000);
  const S = (n) => c.shot('shots-new/' + n + '.png');
  await c.ev(`(async()=>{const B='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';const b58=u=>{let n=BigInt('0x'+[...u].map(b=>b.toString(16).padStart(2,'0')).join('')),s='';while(n>0n){s=B[Number(n%58n)]+s;n/=58n;}return s;};
  const kp=await crypto.subtle.generateKey({name:'Ed25519'},false,['sign','verify']);const pk=b58(new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey)));
  window.phantom={solana:{isPhantom:true,connect:async()=>({publicKey:{toString:()=>pk}}),signMessage:async(m)=>{await new Promise(r=>setTimeout(r,600));return {signature:new Uint8Array(await crypto.subtle.sign('Ed25519',kp.privateKey,m))}}}};return 1})()`);
  await S('lb-hero');
  await c.ev(`document.getElementById('cx').click()`); await sleep(3000); await c.ev(`document.getElementById('kg').click()`); await sleep(800); await S('lb-keys');
  await c.ev(`document.getElementById('go').click()`); await sleep(4500); await c.ev('scrollTo(0,0)'); await sleep(400); await S('lb-signed');
  await c.ev(`document.getElementById('tk').scrollIntoView({block:'center'})`); await sleep(600); await S('lb-ticket');
  await sleep(6000); const h = await c.ev(`fetch('/api/blocks?n=6').then(r=>r.json()).then(async bs=>{for(const b of bs){const x=await (await fetch('/api/block/'+b.height)).json();if(x.txList.some(t=>t.kind==='lifeboat-board'))return b.height}})`);
  await c.ev(`location.href='${U}/explorer/block/${h}'`); await sleep(4000); await S('lb-block'); console.log('block', h); c.close(); })();
