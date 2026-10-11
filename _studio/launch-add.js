const fs=require('fs');let s=fs.readFileSync('kit.js','utf8');
if(!s.includes("'qpf-launch'")){
const add=`  'qpf-launch': page(2400, 1350, \`<div style="position:absolute;left:120px;top:0;bottom:170px;width:1250px;display:flex;flex-direction:column;justify-content:center">
   <div class="k" style="font-size:28px">// launch day</div>
   <div style="font-size:150px;font-weight:700;letter-spacing:-.045em;line-height:.95;margin-top:26px">$QPF goes<br><span class="g">live today.</span></div>
   <div style="display:flex;gap:22px;margin-top:50px">\${[['NAME','QuantumProof'],['TICKER','$QPF'],['WHERE','pump.fun · Solana']].map(([k,v])=>\`<div class="card" style="padding:26px 34px"><div class="m dim" style="font-size:22px">\${k}</div><div style="font-size:42px;font-weight:700;margin-top:8px">\${v}</div></div>\`).join('')}</div>
   <div class="mu" style="font-size:34px;margin-top:44px;line-height:1.45">The quantum-resistant L1 launches its token today. Testnet already live. Mainnet migration next.</div></div>
   <div style="position:absolute;right:150px;top:200px;width:760px;height:800px" class="card"><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
   <div class="m" style="font-size:34px;letter-spacing:.3em;color:#ff7a18">SUNDAY</div>
   <div style="font-size:120px;font-weight:700;letter-spacing:-.02em;margin-top:10px">OCT</div>
   <div class="g" style="font-size:340px;font-weight:700;line-height:.9;letter-spacing:-.06em">11</div>
   <div class="m mu" style="font-size:30px;margin-top:20px">2026</div>
   <div style="display:flex;align-items:center;gap:14px;margin-top:40px;padding:14px 28px;border-radius:99px;border:2px solid rgba(77,255,154,.5)"><span style="width:18px;height:18px;border-radius:50%;background:#4dff9a;box-shadow:0 0 16px #4dff9a"></span><span class="m ok" style="font-size:28px">LIVE ON PUMP.FUN</span></div></div></div>\`),
`;s=s.split("};\nconst SIZES").join(add+"};\nconst SIZES");fs.writeFileSync('kit.js',s);}
