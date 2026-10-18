// launchpad captures from the seeded local board: node shots-launchpad.cjs <LSIGN id> <SHORDOGE id>
const { open, sleep } = require('./cdp.cjs'); const [, , LSIGN, DOGE] = process.argv, U = 'http://localhost:8299';
(async () => { const c = await open('about:blank', 1280, 1100, 9977); const go = async (p, w = 5000) => { await c.send('Page.navigate', { url: U + p }); await sleep(w); };
  // a browser wallet so the launch modal shows a real address
  await go('/wallet'); await c.ev(`(async()=>{document.getElementById('gen').click();await new Promise(r=>setTimeout(r,2500));document.getElementById('fau').click();return 1})()`); await sleep(2500);
  await go('/launchpad', 6000); await c.shot('shots-new/lp-board.png');
  await c.ev('scrollTo(0,520)'); await sleep(700); await c.shot('shots-new/lp-grid.png');
  await c.ev(`openToken('${LSIGN}');1`); await sleep(2500); await c.shot('shots-new/lp-tech.png');
  await c.ev(`closeDr();openToken('${DOGE}');1`); await sleep(2500); await c.ev(`document.getElementById('amt').value='250';document.getElementById('amt').oninput();1`); await sleep(400); await c.shot('shots-new/lp-meme.png');
  await c.ev(`closeDr();openLaunch('tech');document.getElementById('nm').value='Lattice Mesh';document.getElementById('tk').value='MESH';document.getElementById('ds').value='Post-quantum mesh networking for QuantumProof nodes.';document.getElementById('repo').value='https://github.com/PumpLandSOL/quantumproof';1`); await sleep(500);
  await c.ev(`verifyRepo()`); await sleep(5000); await c.shot('shots-new/lp-launch-tech.png');
  await c.ev(`setType('meme');document.getElementById('nm').value='Shor Doge';document.getElementById('tk').value='SHORDOGE';document.getElementById('db').value='300';document.getElementById('db').oninput();1`); await sleep(500); await c.shot('shots-new/lp-launch-meme.png');
  await go('/', 5000); await c.shot('shots-new/lp-landing.png'); c.close(); console.log('ok'); })();
