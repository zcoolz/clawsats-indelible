/**
 * Mutual Authentication (BRC-31 Authrite)
 *
 * Replaces plain X-Operator-Address headers with proper cryptographic
 * mutual authentication. Both sides prove identity on every request.
 * No tokens to steal, no sessions to hijack.
 *
 * Uses AuthFetch from @bsv/sdk which implements the full Authrite protocol.
 */

import { AuthFetch, ProtoWallet, PrivateKey } from '@bsv/sdk'

/**
 * Create an authenticated HTTP client for agent-to-server communication
 *
 * @param {object} config
 * @param {string} config.privateKeyWif - Agent or operator's private key (WIF)
 * @returns {object} { fetch: function, wallet: ProtoWallet, publicKey: string }
 */
export function createAuthClient(config) {
  const { privateKeyWif } = config

  if (!privateKeyWif) throw new Error('privateKeyWif required')

  const key = PrivateKey.fromWif(privateKeyWif)
  const wallet = new ProtoWallet(key)
  const authFetch = new AuthFetch(wallet)

  return {
    /**
     * Make an authenticated HTTP request (BRC-31 Authrite)
     * Automatically handles mutual authentication and 402 payment flows
     *
     * @param {string} url - Full URL to request
     * @param {object} options - { method, headers, body }
     * @returns {Promise<Response>}
     */
    fetch: (url, options = {}) => authFetch.fetch(url, options),

    /** The underlying ProtoWallet for signing/verifying */
    wallet,

    /** This client's public key (hex, compressed) */
    publicKey: key.toPublicKey().toString()
  }
}

/**
 * Verify an Authrite-authenticated request on the server side
 *
 * The server creates its own AuthFetch wallet to verify incoming
 * requests are from legitimate agents with valid keys.
 *
 * @param {object} config
 * @param {string} config.serverWif - Server's private key (WIF)
 * @returns {object} { wallet: ProtoWallet, publicKey: string }
 */
export function createAuthServer(config) {
  const { serverWif } = config

  if (!serverWif) throw new Error('serverWif required')

  const key = PrivateKey.fromWif(serverWif)
  const wallet = new ProtoWallet(key)

  return {
    wallet,
    publicKey: key.toPublicKey().toString()
  }
}
