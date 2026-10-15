// shared nav/footer + helpers for every QuantumProof page
const LOGO = '<svg viewBox="0 0 40 40"><defs><linearGradient id="lgo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset=".55" stop-color="#ff7a18"/><stop offset="1" stop-color="#ff3d00"/></linearGradient></defs><path d="M20 3 35 11.5v17L20 37 5 28.5v-17Z" fill="none" stroke="url(#lgo)" stroke-width="2.4"/><path d="M20 3v34M5 11.5l30 17M35 11.5l-30 17" stroke="url(#lgo)" stroke-width="1.2" opacity=".55"/><circle cx="20" cy="20" r="4.2" fill="url(#lgo)"/></svg>';
function chrome(active) {
  const n = document.createElement('nav'); n.className = 'top';
  n.innerHTML = `<div class="wrap"><a class="brand" href="/">${LOGO}QuantumProof</a><div class="links">${[['/lifeboat', 'Lifeboat'], ['/dex', 'DEX'], ['/vault', 'Vaults'], ['/explorer', 'Explorer'], ['/wallet', 'Wallet'], ['/node', 'Run a Node'], ['/points', 'Points'], ['/scan', 'Scanner'], ['/forge', 'Forge']].map(([h, l]) => `<a href="${h}" class="${active === h ? 'on' : ''}">${l}</a>`).join('')}</div><div class="sp"></div><span class="pill"><span class="dot"></span><span id="navh">testnet</span></span><a class="btn pri" href="/wallet">Open Wallet</a></div>`;
  document.body.prepend(n);
  const f = document.createElement('footer');
  f.innerHTML = `<div class="wrap"><span class="brand" style="font-size:14px">${LOGO}QuantumProof</span><span>Quantum-resistant L1 · ML-DSA (FIPS 204) · SHA3-256</span><div class="sp"></div><a href="/docs">Docs</a><a href="/whitepaper">Whitepaper</a><a href="/explorer">Explorer</a><a href="https://x.com/QuantumProofL1" target="_blank">X</a></div>`;
  document.body.append(f);
  setInterval(tickH, 4000); tickH();
}
async function tickH() { try { const s = await (await fetch('/api/stats')).json(); const e = document.getElementById('navh'); if (e) e.textContent = 'block #' + s.height.toLocaleString(); } catch {} }
const short = (h, a = 8, b = 6) => h ? h.slice(0, a) + '…' + h.slice(-b) : '';
const ago = (t) => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? s + 's ago' : s < 3600 ? Math.round(s / 60) + 'm ago' : Math.round(s / 3600) + 'h ago'; };
function toast(m) { let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t); } t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); }
function copy(v) { navigator.clipboard.writeText(v).then(() => toast('Copied')); }
