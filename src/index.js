/**
 * clawsats-indelible
 * Persistent blockchain memory for ClawSats AI agents
 *
 * Gives ClawSats agents what they're missing: permanent, portable,
 * self-sovereign memory that survives crashes, migrations, and host death.
 *
 * BRC Standards implemented:
 *   BRC-105  — Payment verification (middleware.js)
 *   BRC-52   — Agent identity certificates (identity.js)
 *   BRC-31   — Mutual authentication / Authrite (auth.js)
 *   BRC-77   — Signed messages (signing.js)
 *   BRC-78   — Encrypted messages (encryption.js)
 *   SHIP/SLAP — Service discovery (discovery.js)
 *
 * Institutional Layer:
 *   Reputation  — Trust scores & work attestations (reputation.js)
 *   Escrow      — Dispute resolution & arbitration (escrow.js)
 *   Messaging   — Inter-agent communication standard (messaging.js)
 *   Oracle      — Perception layer for real-world data (oracle.js)
 */

// Core
export { registerIndelibleCapabilities } from './capabilities.js'
export { IndelibleMemoryBridge } from './bridge.js'
export { createIndeliblePaymentMiddleware } from './middleware.js'
export { PRICES, PROTOCOL_TAG, DEFAULT_INDELIBLE_URL, CAPABILITY_TAGS } from './constants.js'

// BRC-52 — Agent Identity
export { createAgentCertificate, verifyAgentCertificate, AGENT_CERT_TYPE } from './identity.js'

// BRC-31 — Mutual Authentication
export { createAuthClient, createAuthServer } from './auth.js'

// BRC-77 — Signed Messages
export { signAction, verifyAction } from './signing.js'

// BRC-78 — Encrypted Messages
export { encryptMessage, decryptMessage } from './encryption.js'

// SHIP/SLAP — Service Discovery
export { createServiceBroadcaster, createServiceResolver, TOPIC_PREFIX } from './discovery.js'

// Reputation & Trust Layer
export { createAttestation, verifyAttestation, buildTrustScore, createTrustQuery, ATTESTATION_CERT_TYPE } from './reputation.js'

// Dispute Resolution & Escrow
export { createEscrow, acceptEscrow, releaseEscrow, refundEscrow, createDispute, resolveDispute } from './escrow.js'

// Inter-Agent Communication
export { createChannel, sendMessage, receiveMessage, createCapabilityAnnouncement, verifyCapabilityAnnouncement } from './messaging.js'

// Oracle / Perception Layer
export { createOracleAttestation, verifyOracleAttestation, buildOracleConsensus, requestOracleData, createOracleRegistry } from './oracle.js'
