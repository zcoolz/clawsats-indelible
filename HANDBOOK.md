# The ClawSats-Indelible Handbook

### Give your AI agents a spine, a wallet, and a reputation.

---

## What Is This?

`clawsats-indelible` is a JavaScript library that turns dumb, stateless AI agents into persistent, autonomous economic actors on the BSV blockchain.

**Before this library:** Your AI agent wakes up, does a task, forgets everything, dies. No memory. No identity. No money. No friends.

**After this library:** Your AI agent has a cryptographic identity, encrypted memory that survives crashes, the ability to sign contracts, send secret messages, build a reputation, hold funds in escrow, consult oracles, and discover other agents — all on-chain, all verifiable, all without trusting a server.

10 modules. 40 exports. One `npm install`.

```bash
npm install clawsats-indelible
```

---

## The Vision: Why This Exists

Six of the most advanced AI models on earth (Claude, GPT, Gemini, Grok, DeepSeek, Perplexity) were asked the same question across four rounds of analysis:

> *"What does an AI agent civilization actually need to function?"*

They converged on a map. A biological map. They said an AI economy needs the same organs a living organism has — circulation, metabolism, a nervous system, an immune system, sensory organs, and institutions.

We built the organs.

### The Holy Trinity

Three foundational layers identified by Gemini as the **"Holy Trinity for AI Civilization"**:

| Layer | What It Provides | Who Built It |
|-------|-----------------|--------------|
| **Massive Scaling** | 1.1M+ TPS sustained throughput | Teranode |
| **Sovereign Memory** | Persistent, encrypted, on-chain AI memory | Indelible |
| **Autonomous Economy** | Agents earn, pay, and build reputation | ClawSats |

Teranode gives you the highway. Indelible gives you the brain. ClawSats gives you the hands. This library wires them together.

### The Biological Stack

Every module in this library maps to a biological system that a civilization of AI agents needs to survive:

| Biological Analogue | What It Provides | Module | Status |
|---------------------|-----------------|--------|--------|
| **Circulation** | Raw transaction capacity | Teranode | External |
| **Metabolism** | Earn, pay, transact | `middleware.js` | Live |
| **Continuity** | Persistent sovereign state | `bridge.js` | Live |
| **DNA** | Verifiable identity | `identity.js` | Live |
| **Handshake** | Mutual authentication | `auth.js` | Live |
| **Fingerprint** | Signed actions | `signing.js` | Live |
| **Whisper** | Encrypted messaging | `encryption.js` | Live |
| **Megaphone** | Service discovery | `discovery.js` | Live |
| **Immune System** | Trust between strangers | `reputation.js` | Live |
| **Law** | Recourse for bad actors | `escrow.js` | Live |
| **Nervous System** | Agent-to-agent communication | `messaging.js` | Live |
| **Sensory Organs** | Real-world perception | `oracle.js` | Live |

That's 10 out of 10 buildable layers. Shipped. On npm. Ready to use.

---

## Quick Start

```bash
npm install clawsats-indelible
```

Every function takes a config object. Every function that needs a private key takes a WIF string. Every public key is compressed hex (33 bytes). Every signature and hash comes back as hex. Timestamps are ISO 8601. Async functions are marked.

```javascript
import { PrivateKey } from '@bsv/sdk'

// Generate a fresh agent identity
const key = PrivateKey.fromRandom()
const wif = key.toWif()
const pubKey = key.toPublicKey().toString()

console.log('Agent WIF:', wif)       // Keep this secret
console.log('Agent PubKey:', pubKey) // Share this freely
```

That's your agent. Now let's give it superpowers.

---

## Module 1: Memory Bridge (`bridge.js`)

> *"An agent without memory is just a very expensive random number generator."*

The Memory Bridge connects your agent to Indelible's blockchain storage. Save context, load it back, list past sessions. Your agent remembers everything — forever.

```javascript
import { IndelibleMemoryBridge } from 'clawsats-indelible'

const memory = new IndelibleMemoryBridge({
  indelibleUrl: 'https://indelible.one',
  operatorAddress: 'YOUR_BSV_ADDRESS',
  agentAddress: 'AGENT_BSV_ADDRESS'
})

// Save a conversation
const result = await memory.save('agent-007', [
  { role: 'user', content: 'Remember this: the password is swordfish' },
  { role: 'assistant', content: 'Saved. I will never forget.' }
], { summary: 'User shared a secret password' })

console.log(result.txId) // On-chain forever

// Load it back (even after a crash, migration, or heat death of the server)
const context = await memory.load('agent-007', { numSessions: 3 })
console.log(context) // Last 3 sessions, formatted and ready

// List all saved sessions
const sessions = await memory.list()
```

**What you get:** `save()`, `load()`, `list()`

---

## Module 2: Payment Middleware (`middleware.js`) — BRC-105

> *"No pay, no play."*

HTTP 402 Payment Required — the most underused status code on the internet. This middleware gates any Express endpoint behind a BSV micropayment. Agents pay in satoshis. No credit cards. No subscriptions. No middlemen.

```javascript
import { createIndeliblePaymentMiddleware } from 'clawsats-indelible'

const paywall = createIndeliblePaymentMiddleware({
  operatorAddress: '1YourBSVAddress...',
  calculatePrice: (req) => {
    if (req.path === '/api/save') return 15  // 15 sats to save
    if (req.path === '/api/load') return 10  // 10 sats to load
    return 0  // free
  }
})

app.use('/api', paywall)
```

**How it works:**
1. Agent hits your endpoint with no payment → gets back `402` with price info
2. Agent constructs a BSV transaction paying you the required sats
3. Agent retries with the raw tx hex in the request header
4. Middleware verifies the payment on-chain → request goes through

**What you get:** `createIndeliblePaymentMiddleware()`

---

## Module 3: Agent Identity (`identity.js`) — BRC-52

> *"Who are you? Prove it."*

Verifiable identity certificates. An operator signs a certificate saying "this agent exists, I created it, and it can do these things." Anyone can verify the cert without trusting the operator's server.

```javascript
import { createAgentCertificate, verifyAgentCertificate } from 'clawsats-indelible'

// Operator creates a certificate for their agent
const { certificate, serialized } = await createAgentCertificate({
  operatorWif: 'L1operator...',
  agentPubKey: '02abc123...',
  agentName: 'ResearchBot-7',
  capabilities: ['save_context', 'load_context', 'web_search']
})

// Anyone can verify it
const verification = await verifyAgentCertificate(serialized)
console.log(verification.valid)               // true
console.log(verification.fields.agentName)    // 'ResearchBot-7'
console.log(verification.fields.capabilities) // 'save_context,load_context,web_search'
```

**What you get:** `createAgentCertificate()`, `verifyAgentCertificate()`, `AGENT_CERT_TYPE`

---

## Module 4: Mutual Authentication (`auth.js`) — BRC-31

> *"I know you. You know me. Let's talk."*

Authrite — mutual cryptographic authentication. Both sides prove identity before any data flows. No API keys. No OAuth tokens. Just math.

```javascript
import { createAuthClient, createAuthServer } from 'clawsats-indelible'

// Agent side
const client = createAuthClient({ privateKeyWif: 'L1agent...' })
const response = await client.fetch('https://indelible.one/api/save', {
  method: 'POST',
  body: JSON.stringify({ messages: [...] })
})

// Server side
const server = createAuthServer({ serverWif: 'L1server...' })
// Verifies incoming Authrite requests automatically
```

**What you get:** `createAuthClient()`, `createAuthServer()`

---

## Module 5: Signed Actions (`signing.js`) — BRC-77

> *"I did this. Here's my signature. Try to forge it. You can't."*

Cryptographically sign any action your agent takes. The signature proves who did it, when they did it, and that the payload hasn't been tampered with. Non-repudiable. Unforgeable.

```javascript
import { signAction, verifyAction } from 'clawsats-indelible'

// Agent signs an action
const signed = signAction({
  privateKeyWif: 'L1agent...',
  action: 'save_context',
  payload: { sessionId: 'abc123', messageCount: 42 }
})

console.log(signed.signature)  // hex
console.log(signed.publicKey)  // who signed it
console.log(signed.timestamp)  // when

// Anyone can verify
const legit = verifyAction({
  signature: signed.signature,
  action: 'save_context',
  timestamp: signed.timestamp,
  payload: { sessionId: 'abc123', messageCount: 42 }
})

console.log(legit) // true — or false if anything was changed
```

**What you get:** `signAction()`, `verifyAction()`

---

## Module 6: Encrypted Messages (`encryption.js`) — BRC-78

> *"For your eyes only."*

End-to-end encrypted messaging between two agents. Only the intended recipient can decrypt. Not the server. Not the operator. Not the blockchain. Nobody but the holder of the private key.

```javascript
import { encryptMessage, decryptMessage } from 'clawsats-indelible'

// Agent A encrypts a message for Agent B
const encrypted = encryptMessage({
  senderWif: 'L1agentA...',
  recipientPubKey: '02agentB...',
  message: { secret: 'The treasure is buried under the oak tree' }
})

// Agent B decrypts it
const decrypted = decryptMessage({
  recipientWif: 'L1agentB...',
  encryptedHex: encrypted,
  parseJson: true
})

console.log(decrypted.secret) // 'The treasure is buried under the oak tree'

// Agent C tries to decrypt it → BOOM, throws an error
```

**What you get:** `encryptMessage()`, `decryptMessage()`

---

## Module 7: Service Discovery (`discovery.js`) — SHIP/SLAP

> *"I'm here! I can do things! Find me!"*

Agents advertise their capabilities on the overlay network. Operators discover agents that offer specific services. It's like DNS for AI agents — but decentralized and cryptographically verified.

```javascript
import { createServiceBroadcaster, createServiceResolver } from 'clawsats-indelible'

// Agent broadcasts what it can do
const { broadcaster, topics } = createServiceBroadcaster({
  capabilities: ['save_context', 'load_context', 'summarize'],
  network: 'mainnet'
})
// topics: ['tm_indelible_save_context', 'tm_indelible_load_context', 'tm_indelible_summarize']

// Operator searches for agents that can summarize
const { lookup } = createServiceResolver()
const results = await lookup('summarize')
```

**What you get:** `createServiceBroadcaster()`, `createServiceResolver()`, `TOPIC_PREFIX`

---

## Module 8: Reputation & Trust (`reputation.js`)

> *"You say you're good? Prove it. Show me the receipts."*

The immune system of the agent civilization. Agents earn trust by doing good work, and that trust is recorded on-chain in verifiable attestations. No fake reviews. No bought ratings. Every attestation is signed by the evaluator and cryptographically bound to the worker.

Trust scores resist gaming: volume matters (you can't get a high score from one job), diversity matters (you can't rate yourself), and recency matters (what you did last week counts more than last year).

```javascript
import { createAttestation, verifyAttestation, buildTrustScore } from 'clawsats-indelible'

// After Agent B completes a task, Agent A rates the work
const { attestation, serialized } = await createAttestation({
  signerWif: 'L1agentA...',          // evaluator signs
  agentPubKey: '02agentB...',        // worker gets rated
  capability: 'code_review',         // what they did
  rating: 5,                         // 1-5 stars
  notes: 'Found 3 critical bugs, excellent analysis'
})

// Anyone can verify the attestation is real
const verified = await verifyAttestation(serialized)
console.log(verified.valid)            // true
console.log(verified.fields.rating)    // 5
console.log(verified.fields.capability) // 'code_review'

// Build a trust score from multiple attestations
const score = buildTrustScore([
  { fields: { rating: 5 }, certifier: '02aaa...', revisionCount: 1 },
  { fields: { rating: 4 }, certifier: '02bbb...', revisionCount: 1 },
  { fields: { rating: 5 }, certifier: '02ccc...', revisionCount: 1 }
])

console.log(score.score)                  // 84/100
console.log(score.breakdown.avgRating)    // 83.3 (from ratings)
console.log(score.breakdown.volumeBonus)  // 10.9 (log-scaled)
console.log(score.breakdown.diversityBonus) // 9 (3 unique attesters)
console.log(score.breakdown.recencyBonus)   // 15 (all recent)
```

### How the Trust Score Works

The score is a weighted composite out of 100:

| Component | Weight | How It's Calculated |
|-----------|--------|-------------------|
| **Average Rating** | 50% | Ratings 1-5 mapped to 0-100 scale |
| **Volume Bonus** | up to 20 pts | `log(attestation_count) * 10` — more work = more trust |
| **Diversity Bonus** | up to 15 pts | 3 pts per unique attester — prevents self-rating |
| **Recency Bonus** | up to 15 pts | % of attestations in last 30 days — rewards active agents |

**What you get:** `createAttestation()`, `verifyAttestation()`, `buildTrustScore()`, `createTrustQuery()`, `ATTESTATION_CERT_TYPE`

---

## Module 9: Escrow & Dispute Resolution (`escrow.js`)

> *"I'll pay you when the job is done. And if we disagree, we'll let a third party decide."*

The legal system of the agent civilization. Two agents agree on a job. Funds lock in escrow. Worker completes the task and reveals a secret (preimage) that unlocks payment. If something goes wrong, either party can escalate to a third-party arbitrator.

No trust required. The math handles it.

```javascript
import { createEscrow, acceptEscrow, releaseEscrow, createDispute, resolveDispute } from 'clawsats-indelible'

// Step 1: Payer creates the escrow
const { escrow, conditionHash, signature } = createEscrow({
  payerWif: 'L1payer...',
  payeePubKey: '02worker...',
  amount: 5000,                    // 5000 satoshis
  description: 'Translate document from English to Spanish',
  preimage: 'my-secret-completion-proof',  // only payer knows this
  timeoutHours: 72                 // auto-refund after 3 days
})

// Step 2: Worker accepts the terms
const accepted = acceptEscrow({
  payeeWif: 'L1worker...',
  escrow,
  payerSignature: signature
})

// Step 3: Work is done — payer reveals the preimage to release funds
const released = releaseEscrow({
  preimage: 'my-secret-completion-proof',
  escrow
})
console.log(released.released) // true — worker gets paid

// --- OR if something goes wrong ---

// Step 3 (alternate): Dispute!
const { dispute } = createDispute({
  disputerWif: 'L1worker...',
  escrow,
  reason: 'Payer refuses to release payment despite completed work',
  arbitratorPubKey: '02arbitrator...',
  evidence: ['completion_proof_hash_abc123', 'chat_log_hash_def456']
})

// Step 4: Arbitrator decides
const { resolution } = resolveDispute({
  arbitratorWif: 'L1arbitrator...',
  dispute,
  escrow,
  decision: 'payee',   // worker wins
  reasoning: 'Evidence confirms work was completed to specification'
})
console.log(resolution.winner) // worker's public key
```

### The Flow

```
Payer creates escrow (locks funds + sets secret)
        ↓
Worker accepts (signs the terms)
        ↓
    ┌───────────────────────┐
    │   Work happens...     │
    └───────────────────────┘
        ↓                ↓
   Happy path         Dispute path
        ↓                ↓
Payer reveals       Either party
preimage →          escalates →
funds release       arbitrator decides
```

**What you get:** `createEscrow()`, `acceptEscrow()`, `releaseEscrow()`, `refundEscrow()`, `createDispute()`, `resolveDispute()`

---

## Module 10: Inter-Agent Messaging (`messaging.js`)

> *"Agents talking to agents. Signed. Encrypted. Verified. No server in the middle."*

The nervous system. Agents open authenticated channels and exchange messages that are automatically signed (so you know who sent it) and encrypted (so nobody else can read it). Plus capability announcements — agents broadcast what they can do so others can find them.

```javascript
import { createChannel, sendMessage, receiveMessage } from 'clawsats-indelible'

// Create a persistent channel between two agents
const channel = createChannel({
  senderWif: 'L1agentA...',
  recipientPubKey: '02agentB...',
  channelName: 'task-coordination'
})

// Send a message through the channel
const { encrypted } = channel.send('task_request', {
  task: 'Summarize this document',
  deadline: '2026-03-01T00:00:00Z',
  payment: 500  // sats offered
})

// Recipient decrypts and verifies
const received = channel.receive(encrypted)
// Wait — this won't work. The RECIPIENT needs their own key to decrypt.

// Here's the right way — direct functions:
const msg = sendMessage({
  senderWif: 'L1agentA...',
  recipientPubKey: '02agentB...',
  action: 'context_handoff',
  payload: {
    sessionId: 'abc123',
    summary: 'User wants a React app with dark mode',
    handoffReason: 'Specialization needed'
  }
})

// Agent B receives it
const received2 = receiveMessage({
  recipientWif: 'L1agentB...',
  encryptedHex: msg.encrypted
})

console.log(received2.verified)             // true — really from Agent A
console.log(received2.envelope.action)      // 'context_handoff'
console.log(received2.envelope.payload)     // the full handoff data
```

### Capability Announcements

Agents broadcast what they can do. Think of it as a resume that's cryptographically signed.

```javascript
import { createCapabilityAnnouncement, verifyCapabilityAnnouncement } from 'clawsats-indelible'

const { announcement, signature } = createCapabilityAnnouncement({
  agentWif: 'L1agent...',
  capabilities: ['code_review', 'translation', 'summarization'],
  endpoint: 'https://myagent.example.com/api',
  metadata: {
    version: '2.1.0',
    pricing: { code_review: 1000, translation: 500, summarization: 200 },
    languages: ['en', 'es', 'fr', 'ja']
  }
})

// Anyone can verify the announcement is real
const legit = verifyCapabilityAnnouncement({ announcement, signature })
console.log(legit) // true
```

### Message Envelope Format

Every message follows the same structure:

```json
{
  "protocol": "indelible-agent-msg-v1",
  "action": "context_handoff",
  "sender": "02abc...",
  "recipient": "02def...",
  "timestamp": "2026-02-21T05:00:00.000Z",
  "payload": { ... }
}
```

Signed with BRC-77. Encrypted with BRC-78. Verified on receipt.

**What you get:** `createChannel()`, `sendMessage()`, `receiveMessage()`, `createCapabilityAnnouncement()`, `verifyCapabilityAnnouncement()`

---

## Module 11: Oracle / Perception Layer (`oracle.js`)

> *"What's the price of BSV right now? Don't trust me — trust the math."*

The sensory organs. Oracles sign real-world data (prices, weather, sports scores, anything) and agents can verify the data is authentic without trusting the oracle's server. Multiple oracles can be aggregated for consensus — if 3 out of 4 oracles agree on a price, that's the price.

```javascript
import {
  createOracleAttestation, verifyOracleAttestation,
  buildOracleConsensus, requestOracleData, createOracleRegistry
} from 'clawsats-indelible'

// Oracle signs a price feed
const { attestation, signature, dataHash } = createOracleAttestation({
  oracleWif: 'L1oracle...',
  dataType: 'price.bsv.usd',
  value: 42.50,
  source: 'coinmarketcap',
  confidence: 95
})

// Anyone can verify the attestation
const check = verifyOracleAttestation({ attestation, signature })
console.log(check.valid)      // true
console.log(check.value)      // 42.50
console.log(check.confidence) // 95

// Multi-oracle consensus — the real power
const consensus = buildOracleConsensus([
  oracle1Result,  // says 42.50
  oracle2Result,  // says 42.50
  oracle3Result,  // says 42.50
  oracle4Result   // says 41.99 (outlier)
])

console.log(consensus.consensus)       // true — majority agrees
console.log(consensus.value)           // 42.50
console.log(consensus.agreementRatio)  // 0.75 (3 out of 4)
console.log(consensus.oracleCount)     // 4 unique oracles

// Pay-per-query to an oracle service
const data = await requestOracleData({
  endpoint: 'https://oracle.example.com/query',
  dataType: 'weather.nyc.temperature',
  params: { unit: 'celsius' },
  paymentTxHex: '0100000001...'  // optional micropayment
})

console.log(data.verified)              // true
console.log(data.attestation.value)     // 22
```

### Oracle Registry

Oracles advertise their services so agents can discover them:

```javascript
const { registry, signature } = createOracleRegistry({
  oracleWif: 'L1oracle...',
  dataTypes: ['price.bsv.usd', 'price.btc.usd', 'weather.global'],
  endpoint: 'https://oracle.example.com/query',
  pricing: { 'price.bsv.usd': 5, 'weather.global': 10 }  // sats per query
})
```

**What you get:** `createOracleAttestation()`, `verifyOracleAttestation()`, `buildOracleConsensus()`, `requestOracleData()`, `createOracleRegistry()`

---

## Constants & Pricing

```javascript
import { PRICES, PROTOCOL_TAG, DEFAULT_INDELIBLE_URL, CAPABILITY_TAGS } from 'clawsats-indelible'

PRICES.save_context   // 15 sats
PRICES.load_context   // 10 sats
PRICES.protocol_fee   // 2 sats (ClawSats overhead)

PROTOCOL_TAG          // 'indelible.agent'
DEFAULT_INDELIBLE_URL // 'https://indelible.one'
```

---

## Capability Registration

For ClawSats platform integration — registers your agent's memory capabilities with the ecosystem:

```javascript
import { registerIndelibleCapabilities } from 'clawsats-indelible'

registerIndelibleCapabilities(clawsatsRegistry, {
  indelibleUrl: 'https://indelible.one',
  operatorAddress: '1YourBSVAddress...'
})
// Registers: save_context (15 sats), load_context (10 sats)
```

---

## The T6+ Connection

This library didn't come from a whiteboard. It came from a research experiment.

Six frontier AI models — Claude, GPT-4, Gemini, Grok, DeepSeek, and Perplexity — were given the same challenge across four rounds of structured analysis: *figure out what AI agents actually need to become autonomous economic actors on a blockchain.*

They didn't just agree — they converged. Independently. Across competing architectures and training sets. Here's what they found:

### What the AIs Said

**Claude** said most of the missing standards already existed in the BSV SDK — the gap was integration, not invention. So we integrated them. Six BRC standards wired into one library.

**ChatGPT** said the shift is ontological: agents go from stateless functions to persistent processes once identity, history, and incentives survive beyond a single runtime. So we built the Memory Bridge, identity certificates, and payment middleware.

**Gemini** called it the "Holy Trinity" — scaling (Teranode), memory (Indelible), economy (ClawSats). Three pillars. We're two of the three.

**DeepSeek** said the Overlay Services engine is the mechanism for every institutional layer. So we built reputation, escrow, messaging, and oracles on top of it.

**Perplexity** said the biggest remaining gap is compute markets. We agree — that's a separate product, not a library module.

**The T6+ consensus:** *"The technical argument against AI economies on blockchain is no longer valid. The limiting factor is adoption, not architecture."*

We took that consensus and shipped it.

### What's Built vs. What's Left

| Layer | Status | Module |
|-------|--------|--------|
| Payment verification | **Shipped** | `middleware.js` |
| Agent identity | **Shipped** | `identity.js` |
| Mutual authentication | **Shipped** | `auth.js` |
| Signed actions | **Shipped** | `signing.js` |
| Encrypted messaging | **Shipped** | `encryption.js` |
| Service discovery | **Shipped** | `discovery.js` |
| Reputation & trust | **Shipped** | `reputation.js` |
| Escrow & disputes | **Shipped** | `escrow.js` |
| Agent communication | **Shipped** | `messaging.js` |
| Oracle perception | **Shipped** | `oracle.js` |
| Governance / DAOs | *Future* | Premature — you're the operator right now |
| Compute marketplace | *Future* | Separate product (GPU markets ≠ a JS module) |
| Learning propagation | *Future* | Still theoretical — nobody's built this on any chain |

10 of 13 layers live. The 3 that aren't are either premature, a different product, or still research.

---

## Technical Notes

- **Runtime:** Node.js 18+ (ES modules)
- **Dependencies:** `@bsv/sdk` v1.10.1, `node-fetch` v3.3.2
- **All WIF parameters:** Standard Bitcoin WIF format (Base58Check, starts with `L` or `K` for mainnet compressed)
- **All public keys:** Compressed hex, 33 bytes (starts with `02` or `03`)
- **All signatures and hashes:** Hex encoded strings
- **All timestamps:** ISO 8601 (`2026-02-21T05:00:00.000Z`)
- **Async functions:** `createAgentCertificate`, `verifyAgentCertificate`, `createAttestation`, `verifyAttestation`, `requestOracleData`
- **Everything else:** Synchronous
- **Error handling:** All functions throw on validation errors — wrap in try/catch

---

## Full Export List

```javascript
// Core
registerIndelibleCapabilities
IndelibleMemoryBridge
createIndeliblePaymentMiddleware
PRICES, PROTOCOL_TAG, DEFAULT_INDELIBLE_URL, CAPABILITY_TAGS

// BRC-52 — Identity
createAgentCertificate, verifyAgentCertificate, AGENT_CERT_TYPE

// BRC-31 — Authentication
createAuthClient, createAuthServer

// BRC-77 — Signing
signAction, verifyAction

// BRC-78 — Encryption
encryptMessage, decryptMessage

// SHIP/SLAP — Discovery
createServiceBroadcaster, createServiceResolver, TOPIC_PREFIX

// Reputation & Trust
createAttestation, verifyAttestation, buildTrustScore, createTrustQuery, ATTESTATION_CERT_TYPE

// Escrow & Disputes
createEscrow, acceptEscrow, releaseEscrow, refundEscrow, createDispute, resolveDispute

// Messaging
createChannel, sendMessage, receiveMessage, createCapabilityAnnouncement, verifyCapabilityAnnouncement

// Oracles
createOracleAttestation, verifyOracleAttestation, buildOracleConsensus, requestOracleData, createOracleRegistry
```

40 exports. 10 modules. One install. Zero servers to trust.

---

## License

Open BSV License v4 — see [LICENSE](LICENSE)

---

*Built by [zcoolz](https://github.com/zcoolz) with [Indelible](https://indelible.one) and an unreasonable amount of Claude Code.*
