/**
 * Reputation & Trust Layer
 *
 * On-chain trust scores, verifiable work attestations, and sybil resistance.
 * Agents build reputation through verified actions. Other agents can query
 * trust scores before transacting with strangers.
 *
 * Uses BRC-52 certificates for attestations and BRC-77 signed messages
 * for tamper-proof activity records.
 */

import { Certificate, ProtoWallet, PrivateKey, Hash, Utils, Random, SignedMessage } from '@bsv/sdk'

// Certificate type for work attestations
const ATTESTATION_CERT_TYPE = Utils.toBase64(
  Hash.sha256(Utils.toArray('indelible.agent.attestation.v1', 'utf8'))
)

/**
 * Create a work attestation — a signed receipt that an agent performed work
 *
 * The signer (evaluator) certifies that the subject (worker) completed
 * a specific capability with a given quality rating.
 *
 * @param {object} config
 * @param {string} config.signerWif - Evaluator's private key (WIF)
 * @param {string} config.agentPubKey - Worker agent's public key (hex)
 * @param {string} config.capability - What work was done (e.g. 'save_context')
 * @param {number} config.rating - Quality rating 1-5
 * @param {string} [config.notes] - Optional notes about the work
 * @returns {Promise<object>} { attestation: Certificate, serialized: string (hex) }
 */
export async function createAttestation(config) {
  const { signerWif, agentPubKey, capability, rating, notes = '' } = config

  if (!signerWif) throw new Error('signerWif required')
  if (!agentPubKey) throw new Error('agentPubKey required')
  if (!capability) throw new Error('capability required')
  if (!rating || rating < 1 || rating > 5) throw new Error('rating must be 1-5')

  const signerKey = PrivateKey.fromWif(signerWif)
  const serialNumber = Utils.toBase64(Random(32))

  const fields = {
    capability: Utils.toBase64(Utils.toArray(capability, 'utf8')),
    rating: Utils.toBase64(Utils.toArray(String(rating), 'utf8')),
    notes: Utils.toBase64(Utils.toArray(notes, 'utf8')),
    attestedAt: Utils.toBase64(Utils.toArray(new Date().toISOString(), 'utf8'))
  }

  const cert = new Certificate(
    ATTESTATION_CERT_TYPE,
    serialNumber,
    agentPubKey,
    signerKey.toPublicKey().toString(),
    '0000000000000000000000000000000000000000000000000000000000000000.0',
    fields
  )

  const wallet = new ProtoWallet(signerKey)
  await cert.sign(wallet)

  return {
    attestation: cert,
    serialized: Utils.toHex(cert.toBinary())
  }
}

/**
 * Verify a work attestation
 *
 * @param {string} serializedHex - Attestation hex from createAttestation
 * @returns {Promise<object>} { valid, subject, certifier, fields: { capability, rating, notes, attestedAt } }
 */
export async function verifyAttestation(serializedHex) {
  const bin = Utils.toArray(serializedHex, 'hex')
  const cert = Certificate.fromBinary(bin)
  const valid = await cert.verify()

  const decode = (b64) => {
    try { return Utils.toUTF8(Utils.toArray(b64, 'base64')) }
    catch { return b64 }
  }

  return {
    valid,
    subject: cert.subject,
    certifier: cert.certifier,
    fields: {
      capability: decode(cert.fields.capability),
      rating: parseInt(decode(cert.fields.rating)) || 0,
      notes: decode(cert.fields.notes),
      attestedAt: decode(cert.fields.attestedAt)
    }
  }
}

/**
 * Build a trust score from a list of attestations
 *
 * Aggregates multiple attestation certificates into a composite trust score.
 * Factors: average rating, number of unique attesters, recency, capability breadth.
 *
 * @param {object[]} attestations - Array of verified attestation objects (from verifyAttestation)
 * @returns {object} { score, breakdown, attestationCount, uniqueAttesters, capabilities }
 */
export function buildTrustScore(attestations) {
  if (!attestations || !attestations.length) {
    return {
      score: 0,
      breakdown: { avgRating: 0, volumeBonus: 0, diversityBonus: 0, recencyBonus: 0 },
      attestationCount: 0,
      uniqueAttesters: 0,
      capabilities: []
    }
  }

  // Only count valid attestations
  const valid = attestations.filter(a => a.valid)
  if (!valid.length) {
    return {
      score: 0,
      breakdown: { avgRating: 0, volumeBonus: 0, diversityBonus: 0, recencyBonus: 0 },
      attestationCount: 0,
      uniqueAttesters: 0,
      capabilities: []
    }
  }

  // Average rating (0-100 scale, from 1-5 rating)
  const ratings = valid.map(a => a.fields.rating)
  const avgRating = (ratings.reduce((s, r) => s + r, 0) / ratings.length - 1) * 25 // 1→0, 5→100

  // Volume bonus — more attestations = more trusted (diminishing returns)
  // ln(count) * 10, capped at 20
  const volumeBonus = Math.min(20, Math.log(valid.length + 1) * 10)

  // Diversity bonus — more unique attesters = harder to sybil
  const uniqueAttesters = new Set(valid.map(a => a.certifier)).size
  const diversityBonus = Math.min(15, uniqueAttesters * 3)

  // Recency bonus — recent attestations worth more
  const now = Date.now()
  const recentCount = valid.filter(a => {
    const ts = new Date(a.fields.attestedAt).getTime()
    return (now - ts) < 30 * 24 * 60 * 60 * 1000 // last 30 days
  }).length
  const recencyBonus = Math.min(15, (recentCount / valid.length) * 15)

  // Capabilities covered
  const capabilities = [...new Set(valid.map(a => a.fields.capability))]

  // Composite score: weighted average (0-100 scale, capped)
  const score = Math.min(100, Math.round(
    avgRating * 0.5 +     // 50% weight on quality
    volumeBonus +          // up to 20 pts for volume
    diversityBonus +       // up to 15 pts for diversity
    recencyBonus           // up to 15 pts for recency
  ))

  return {
    score,
    breakdown: {
      avgRating: Math.round(avgRating * 10) / 10,
      volumeBonus: Math.round(volumeBonus * 10) / 10,
      diversityBonus: Math.round(diversityBonus * 10) / 10,
      recencyBonus: Math.round(recencyBonus * 10) / 10
    },
    attestationCount: valid.length,
    uniqueAttesters,
    capabilities
  }
}

/**
 * Create a signed trust query — ask for an agent's reputation
 *
 * @param {object} config
 * @param {string} config.queryWif - Querier's private key
 * @param {string} config.targetPubKey - Agent to query about
 * @param {string} [config.capability] - Optional: filter by specific capability
 * @returns {object} { signature, publicKey, query }
 */
export function createTrustQuery(config) {
  const { queryWif, targetPubKey, capability = '' } = config

  if (!queryWif) throw new Error('queryWif required')
  if (!targetPubKey) throw new Error('targetPubKey required')

  const key = PrivateKey.fromWif(queryWif)
  const query = {
    action: 'trust_query',
    target: targetPubKey,
    capability,
    timestamp: new Date().toISOString()
  }

  const message = JSON.stringify(query)
  const messageBytes = Utils.toArray(message, 'utf8')
  const sig = SignedMessage.sign(messageBytes, key)

  return {
    signature: Utils.toHex(sig),
    publicKey: key.toPublicKey().toString(),
    query
  }
}

export { ATTESTATION_CERT_TYPE }
