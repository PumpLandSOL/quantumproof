const {open,sleep}=require('./cdp.cjs');const path=require('path');
(async()=>{const [url,out,ys]=[process.argv[2],process.argv[3],(process.argv[4]||'0').split(',')];
const c=await open(url,1440,900,9400+Math.floor(Math.random()*400));await sleep(5000);
for(const y of ys){await c.ev(`scrollTo(0,${y});document.querySelectorAll('.t').forEach(t=>t.style.width=Math.max(1.2,+t.dataset.w/3309*100)+'%')`);await sleep(1800);await c.shot(out.replace('.png','-'+y+'.png'));}
c.close();})();
