/**
 * Service Discovery (SHIP/SLAP)
 *
 * Agents advertise what they can do (SHIP) and discover other agents'
 * capabilities (SLAP). An agent broadcasts "I offer save_context" and
 * others can find it through the overlay network.
 *
 * SHIP = Service Host Interconnect Protocol (advertise services)
 * SLAP = Service Lookup Availability Protocol (discover services)
 *
 * Uses SHIPBroadcaster and LookupResolver from @bsv/sdk.
 */

import { SHIPBroadcaster, LookupResolver } from '@bsv/sdk'

/** Default topic prefix for Indelible agent services */
const TOPIC_PREFIX = 'tm_indelible_'

/**
 * Create a service broadcaster for advertising agent capabilities
 *
 * Agents use this to announce what services they offer on the overlay network.
 * Other agents can then discover them via SLAP lookup.
 *
 * @param {object} config
 * @param {string[]} config.capabilities - Services this agent offers (e.g. ['save_context', 'load_context'])
 * @param {string} config.network - 'mainnet' | 'testnet' (default: 'mainnet')
 * @returns {object} { broadcaster: SHIPBroadcaster, topics: string[] }
 */
export function createServiceBroadcaster(config) {
  const { capabilities, network = 'mainnet' } = config

  if (!capabilities || !capabilities.length) throw new Error('capabilities array required')

  const topics = capabilities.map(cap => `${TOPIC_PREFIX}${cap}`)

  const broadcaster = new SHIPBroadcaster(topics, {
    networkPreset: network
  })

  return { broadcaster, topics }
}

/**
 * Create a service resolver for discovering agent capabilities
 *
 * Operators use this to find agents that offer specific services.
 *
 * @param {object} config
 * @param {string} config.network - 'mainnet' | 'testnet' (default: 'mainnet')
 * @returns {object} { resolver: LookupResolver, lookup: function }
 */
export function createServiceResolver(config = {}) {
  const { network = 'mainnet' } = config

  const resolver = new LookupResolver({
    networkPreset: network
  })

  return {
    resolver,

    /**
     * Look up agents offering a specific capability
     *
     * @param {string} capability - Service to search for (e.g. 'save_context')
     * @param {number} timeout - Timeout in ms (default: 5000)
     * @returns {Promise<object>} Lookup answer with available service providers
     */
    lookup: (capability, timeout = 5000) => {
      const topic = `${TOPIC_PREFIX}${capability}`
      return resolver.query({
        service: 'ls_slap',
        query: { topic }
      }, timeout)
    }
  }
}

export { TOPIC_PREFIX }
