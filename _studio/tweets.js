// writes brand/X-KIT.md and checks every tweet is <= 245 chars. usage: node tweets.js
const fs = require('fs'), path = require('path');
const BIO = 'Quantum-resistant layer 1. Every block, vote and transaction signed with ML-DSA (NIST FIPS 204). Zero elliptic curves. Testnet live. $QPF';
const T = [
  ['qpf-hype-14s.mp4', `Your wallet's public key is already on-chain.

On Q-day, Shor's algorithm turns it back into your private key. BTC, ETH, SOL, NEAR: all elliptic curves.

One chain was built for it.

$QPF
quantumproofchain.net`],
  ['qpf-howitworks-29s.mp4', `How QuantumProof works in 30 seconds:

1. ML-DSA keys made in your browser
2. Every tx signature verified before it touches state
3. Every block signed by 4 validators with ML-DSA-65

Zero elliptic curves.

quantumproofchain.net`],
  ['qpf-demo-23s.mp4', `The QuantumProof testnet is live.

Make a quantum-safe wallet, claim tQPF from the faucet, send a transfer, then open the block and read all four 3,309-byte signatures yourself.

quantumproofchain.net/wallet`],
  ['qpf-keyart.png', `The chain that survives Q-day.

QuantumProof is a layer 1 where every block, every validator vote and every transaction is signed with ML-DSA, the lattice-based NIST standard.

$QPF
quantumproofchain.net`],
  ['qpf-threat.png', `Bitcoin: ECDSA
Ethereum: ECDSA
Solana: Ed25519
NEAR: Ed25519

Every one of them falls to Shor's algorithm.

QuantumProof signs with ML-DSA. No known quantum attack.

$QPF`],
  ['qpf-harvest.png', `Harvest now, break later.

Every public key you've exposed is archived forever. Q-day just decrypts the archive.

QuantumProof never publishes an elliptic-curve key. There's nothing to harvest.

$QPF`],
  ['qpf-sigsize.png', `Ed25519 signature: 64 bytes
ML-DSA-65 signature: 3,309 bytes

Small signatures are small because the math is breakable. QuantumProof is sized for real quantum security from genesis.

quantumproofchain.net`],
  ['qpf-layers.png', `Three layers. Zero elliptic curves.

Keys: ML-DSA-44, made on your device
Gate: every signature verified against FIPS 204
Consensus: ML-DSA-65 on every block

$QPF
quantumproofchain.net`],
  ['qpf-consensus.png', `Kyber. Dilithium. Falcon. Sphincs.

Four validators, four lattice keys. A block is final only when the proposer and at least two attesters sign it with ML-DSA-65.

Every 4 seconds.

$QPF`],
  ['qpf-wallet.png', `Your keys never leave your device.

The QuantumProof wallet generates an ML-DSA-44 keypair in your browser and signs every transfer locally.

Try it on testnet:
quantumproofchain.net/wallet`],
  ['qpf-explorer.png', `Don't trust "quantum-resistant." Check the bytes.

Open any QuantumProof block and read the proposer signature and every attestation: 3,309 bytes of ML-DSA-65 each.

quantumproofchain.net/explorer`],
  ['qpf-bench.png', `Measured, not promised.

ML-DSA-44 verify: 331 µs
ML-DSA-65 verify: 444 µs
Ed25519 verify: 234 µs

Quantum security for under 2× the verify cost.

$QPF
quantumproofchain.net`],
  ['qpf-vs.png', `Quantum-proof is a $28B question.

$ZEC peak: $28.0B (elliptic curves)
$QRL peak: $254.6M
$QTC peak: $46.1M
$ABEL peak: $27.4M

$QPF: ML-DSA on every block and tx. Day one.

12-mo peaks, CoinGecko`],
  ['qpf-whitepaper.png', `The QuantumProof whitepaper is live.

8 pages: the quantum threat, ML-DSA cryptography with real benchmarks, tx format, consensus and finality, roadmap.

Read it:
quantumproofchain.net/whitepaper

$QPF`],
  ['qpf-roadmap.png', `Why pump.fun first?

The community forms now while the chain scales.

NOW: $QPF live + testnet live
NEXT: open validators, public RPC
SOON: mainnet, $QPF migrates 1:1 to native QPF

Hold through the migration.

quantumproofchain.net`],
  ['qpf-launch.png', `$QPF goes live today. Sunday, October 11.

Name: QuantumProof
Ticker: $QPF
Where: pump.fun

The quantum-resistant L1. Testnet already live, every block signed with ML-DSA. Mainnet migration next.

quantumproofchain.net`],
  ['qpf-tamper-22s.mp4', `What happens if someone rewrites a QuantumProof block?

Change one tx and its SHA3-256 hash breaks. Every later block points at a parent that no longer exists. All 4 ML-DSA-65 signatures fail.

No curves to break. No sigs to forge.

$QPF`],
  ["qpf-qday-15s.mp4", `Every public key you ever exposed is sitting on-chain, waiting.

Q-day runs Shor's algorithm over the archive. BTC, ETH, SOL, NEAR: keys recovered.

QuantumProof gives it nothing to crack.

$QPF
quantumproofchain.net`],
  ["qpf-signing-21s.mp4", `One transfer on QuantumProof, start to finish:

1,312-byte ML-DSA-44 key made in your browser
2,420-byte signature, signed locally
FIPS 204 verify before state
4 validators finalize with ML-DSA-65

$QPF
quantumproofchain.net/wallet`],
  ["qpf-lattice.png", `Why lattices?

Elliptic curves hide a period. Shor finds periods in polynomial time.

ML-DSA rests on Module-LWE: recover a short secret through noise. No period to find. Best known quantum attacks stay exponential.

$QPF`],
  ["qpf-anatomy.png", `Anatomy of a QuantumProof transaction:

from: qpf1 + SHA3-256(pk)
pk: ML-DSA-44, 1,312 bytes
sig: 2,420 bytes, signed in your browser
tx id: SHA3-256

No secp256k1. No Ed25519. Nothing for Shor to grab.

$QPF`],
  ["qpf-timeline.png", `Q-day has a schedule.

1994: Shor's algorithm
2016: NIST post-quantum competition
2024: FIPS 204 (ML-DSA) final
2026: QuantumProof testnet, ML-DSA on every block
2030s: CNSA 2.0 deadlines

We started early.

$QPF`],
  ["qpf-levels.png", `Sized to NIST categories, not marketing:

ML-DSA-44 (Cat 2): wallets + txs
ML-DSA-65 (Cat 3, AES-192 class): blocks + votes
SHA3-256: hashes + addresses

Real parameters. Real bytes. Check any block.

quantumproofchain.net/explorer`],
  ['qpf-mcap.png', `$QPF at the market cap of:

$ABEL peak: 48x
$QTC peak: 82x
$QRL peak: 450x
$ZEC peak: 49,538x

QuantumProof sits at $565K with a live testnet signing every block with ML-DSA.

quantumproofchain.net`],
  ['qpf-mcap2.png', `$QPF at the market cap of:

$STRK: 1,017x
$PRL: 1,176x
$ZEC: 34,492x

PRL is a post-quantum L1 doing $660M+ on SafeTrade. QuantumProof signs every block, vote and tx with ML-DSA. It sits at $565K.

quantumproofchain.net`],
  ['qpf-vs-zec.png', `$ZEC hit a $28B market cap on elliptic-curve cryptography.

Shor's algorithm breaks every ZEC key. QuantumProof signs every tx and block with ML-DSA, 4s blocks.

$QPF at ZEC's ATH mcap: 49,538x

quantumproofchain.net`],
  ['qpf-proof-26s.mp4', `No false promises. Try the tech yourself.

Make an ML-DSA wallet, claim testnet tQPF, send a signed transfer, then open the block and read all 4 quantum-safe signatures.

quantumproofchain.net/wallet
quantumproofchain.net/explorer

$QPF`],
  ['qpf-validators.png', `The QuantumProof validator set is open on testnet.

Run one file. Stake 500 tQPF. Sign blocks with your own ML-DSA-65 key.

2 tQPF per block + fees
0.25 tQPF per attestation

Two commands to join:
quantumproofchain.net/validators

$QPF`],
  ['qpf-points-18s.mp4', `QuantumProof testnet points, Season 0 is live.

Run a validator, send transfers, report bugs. All tracked on a public leaderboard.

Points will be considered for mainnet genesis allocation. No amounts set yet.

quantumproofchain.net/points`],
  ['qpf-checklist.png', `Day one checklist.

Live:
✓ $QPF on pump.fun
✓ ML-DSA testnet + explorer
✓ Browser wallet + faucet
✓ Open validators
✓ Points Season 0

Next:
→ Multi-node gossip, public RPC
→ Audit
→ Mainnet + 1:1 migration

quantumproofchain.net`],
  ['qpf-roadmap4.png', `QuantumProof roadmap. The quantum-safe L1 is being built in public.

Phase 1 ✓ Launch, ML-DSA testnet, open validators, points
Phase 2: Multi-node network + public RPC
Phase 3: Audit + genesis spec
Phase 4: Mainnet. $QPF → native QPF 1:1

$QPF`],
  ['qpf-vs-l1s.png', `$ETH, $SOL, $ZEC, $NEAR: all signed with elliptic curves. All broken by Shor's algorithm.

$QPF signs every block and tx with ML-DSA.

$QPF at their market caps:
$NEAR: 72,186x
$ZEC: 220,880x
$SOL: 712,053x
$ETH: 3,405,639x`],
  ['qpf-scanner-21s.mp4', `Is your wallet quantum-exposed?

Paste any BTC, ETH or SOL address. We read the live chain and show if its public key is already exposed to Shor's algorithm.

Satoshi: exposed. Vitalik: exposed.

quantumproofchain.net/scan

$QPF`],
  ['qpf-forge-19s.mp4', `The Forge Challenge is live.

One ML-DSA-65 public key. The secret key was discarded at birth, nobody holds it, not even us.

Forge one valid signature and the bounty is yours.

quantumproofchain.net/forge

$QPF`],
  ['qpf-quantumdex-21s.mp4', `First look: QuantumDEX.

The premier DEX for QuantumProof Chain. Swap, pool and trade, with every swap signed ML-DSA in your browser and every block finalized post-quantum.

Coming to mainnet.

$QPF`],
  ['qpf-dex-live-21s.mp4', `We previewed QuantumDEX. Now it's live on testnet.

The first DEX where every swap is signed with ML-DSA in your browser and verified before it touches the pool. Swap, add liquidity, earn fees.

quantumproofchain.net/dex

$QPF`],
  ['qpf-lifeboat-26s.mp4', `The Lifeboat is live.

Every Solana wallet is an Ed25519 public key. Q-day reverses it.

Sign once in Phantom, once with ML-DSA, and your wallet is bound to a post-quantum address. Your $QPF sets your tier.

quantumproofchain.net/lifeboat`],
  ['qpf-vaults-22s.mp4', `Quantum Vaults are live.

Post-quantum multisig: create a 2-of-3 with your team, and every approval is an ML-DSA signature over the exact recipient and amount.

No single key. No elliptic curve.

quantumproofchain.net/vault

$QPF`],
  ['qpf-node-22s.mp4', `Your browser tab is now a validator.

Name it, press start. It generates an ML-DSA-65 key, stakes, and signs every QuantumProof block with a 3,309-byte post-quantum signature.

No install. Live leaderboard.

quantumproofchain.net/node`],
  ['qpf-checklist-day2.png', `Day two checklist.

New since day one: QuantumDEX, the Lifeboat, Quantum Vaults, browser validators, the Exposure Scanner and the Forge Challenge.

Next: gossip, public RPC, audit, mainnet, 1:1 migration.

$QPF`],
  ['qpf-mainnet-preview.png', `Mainnet preview.

ML-DSA-65 blocks. ML-DSA-44 accounts. SHA3-256. 4s blocks. Native QPF.

Day one on mainnet: $QPF migrates 1:1, Lifeboat seats carry over, QuantumDEX and Vaults from block one.

Testnet is live today.`],
  ['qpf-mainnet-hype-31s.mp4', `Mainnet is days away.

Pre-mainnet price action is simply noise. We are building the most powerful, secure quantum-proof L1 blockchain the space has ever seen.

$ZEC topped at $28B. $STRK at $1.1B.

$QPF`],
];
let md = `# QuantumProof X kit\n\nX: https://x.com/QuantumProofL1 · site: https://quantumproofchain.net\n\n## Bio\n\`\`\`\n${BIO}\n\`\`\`\n`, bad = 0;
T.forEach(([f, t], i) => { const n = [...t].length; if (n > 245) bad++; console.log(String(i + 1).padStart(2), n, f); md += `\n## ${i + 1}. ${f}\n\`\`\`\n${t}\n\`\`\`\n`; });
console.log('bio', BIO.length);
fs.writeFileSync(path.join(__dirname, '..', 'brand', 'X-KIT.md'), md); if (bad) { console.log('OVER LIMIT:', bad); process.exit(1); }
