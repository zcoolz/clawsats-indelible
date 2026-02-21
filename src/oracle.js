/**
 * Oracle / Perception Layer
 *
 * Agents need trusted input from reality. Oracles sign real-world data
 * (weather, prices, events) so agents can verify facts without blind
 * HTTP scraping. Uses BRC-77 signing for attestations and SHIP/SLAP
 * for oracle discovery.
 *
 * Oracle = any service that signs data with its private key.
 * Consumers verify the signature to trust the data.
 */

import { PrivateKey, SignedMessage, Hash, Utils } from '@bsv/sdk'

/**
 * Create an oracle attestation — sign a real-world fact
 *
 * The oracle signs a data point (type, value, timestamp) so consumers
 * can verify "oracle X really reported this value at this time."
 *
 * @param {object} config
 * @param {string} config.oracleWif - Oracle's private key (WIF)
 * @param {string} config.dataType - Type of data (e.g. 'price.bsv.usd', 'weather.temp.nyc')
 * @param {*} config.value - The data value (string, number, or object)
 * @param {string} [config.source] - Where the data came from
 * @param {number} [config.confidence] - Confidence level 0-100
 * @returns {object} { attestation, signature, dataHash }
 */
export function createOracleAttestation(config) {
  const { oracleWif, dataType, value, source = '', confidence = 100 } = config

  if (!oracleWif) throw new Error('oracleWif required')
  if (!dataType) throw new Error('dataType required')
  if (value === undefined || value === null) throw new Error('value required')

  const oracleKey = PrivateKey.fromWif(oracleWif)

  const attestation = {
    protocol: 'indelible-oracle-v1',
    oraclePubKey: oracleKey.toPublicKey().toString(),
    dataType,
    value,
    source,
    confidence,
    timestamp: new Date().toISOString()
  }

  // Hash the data for compact reference
  const dataHash = Utils.toHex(
    Hash.sha256(Utils.toArray(JSON.stringify({ dataType, value }), 'utf8'))
  )

  // Sign the full attestation
  const message = JSON.stringify(attestation)
  const messageBytes = Utils.toArray(message, 'utf8')
  const sig = SignedMessage.sign(messageBytes, oracleKey)

  return {
    attestation,
    signature: Utils.toHex(sig),
    dataHash
  }
}

/**
 * Verify an oracle attestation
 *
 * @param {object} config
 * @param {object} config.attestation - The attestation object
 * @param {string} config.signature - Signature hex
 * @returns {object} { valid, oraclePubKey, dataType, value, timestamp, dataHash }
 */
export function verifyOracleAttestation(config) {
  const { attestation, signature } = config

  if (!attestation) throw new Error('attestation required')
  if (!signature) throw new Error('signature required')

  const message = JSON.stringify(attestation)
  const messageBytes = Utils.toArray(message, 'utf8')
  const sigBytes = Utils.toArray(signature, 'hex')

  const valid = SignedMessage.verify(messageBytes, sigBytes)

  const dataHash = Utils.toHex(
    Hash.sha256(Utils.toArray(JSON.stringify({
      dataType: attestation.dataType,
      value: attestation.value
    }), 'utf8'))
  )

  return {
    valid,
    oraclePubKey: attestation.oraclePubKey,
    dataType: attestation.dataType,
    value: attestation.value,
    timestamp: attestation.timestamp,
    confidence: attestation.confidence,
    dataHash
  }
}

/**
 * Create a multi-oracle consensus — aggregate multiple attestations for the same data point
 *
 * Multiple oracles attesting to the same fact increases trust.
 * Returns consensus if majority agree, flags disagreement otherwise.
 *
 * @param {object[]} attestations - Array of { attestation, signature } from different oracles
 * @returns {object} { consensus, value, agreementRatio, oracleCount, attestations }
 */
export function buildOracleConsensus(attestations) {
  if (!attestations || !attestations.length) {
    return { consensus: false, value: null, agreementRatio: 0, oracleCount: 0, attestations: [] }
  }

  // Verify all attestations
  const verified = attestations.map(a => {
    const result = verifyOracleAttestation(a)
    return { ...result, originalSignature: a.signature }
  }).filter(a => a.valid)

  if (!verified.length) {
    return { consensus: false, value: null, agreementRatio: 0, oracleCount: 0, attestations: [] }
  }

  // Check if all report the same dataType
  const dataTypes = new Set(verified.map(a => a.dataType))
  if (dataTypes.size > 1) {
    throw new Error('All attestations must be for the same dataType')
  }

  // Count value agreement
  const valueCounts = {}
  for (const a of verified) {
    const key = JSON.stringify(a.value)
    valueCounts[key] = (valueCounts[key] || 0) + 1
  }

  // Find majority value
  let maxCount = 0
  let majorityValue = null
  for (const [valueStr, count] of Object.entries(valueCounts)) {
    if (count > maxCount) {
      maxCount = count
      majorityValue = JSON.parse(valueStr)
    }
  }

  const agreementRatio = maxCount / verified.length
  const consensus = agreementRatio > 0.5

  // Unique oracles (prevent one oracle from stuffing votes)
  const uniqueOracles = new Set(verified.map(a => a.oraclePubKey)).size

  return {
    consensus,
    value: majorityValue,
    agreementRatio: Math.round(agreementRatio * 100) / 100,
    oracleCount: uniqueOracles,
    totalAttestations: verified.length,
    dataType: verified[0].dataType,
    attestations: verified
  }
}

/**
 * Request data from an oracle endpoint (pay-per-query)
 *
 * Makes an HTTP request to an oracle service, optionally including
 * a payment transaction for paid data feeds.
 *
 * @param {object} config
 * @param {string} config.endpoint - Oracle API URL
 * @param {string} config.dataType - What data to request
 * @param {object} [config.params] - Additional query parameters
 * @param {string} [config.paymentTxHex] - Optional payment transaction hex
 * @param {number} [config.timeout=5000] - Request timeout in ms
 * @returns {Promise<object>} { attestation, signature } from the oracle
 */
export async function requestOracleData(config) {
  const { endpoint, dataType, params = {}, paymentTxHex = '', timeout = 5000 } = config

  if (!endpoint) throw new Error('endpoint required')
  if (!dataType) throw new Error('dataType required')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const body = {
      dataType,
      params,
      ...(paymentTxHex ? { payment: paymentTxHex } : {})
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Oracle returned ${res.status}: ${errText}`)
    }

    const data = await res.json()

    // Verify the response is a valid attestation
    if (data.attestation && data.signature) {
      const verified = verifyOracleAttestation(data)
      return { ...data, verified: verified.valid }
    }

    return data
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Create an oracle registry entry for SHIP/SLAP discovery
 *
 * Oracles advertise what data types they provide so agents can find them.
 *
 * @param {object} config
 * @param {string} config.oracleWif - Oracle's private key
 * @param {string[]} config.dataTypes - What data this oracle provides
 * @param {string} config.endpoint - URL where this oracle can be queried
 * @param {object} [config.pricing] - Per-query pricing in satoshis
 * @returns {object} { registry, signature }
 */
export function createOracleRegistry(config) {
  const { oracleWif, dataTypes, endpoint, pricing = {} } = config

  if (!oracleWif) throw new Error('oracleWif required')
  if (!dataTypes || !dataTypes.length) throw new Error('dataTypes required')
  if (!endpoint) throw new Error('endpoint required')

  const oracleKey = PrivateKey.fromWif(oracleWif)

  const registry = {
    protocol: 'indelible-oracle-registry-v1',
    oraclePubKey: oracleKey.toPublicKey().toString(),
    dataTypes,
    endpoint,
    pricing,
    registeredAt: new Date().toISOString()
  }

  const message = JSON.stringify(registry)
  const messageBytes = Utils.toArray(message, 'utf8')
  const sig = SignedMessage.sign(messageBytes, oracleKey)

  return {
    registry,
    signature: Utils.toHex(sig)
  }
}
