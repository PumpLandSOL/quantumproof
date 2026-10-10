const {open,sleep}=require('./cdp.cjs');const fs=require('fs');
(async()=>{const c=await open('http://localhost:8256/whitepaper',816,1056,9533);await sleep(4000);await c.ev('document.fonts.ready.then(()=>1)');
const r=await c.send('Page.printToPDF',{printBackground:true,paperWidth:8.5,paperHeight:11,marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,preferCSSPageSize:true});
fs.writeFileSync('../client/quantumproof-whitepaper.pdf',Buffer.from(r.data,'base64'));
// page previews
await c.send('Emulation.setEmulatedMedia',{media:'print'});await sleep(500);
const n=await c.ev('document.querySelectorAll(".page").length');
for(let i=0;i<n;i++){await c.ev(`document.querySelectorAll(".page")[${i}].scrollIntoView()`);await sleep(300);const s=await c.send('Page.captureScreenshot',{format:'png',clip:await c.ev(`(()=>{const b=document.querySelectorAll(".page")[${i}].getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height,scale:1}})()`),captureBeyondViewport:true});fs.writeFileSync(process.env.TEMP+'/wp'+(i+1)+'.png',Buffer.from(s.data,'base64'));}
console.log('pages',n);c.close();})();
