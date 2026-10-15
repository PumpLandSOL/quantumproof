// shared browser-tour scene: window.TOUR = { intro:[kick,html,sub], outro:html, scenes:[[t,kicker,title,img,path,[scrollFrom,scrollTo],hlRect|null]], end }
(function () {
  const T = window.TOUR, $ = (i) => document.getElementById(i), cl = (x) => Math.max(0, Math.min(1, x)), e = (x) => 1 - Math.pow(1 - cl(x), 3),
    es = (x) => { x = cl(x); return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }, win = (t, a, b, f = .35) => cl((t - a) / f) * cl((b - t) / f);
  const K = 900 / 1280, SC = T.scenes, END = T.end;
  document.body.insertAdjacentHTML('beforeend', `<canvas id="bg" width="1280" height="720"></canvas>
  <div class="c" id="s0"><div><div class="k">${T.intro[0]}</div><div class="d" style="font-size:68px;line-height:1.05;margin-top:16px">${T.intro[1]}</div><div class="m mu" style="font-size:18px;margin-top:20px">${T.intro[2]}</div></div></div>
  <div id="st" style="position:absolute;inset:0"><div class="cap"><div class="k" id="kk"></div><div class="d" style="font-size:30px;margin-top:8px" id="tt"></div></div>
  <div class="win"><div class="bar"><i></i><i></i><i></i><div class="url">🔒&nbsp;<b>quantumproofchain.net</b><span id="path"></span></div></div><div class="vp"><img id="im"><div class="hl" id="hl"></div></div></div></div>
  <div class="c" id="s9"><div>${T.outro}</div></div>`);
  const cv = $('bg'), x = cv.getContext('2d'), S = 64, P = []; for (let y = -1; y < 720 / (S * .866) + 2; y++) for (let i = -1; i < 1280 / S + 2; i++) P.push([i * S + (y % 2 ? S / 2 : 0), y * S * .866]);
  const imgs = [...new Set(SC.map((s) => s[3]))]; window.__ready = Promise.all(imgs.map((f) => new Promise((r) => { const i = new Image(); i.onload = r; i.src = '../shots-new/' + f; })));
  const t0 = SC[0][0];
  window.__seek = (t) => {
    x.fillStyle = '#050403'; x.fillRect(0, 0, 1280, 720); x.lineWidth = 1; for (const [px, py] of P) { x.strokeStyle = `rgba(${T.red && t > t0 && t < END ? '255,70,60' : '255,122,24'},${.05 + .03 * Math.sin(t + px * .01)})`; x.beginPath(); x.moveTo(px, py); x.lineTo(px + S, py); x.moveTo(px, py); x.lineTo(px + S / 2, py + S * .866); x.moveTo(px, py); x.lineTo(px - S / 2, py + S * .866); x.stroke(); }
    $('s0').style.opacity = win(t, 0, t0); $('st').style.opacity = win(t, t0, END); $('s9').style.opacity = e((t - END) / .5);
    let k = 0; for (let i = 0; i < SC.length; i++) if (t >= SC[i][0]) k = i; const s = SC[k], lt = t - s[0], dur = (SC[k + 1] ? SC[k + 1][0] : END) - s[0];
    $('kk').textContent = s[1]; $('tt').textContent = s[2]; $('kk').parentElement.style.opacity = e(lt / .3);
    if (!$('im').src.endsWith(s[3])) $('im').src = '../shots-new/' + s[3]; $('path').textContent = s[4];
    const p = es(lt / dur), sy = s[5][0] + (s[5][1] - s[5][0]) * p, hl = s[6];
    $('im').style.transform = `translateY(${-sy * K}px)`;
    if (hl) { const h = $('hl'); h.style.display = 'block'; h.style.left = (hl[0] * K - 4) + 'px'; h.style.top = ((hl[1] - sy) * K - 4) + 'px'; h.style.width = (hl[2] * K + 8) + 'px'; h.style.height = (hl[3] * K + 8) + 'px'; h.style.opacity = e((lt - .7) / .4); h.style.borderColor = T.hlc || '#4dff9a'; h.style.boxShadow = '0 0 24px ' + (T.hlc || '#4dff9a'); } else $('hl').style.display = 'none';
    document.querySelector('.win').style.transform = `translateY(${(1 - e((t - t0) / .6)) * 40}px)`;
  }; window.__seek(0);
})();
