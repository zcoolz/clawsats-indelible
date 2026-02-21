/**
 * Agent Identity (BRC-52 Certificates)
 *
 * Agents register with verifiable identity certificates signed by their operator.
 * Certificates prove: who the agent is, who operates it, and what it can do.
 * Other parties verify the certificate without trusting the server.
 */

import { Certificate, ProtoWallet, PrivateKey, Hash, Utils, Random } from '@bsv/sdk'

// Fixed certificate type for Indelible agent identity
// SHA-256("indelible.agent.identity.v1") → exactly 32 bytes as base64
const AGENT_CERT_TYPE = Utils.toBase64(
  Hash.sha256(Utils.toArray('indelible.agent.identity.v1', 'utf8'))
)

/**
 * Create a signed agent identity certificate
 *
 * @param {object} config
 * @param {string} config.operatorWif - Operator's private key (WIF) — signs the certificate
 * @param {string} config.agentPubKey - Agent's public key (hex, compressed)
 * @param {string} config.agentName - Human-readable agent name
 * @param {string[]} config.capabilities - What this agent can do (e.g. ['save_context', 'load_context'])
 * @returns {object} { certificate: Certificate, serialized: string (hex) }
 */
export async function createAgentCertificate(config) {
  const { operatorWif, agentPubKey, agentName, capabilities = [] } = config

  if (!operatorWif) throw new Error('operatorWif required')
  if (!agentPubKey) throw new Error('agentPubKey required')
  if (!agentName) throw new Error('agentName required')

  const operatorKey = PrivateKey.fromWif(operatorWif)
  const serialNumber = Utils.toBase64(Random(32))

  const fields = {
    agentName: Utils.toBase64(Utils.toArray(agentName, 'utf8')),
    capabilities: Utils.toBase64(Utils.toArray(JSON.stringify(capabilities), 'utf8')),
    registeredAt: Utils.toBase64(Utils.toArray(new Date().toISOString(), 'utf8'))
  }

  const cert = new Certificate(
    AGENT_CERT_TYPE,
    serialNumber,
    agentPubKey,
    operatorKey.toPublicKey().toString(),
    '0000000000000000000000000000000000000000000000000000000000000000.0',
    fields
  )

  const wallet = new ProtoWallet(operatorKey)
  await cert.sign(wallet)

  return {
    certificate: cert,
    serialized: Utils.toHex(cert.toBinary())
  }
}

/**
 * Verify an agent identity certificate
 *
 * @param {string} serializedHex - Certificate in hex (from createAgentCertificate)
 * @returns {object} { valid: boolean, subject, certifier, fields: { agentName, capabilities, registeredAt } }
 */
export async function verifyAgentCertificate(serializedHex) {
  const bin = Utils.toArray(serializedHex, 'hex')
  const cert = Certificate.fromBinary(bin)

  const valid = await cert.verify()

  // Decode fields from base64
  const decode = (b64) => {
    try {
      return Utils.toUTF8(Utils.toArray(b64, 'base64'))
    } catch {
      return b64
    }
  }

  const fields = {}
  if (cert.fields.agentName) fields.agentName = decode(cert.fields.agentName)
  if (cert.fields.capabilities) {
    try {
      fields.capabilities = JSON.parse(decode(cert.fields.capabilities))
    } catch {
      fields.capabilities = []
    }
  }
  if (cert.fields.registeredAt) fields.registeredAt = decode(cert.fields.registeredAt)

  return {
    valid,
    subject: cert.subject,
    certifier: cert.certifier,
    serialNumber: cert.serialNumber,
    fields
  }
}

export { AGENT_CERT_TYPE }
