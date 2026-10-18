// QPF vs other chains, feature checklist → brand/qpf-vs-chains.png
'use strict';
const fs = require('fs'), path = require('path'); const { open, sleep } = require('./cdp.cjs');
const style = fs.readFileSync(path.join(__dirname, 'src', 'qpf-keyart.html'), 'utf8').match(/<style>[\s\S]*?<\/style>/)[0];
const LOGO = '<svg viewBox="0 0 40 40" style="width:58px;height:58px"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset=".55" stop-color="#ff7a18"/><stop offset="1" stop-color="#ff3d00"/></linearGradient></defs><path d="M20 3 35 11.5v17L20 37 5 28.5v-17Z" fill="none" stroke="url(#lg)" stroke-width="2.4"/><path d="M20 3v34M5 11.5l30 17M35 11.5l-30 17" stroke="url(#lg)" stroke-width="1.2" opacity=".55"/><circle cx="20" cy="20" r="4.2" fill="url(#lg)"/></svg>';
// columns: QuantumProof, Bitcoin, Ethereum, Solana, QRL, Quantus. 1 = yes, 0 = no, 'p' = partial
const cols = [['QuantumProof', '$QPF', 1], ['Bitcoin', '$BTC'], ['Ethereum', '$ETH'], ['Solana', '$SOL'], ['QRL', '$QRL'], ['Quantus', '$QTC']];
const rows = [
  ['Post-quantum signatures', [1, 0, 0, 0, 1, 1]],
  ['NIST FIPS 204 (ML-DSA)', [1, 0, 0, 0, 0, 1]],
  ['No elliptic-curve keys on chain', [1, 0, 0, 0, 1, 1]],
  ['Validator from a browser tab', [1, 0, 0, 0, 0, 0]],
  ['Native launchpad + GitHub-verified tech', [1, 0, 0, 0, 0, 0]],
  ['Post-quantum DEX + multisig vaults', [1, 0, 0, 0, 0, 0]],
  ['Solana wallet → PQ address migration', [1, 0, 0, 0, 0, 0]],
];
const g = 'display:grid;grid-template-columns:600px repeat(6,1fr);align-items:center';
const mark = (v, me) => v ? `<span style="color:${me ? '#4dff9a' : '#a3968a'};font-size:40px;font-weight:700">✓</span>` : `<span style="color:#ff5a4d;font-size:40px;font-weight:700">✗</span>`;
const html = `<!doctype html><meta charset="utf-8">${style}<body style="width:2400px;height:1350px"><canvas id="lat" width="2400" height="1350"></canvas>
<script>(()=>{const c=document.getElementById('lat'),x=c.getContext('2d'),s=92;x.lineWidth=1.6;for(let y=-1;y<1350/(s*.866)+2;y++)for(let i=-1;i<2400/s+2;i++){const px=i*s+(y%2?s/2:0),py=y*s*.866,f=Math.max(0,Math.min(1,(px/2400-0.5)*2));if(!f)continue;x.strokeStyle='rgba(255,122,24,'+(0.13*f)+')';x.beginPath();x.moveTo(px,py);x.lineTo(px+s,py);x.moveTo(px,py);x.lineTo(px+s/2,py+s*.866);x.moveTo(px,py);x.lineTo(px-s/2,py+s*.866);x.stroke();}})()</script>
<div class="glow" style="width:900px;height:700px;right:-200px;bottom:-250px;background:rgba(255,90,0,.2)"></div>
<div style="position:absolute;left:100px;right:100px;top:70px;text-align:center"><div class="k" style="font-size:26px">// how qpf stacks up</div><div style="font-size:82px;font-weight:700;letter-spacing:-.035em;margin-top:12px">Every box. <span class="g">One chain.</span></div>
<div class="card" style="margin-top:40px;padding:28px 40px 20px;text-align:left"><div style="${g};padding-bottom:12px;border-bottom:2px solid rgba(255,122,24,.35)"><span></span>${cols.map(([n, t, me]) => `<div style="text-align:center;${me ? 'background:linear-gradient(92deg,#ffb347,#ff7a18,#ff3d00);color:#140800;border-radius:12px;padding:12px 0' : 'padding:12px 0'}"><div style="font-size:29px;font-weight:700">${n}</div><div class="m" style="font-size:18px;opacity:.75;margin-top:4px">${t}</div></div>`).join('')}</div>
${rows.map(([r, v]) => `<div style="${g};padding:14px 0;border-bottom:1px solid rgba(255,122,24,.12)"><span style="font-size:29px">${r}</span>${v.map((x, i) => `<span style="text-align:center">${mark(x, i === 0)}</span>`).join('')}</div>`).join('')}</div>
<div class="m mu" style="font-size:19px;margin-top:16px;text-align:left">QuantumProof features are live on the QuantumProof testnet; mainnet launches Mon, Oct 19, 8 PM ET. QRL signs with XMSS (hash-based, post-quantum, not FIPS 204). Quantus signs with ML-DSA.</div></div>
<div class="foot"><span class="brand">${LOGO}QUANTUMPROOF</span><span class="m mu">quantumproofchain.net · $QPF</span></div></body>`;
(async () => { const f = path.join(__dirname, 'src', 'qpf-vs-chains.html'); fs.writeFileSync(f, html);
  const c = await open('file:///' + f.split(path.sep).join('/'), 2400, 1350, 9995); await sleep(2800); await c.ev('document.fonts.ready.then(()=>1)'); await sleep(500); await c.shot(path.join(__dirname, '..', 'brand', 'qpf-vs-chains.png')); c.close(); console.log('rendered'); })();
