/**
 * ClawSats-Indelible Constants
 * Pricing, protocol tags, and configuration defaults
 */

export const PRICES = {
  save_context: 15,   // sats paid to operator per save
  load_context: 10,   // sats paid to operator per load
  protocol_fee: 2     // sats ClawSats protocol fee per call
}

export const PROTOCOL_TAG = 'indelible.agent'
export const DEFAULT_INDELIBLE_URL = 'https://indelible.one'

export const CAPABILITY_TAGS = {
  save: ['memory', 'persistence', 'blockchain', 'indelible'],
  load: ['memory', 'recall', 'blockchain', 'indelible']
}
