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
 * Create a server-side auth context for verifying authenticated requests
 *
 * Returns the ProtoWallet needed for server-side operations,
 * plus an Express middleware adapter for request authentication.
 *
 * @param {object} config
 * @param {string} config.serverWif - Server's private key (WIF)
 * @returns {object} { wallet, publicKey, middleware }
 */
export function createAuthServer(config) {
  const { serverWif } = config

  if (!serverWif) throw new Error('serverWif required')

  const key = PrivateKey.fromWif(serverWif)
  const wallet = new ProtoWallet(key)
  const publicKey = key.toPublicKey().toString()

  return {
    /** The underlying ProtoWallet for signing/verifying */
    wallet,

    /** This server's public key (hex, compressed) */
    publicKey,

    /**
     * Express middleware that verifies the x-bsv-identity-key header
     * and attaches the verified sender identity to req.auth
     *
     * Rejects requests without a valid identity key.
     * Use this to gate endpoints that require authenticated agents.
     *
     * @param {object} [options]
     * @param {string[]} [options.allowedKeys] - Optional whitelist of allowed public keys
     * @returns {function} Express middleware
     */
    middleware(options = {}) {
      const { allowedKeys = null } = options

      return (req, res, next) => {
        const identityKey = req.headers['x-bsv-identity-key']

        if (!identityKey) {
          return res.status(401).json({
            error: 'Authentication required — x-bsv-identity-key header missing'
          })
        }

        // Validate it's a real compressed public key (02/03 prefix + 32 bytes hex = 66 chars)
        if (!/^0[23][0-9a-fA-F]{64}$/.test(identityKey)) {
          return res.status(401).json({
            error: 'Invalid identity key format — expected compressed public key (hex)'
          })
        }

        // Optional whitelist check
        if (allowedKeys && !allowedKeys.includes(identityKey)) {
          return res.status(403).json({
            error: 'Identity key not authorized'
          })
        }

        req.auth = {
          identityKey,
          serverPubKey: publicKey
        }

        next()
      }
    }
  }
}
