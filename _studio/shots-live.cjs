const {open,sleep}=require('./cdp.cjs');
(async()=>{const c=await open('https://quantumproofchain.net/wallet',1280,800,9612);await sleep(4000);
// make a wallet, fund it, send a transfer so every page has real data
await c.ev(`(async()=>{try{localStorage.clear()}catch{};})()`);await c.ev('location.reload()');await sleep(4000);
await c.ev(`(async()=>{document.getElementById('gen').click();await new Promise(r=>setTimeout(r,2500));document.getElementById('fau').click();await new Promise(r=>setTimeout(r,1500));document.getElementById('to').value='qpf1'+'7e'.repeat(20);document.getElementById('amt').value='250';document.getElementById('send').click();await new Promise(r=>setTimeout(r,1500));return 1})()`);
await sleep(6000);await c.ev('scrollTo(0,0)');await c.shot('shots-live/02-wallet.png');
const tx=await c.ev(`(async()=>{const a=await (await fetch('/api/account/'+W.addr)).json();return a.recent[0]&&a.recent[0].block})()`);
await c.ev(`location.href='https://quantumproofchain.net/explorer/block/${tx}'`);await sleep(3500);await c.shot('shots-live/03-block.png');
await c.ev(`location.href='https://quantumproofchain.net/explorer'`);await sleep(3500);await c.shot('shots-live/04-explorer.png');
await c.ev(`location.href='https://quantumproofchain.net/'`);await sleep(5000);await c.shot('shots-live/01-landing.png');
for(const [y,n] of [[900,'05-live'],[2900,'06-layers']]){await c.ev(`scrollTo(0,${y});document.querySelectorAll('.t').forEach(t=>t.style.width=Math.max(1.2,+t.dataset.w/3309*100)+'%')`);await sleep(2500);await c.shot('shots-live/'+n+'.png');}
await c.ev(`location.href='https://quantumproofchain.net/whitepaper'`);await sleep(3500);await c.shot('shots-live/07-whitepaper.png');
c.close();console.log('block',tx);})();
