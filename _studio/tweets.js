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
];
let md = `# QuantumProof X kit\n\nX: https://x.com/QuantumProofL1 · site: https://quantumproofchain.net\n\n## Bio\n\`\`\`\n${BIO}\n\`\`\`\n`, bad = 0;
T.forEach(([f, t], i) => { const n = [...t].length; if (n > 245) bad++; console.log(String(i + 1).padStart(2), n, f); md += `\n## ${i + 1}. ${f}\n\`\`\`\n${t}\n\`\`\`\n`; });
console.log('bio', BIO.length);
fs.writeFileSync(path.join(__dirname, '..', 'brand', 'X-KIT.md'), md); if (bad) { console.log('OVER LIMIT:', bad); process.exit(1); }
