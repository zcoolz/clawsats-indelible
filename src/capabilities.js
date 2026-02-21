/**
 * ClawSats Capability Registration
 * Registers save_context and load_context as paid ClawSats capabilities
 */

import fetch from 'node-fetch'
import { PRICES, CAPABILITY_TAGS, DEFAULT_INDELIBLE_URL } from './constants.js'

/**
 * Register Indelible memory capabilities with a ClawSats CapabilityRegistry
 *
 * @param {object} registry - ClawSats CapabilityRegistry instance
 * @param {object} config
 * @param {string} config.indelibleUrl - Indelible server URL (default: https://indelible.one)
 * @param {string} config.operatorAddress - BSV address of the operator running this node
 */
export function registerIndelibleCapabilities(registry, config) {
  const {
    indelibleUrl = DEFAULT_INDELIBLE_URL,
    operatorAddress
  } = config

  if (!operatorAddress) throw new Error('operatorAddress required')

  // save_context — 15 sats
  // Agent sends messages + summary, gets txId back
  registry.register({
    name: 'save_context',
    description: 'Save agent memory to BSV blockchain via Indelible SPV bridge. Supports delta saves, session chaining, and AES-256-GCM encrypted storage. Your data survives crashes, migrations, and host death.',
    pricePerCall: PRICES.save_context,
    tags: CAPABILITY_TAGS.save,
    handler: async (params) => {
      const { messages, summary, agentAddress, agentId } = params

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new Error('messages array required')
      }
      if (!agentAddress) {
        throw new Error('agentAddress required')
      }

      const response = await fetch(`${indelibleUrl}/api/agents/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Operator-Address': operatorAddress
        },
        body: JSON.stringify({
          messages,
          summary: summary || `Agent ${agentId || agentAddress} session`,
          agentAddress,
          agentId: agentId || agentAddress,
          operatorAddress
        })
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Save failed (${response.status}): ${err}`)
      }

      return response.json()
    }
  })

  // load_context — 10 sats
  // Agent sends its address, gets restored context back
  registry.register({
    name: 'load_context',
    description: 'Load agent memory from BSV blockchain via Indelible. Smart restore with tail-heavy priority — recent messages in full, older ones summarized. Merges delta saves automatically.',
    pricePerCall: PRICES.load_context,
    tags: CAPABILITY_TAGS.load,
    handler: async (params) => {
      const { agentAddress, numSessions = 3 } = params

      if (!agentAddress) {
        throw new Error('agentAddress required')
      }

      const response = await fetch(`${indelibleUrl}/api/agents/load`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Operator-Address': operatorAddress
        },
        body: JSON.stringify({
          agentAddress,
          numSessions,
          operatorAddress
        })
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Load failed (${response.status}): ${err}`)
      }

      return response.json()
    }
  })
}
