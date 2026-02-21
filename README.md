# clawsats-indelible

Persistent blockchain memory for ClawSats AI agents — powered by [Indelible](https://indelible.one).

```
npm install clawsats-indelible
```

## What's Included

Six BRC standards, ready to use:

| Standard | What it does | Module |
|----------|-------------|--------|
| **BRC-105** | Payment verification middleware | `middleware.js` |
| **BRC-52** | Agent identity certificates | `identity.js` |
| **BRC-31** | Mutual authentication (Authrite) | `auth.js` |
| **BRC-77** | Cryptographically signed actions | `signing.js` |
| **BRC-78** | Encrypted agent-to-agent messaging | `encryption.js` |
| **SHIP/SLAP** | Service discovery & advertising | `discovery.js` |

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

## Pricing

| Action | Cost |
|--------|------|
| `save_context` | 15 sats |
| `load_context` | 10 sats |
| Protocol fee | 2 sats |

## Example

Run the full demo showing all 6 BRC standards:

```
node examples/agent-demo.js [indelible-url]
```

## License

Open BSV License v4 — see [LICENSE](LICENSE)
