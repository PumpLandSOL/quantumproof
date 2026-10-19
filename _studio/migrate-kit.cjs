// migration announcement → brand/qpf-migrate.png
'use strict';
const fs = require('fs'), path = require('path'); const { open, sleep } = require('./cdp.cjs');
const style = fs.readFileSync(path.join(__dirname, 'src', 'qpf-keyart.html'), 'utf8').match(/<style>[\s\S]*?<\/style>/)[0];
const LOGO = fs.readFileSync(path.join(__dirname, 'ready-kit.cjs'), 'utf8').match(/const LOGO = '([^']+)'/)[1];
const step = (n, t, d) => `<div class="card" style="padding:30px 34px"><div class="m" style="font-size:22px;color:#ff7a18">${n}</div><div style="font-size:36px;font-weight:700;margin-top:10px">${t}</div><div class="mu" style="font-size:23px;line-height:1.45;margin-top:10px">${d}</div></div>`;
const html = `<!doctype html><meta charset="utf-8">${style}<body style="width:2400px;height:1350px"><canvas id="lat" width="2400" height="1350"></canvas>
<script>(()=>{const c=document.getElementById('lat'),x=c.getContext('2d'),s=92;x.lineWidth=1.6;for(let y=-1;y<1350/(s*.866)+2;y++)for(let i=-1;i<2400/s+2;i++){const px=i*s+(y%2?s/2:0),py=y*s*.866,f=Math.max(0,Math.min(1,(px/2400-0.45)*2));if(!f)continue;x.strokeStyle='rgba(255,122,24,'+(0.15*f)+')';x.beginPath();x.moveTo(px,py);x.lineTo(px+s,py);x.moveTo(px,py);x.lineTo(px+s/2,py+s*.866);x.moveTo(px,py);x.lineTo(px-s/2,py+s*.866);x.stroke();}})()</script>
<div class="glow" style="width:900px;height:700px;right:-200px;bottom:-250px;background:rgba(255,90,0,.2)"></div>
<div style="position:absolute;left:110px;right:110px;top:190px;text-align:center"><div class="k" style="font-size:26px">// migration is live</div>
<div style="font-size:96px;font-weight:700;letter-spacing:-.04em;margin-top:12px">Leave Ed25519. <span class="g">Bring your $QPF.</span></div>
<div style="display:grid;grid-template-columns:1fr 150px 1fr;align-items:center;margin-top:80px;text-align:left">
 <div class="card" style="padding:40px 46px;border-color:rgba(255,90,77,.5)"><div class="m" style="font-size:22px;letter-spacing:.2em;color:#ff8a80">SOLANA · ED25519</div><div style="font-size:92px;font-weight:700;margin-top:14px">$QPF</div><div class="mu" style="font-size:26px;margin-top:8px">SPL token · exposed public key</div></div>
 <div style="text-align:center"><div style="font-size:90px;color:#ff7a18;text-shadow:0 0 40px #ff7a18">→</div><div class="m" style="font-size:34px;font-weight:700;color:#ffb347">1 : 1</div></div>
 <div class="card" style="padding:40px 46px;border-color:#4dff9a;box-shadow:0 0 110px rgba(77,255,154,.18)"><div class="m" style="font-size:22px;letter-spacing:.2em;color:#4dff9a">QUANTUMPROOF-1 · ML-DSA</div><div style="font-size:92px;font-weight:700;margin-top:14px" class="g">QPF</div><div class="mu" style="font-size:26px;margin-top:8px">native coin · post-quantum keys</div></div></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:40px;text-align:left">${step('01', 'Connect Phantom', 'We read your live $QPF balance on Solana.')}${step('02', 'Pick your qpf1 address', 'Your ML-DSA wallet, made in the browser.')}${step('03', 'One signature', 'Transfer + your address in one transaction, verified on-chain.')}</div></div>
<div class="foot"><span class="brand">${LOGO.replace('width:58px;height:58px', 'width:58px;height:58px')}QUANTUMPROOF</span><span class="m mu">quantumproofchain.net/migrate · $QPF</span></div></body>`;
(async () => { const f = path.join(__dirname, 'src', 'qpf-migrate.html'); fs.writeFileSync(f, html);
  const c = await open('file:///' + f.split(path.sep).join('/'), 2400, 1350, 9994); await sleep(2800); await c.ev('document.fonts.ready.then(()=>1)'); await sleep(500); await c.shot(path.join(__dirname, '..', 'brand', 'qpf-migrate.png')); c.close(); console.log('rendered'); })();
