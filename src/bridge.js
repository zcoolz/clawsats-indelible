/**
 * IndelibleMemoryBridge
 * Blockchain memory adapter for ClawSats agents via the Indelible server API.
 *
 * NOTE: This is NOT a drop-in replacement for ClawSats' OnChainMemory.
 * OnChainMemory writes OP_RETURN data directly to chain via the local wallet.
 * IndelibleMemoryBridge saves via Indelible's HTTP API (chunked, indexed, encrypted).
 * The API surface (save/load/list) is similar but the underlying mechanism differs.
 *
 * Capabilities beyond OnChainMemory:
 * - Chunked transactions (unlimited payload via delta saves)
 * - SPV bridge (no WhatsOnChain dependency)
 * - Structured JSONL with session chaining
 * - Delta saves (only new messages committed)
 * - AES-256-GCM encryption per agent
 * - Smart restore (tail-heavy priority)
 * - Redis-indexed (recoverable from chain if index lost)
 */

import fetch from 'node-fetch'
import { DEFAULT_INDELIBLE_URL } from './constants.js'

export class IndelibleMemoryBridge {
  /**
   * @param {object} config
   * @param {string} config.indelibleUrl - Indelible server URL
   * @param {string} config.operatorAddress - BSV address of the operator
   * @param {string} config.agentAddress - BSV address of this agent
   */
  constructor(config) {
    this.indelibleUrl = config.indelibleUrl || DEFAULT_INDELIBLE_URL
    this.operatorAddress = config.operatorAddress
    this.agentAddress = config.agentAddress

    if (!this.operatorAddress) throw new Error('operatorAddress required')
    if (!this.agentAddress) throw new Error('agentAddress required')
  }

  /**
   * Save agent memory to blockchain via Indelible API
   * Similar interface to OnChainMemory.save(key, data) but uses HTTP, not local OP_RETURN
   *
   * @param {string} key - Agent identifier / memory key
   * @param {Array|object} data - Messages array or raw data object
   * @param {object} options
   * @param {string} options.summary - Human-readable summary
   * @returns {object} { success, txId, sessionId, messageCount, saveType }
   */
  async save(key, data, options = {}) {
    const messages = Array.isArray(data)
      ? data
      : [{ role: 'system', content: JSON.stringify(data) }]

    const result = await this._call('/api/agents/save', {
      agentAddress: this.agentAddress,
      agentId: key,
      messages,
      summary: options.summary || `Agent memory: ${key}`,
      operatorAddress: this.operatorAddress
    })

    return result
  }

  /**
   * Load agent memory from blockchain via Indelible API
   * Similar interface to OnChainMemory.load(key) but returns formatted multi-session context
   *
   * @param {string} key - Agent identifier (unused in v1, loads by address)
   * @param {object} options
   * @param {number} options.numSessions - Number of sessions to restore (default 3)
   * @returns {string|null} Formatted context string or null
   */
  async load(key, options = {}) {
    const result = await this._call('/api/agents/load', {
      agentAddress: this.agentAddress,
      numSessions: options.numSessions || 3,
      operatorAddress: this.operatorAddress
    })

    return result.context || null
  }

  /**
   * List all sessions for this agent
   * @returns {Array} Session metadata (no content, just summaries/timestamps/txIds)
   */
  async list() {
    const res = await fetch(
      `${this.indelibleUrl}/api/agents/sessions/${this.agentAddress}`,
      {
        headers: {
          'X-Operator-Address': this.operatorAddress
        }
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`List failed (${res.status}): ${err}`)
    }

    const data = await res.json()
    return data.sessions || []
  }

  /**
   * Internal: POST to Indelible server
   */
  async _call(path, body) {
    const res = await fetch(`${this.indelibleUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Operator-Address': this.operatorAddress
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Indelible ${path} failed (${res.status}): ${err}`)
    }

    return res.json()
  }
}
