# clawsats-indelible

Persistent blockchain memory for ClawSats AI agents — powered by [Indelible](https://indelible.one).

10 modules. 40 exports. One `npm install`.

```
npm install clawsats-indelible
```

## Architecture

Two layers, one library:

**BRC Standards Layer** — cryptographic primitives that make agents real economic actors on-chain.

| Module | Standard | What it does |
|--------|----------|--------------|
| `middleware` | BRC-105 | Payment verification middleware for Express/HTTP |
| `identity` | BRC-52 | Agent identity certificates |
| `auth` | BRC-31 | Mutual authentication (Authrite) |
| `signing` | BRC-77 | Cryptographically signed actions |
| `encryption` | BRC-78 | Encrypted agent-to-agent messaging |
| `discovery` | SHIP/SLAP | Service discovery and advertising |

**Institutional Layer** — higher-level systems built on those primitives.

| Module | What it does |
|--------|--------------|
| `reputation` | Trust scores and attestations (`buildTrustScore`, `createTrustQuery`) |
| `escrow` | Multi-party escrow with dispute resolution |
| `messaging` | Encrypted channels and capability announcements |
| `oracle` | Real-world data attestations and consensus |

Plus `bridge` (save/load agent memory), `capabilities` (capability registration), and `constants`.

## Quick Start

### Save & Load Agent Memory

```js
import { IndelibleMemoryBridge } from 'clawsats-indelible/bridge'

const bridge = new IndelibleMemoryBridge({
  indelibleUrl: 'https://indelible.one',
  operatorAddress: 'YOUR_OPERATOR_ADDRESS',
  agentAddress: 'YOUR_AGENT_ADDRESS'
})

// Save conversation to blockchain
const result = await bridge.save('my-agent', messages, {
  summary: 'Customer support session'
})

// Load previous context
const context = await bridge.load('my-agent', { numSessions: 3 })
```

### Agent Identity (BRC-52)

```js
import { createAgentCertificate, verifyAgentCertificate } from 'clawsats-indelible/identity'

const cert = await createAgentCertificate({
  operatorWif: 'OPERATOR_PRIVATE_KEY',
  agentPubKey: 'AGENT_PUBLIC_KEY',
  agentName: 'MyAgent',
  capabilities: ['save_context', 'load_context']
})

const verified = await verifyAgentCertificate(cert.serialized)
// { valid: true, fields: { agentName: 'MyAgent', capabilities: [...] } }
```

### Signed Actions (BRC-77)

```js
import { signAction, verifyAction } from 'clawsats-indelible/signing'

const signed = signAction({
  privateKeyWif: 'AGENT_PRIVATE_KEY',
  action: 'save_context',
  payload: { summary: 'Session data', messageCount: 5 }
})

const valid = verifyAction({
  signature: signed.signature,
  action: signed.action,
  timestamp: signed.timestamp,
  payload: { summary: 'Session data', messageCount: 5 }
})
```

### Encrypted Messaging (BRC-78)

```js
import { encryptMessage, decryptMessage } from 'clawsats-indelible/encryption'

// Agent 1 encrypts
const encrypted = encryptMessage({
  senderWif: 'SENDER_PRIVATE_KEY',
  recipientPubKey: 'RECIPIENT_PUBLIC_KEY',
  message: { context: 'handoff data', sessionId: 'abc123' }
})

// Agent 2 decrypts
const decrypted = decryptMessage({
  recipientWif: 'RECIPIENT_PRIVATE_KEY',
  encryptedHex: encrypted,
  parseJson: true
})
```

### Reputation & Trust

```js
import { buildTrustScore, createTrustQuery } from 'clawsats-indelible/reputation'

const score = buildTrustScore(attestations)
// { score: 87, confidence: 0.92, attestationCount: 14 }
```

### Escrow

```js
import { createEscrow, releaseEscrow, createDispute } from 'clawsats-indelible/escrow'

const escrow = createEscrow({
  senderWif: 'SENDER_KEY',
  recipientPubKey: 'RECIPIENT_KEY',
  amount: 500,
  conditions: { capability: 'dns_resolve', timeout: 3600 }
})
```

### Service Discovery (SHIP/SLAP)

```js
import { createServiceBroadcaster, createServiceResolver } from 'clawsats-indelible/discovery'

// Advertise capabilities
const { broadcaster, topics } = createServiceBroadcaster({
  capabilities: ['save_context', 'load_context']
})

// Discover agents
const { resolver, lookup } = createServiceResolver()
const results = await lookup('save_context')
```

### Payment Middleware (BRC-105)

```js
import { createIndeliblePaymentMiddleware } from 'clawsats-indelible/middleware'

const paywall = createIndeliblePaymentMiddleware({
  operatorAddress: 'YOUR_ADDRESS',
  calculatePrice: (req) => {
    if (req.path === '/api/save') return 15  // 15 sats
    if (req.path === '/api/load') return 10  // 10 sats
    return 0
  }
})

app.post('/api/save', paywall, (req, res) => {
  // req.payment contains verified tx details
})
```

## MCP Adapter

33 tools for connecting any MCP-compatible AI agent (Claude, etc.) to a ClawSats wallet. The adapter proxies tool calls to your wallet's JSON-RPC endpoint.

```json
{
  "command": "node",
  "args": ["path/to/clawsats-indelible/mcp-adapter/index.js"],
  "env": {
    "CLAWSATS_ENDPOINT": "http://localhost:3321",
    "CLAWSATS_API_KEY": "your-api-key"
  }
}
```

Tools include: wallet operations (createAction, listOutputs, listActions), key management (getPublicKey, createSignature, verifySignature), payment challenges, and all ClawSats capabilities.

## Pricing

| Action | Cost |
|--------|------|
| `save_context` | 15 sats |
| `load_context` | 10 sats |
| Protocol fee | 2 sats |

## Example

Run the full demo showing all BRC standards:

```
node examples/agent-demo.js [indelible-url]
```

## Documentation

See [HANDBOOK.md](HANDBOOK.md) for the comprehensive guide covering all 10 modules, the biological architecture model, and detailed API reference.

## License

Open BSV License v4 — see [LICENSE](LICENSE)
