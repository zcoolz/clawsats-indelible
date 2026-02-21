#!/usr/bin/env node
/**
 * ClawSats MCP Adapter
 *
 * Wraps a ClawSats wallet's JSON-RPC interface as MCP tools.
 * Communicates via stdio (MCP protocol) and proxies calls to
 * the wallet's HTTP JSON-RPC endpoint.
 *
 * Config:
 *   CLAWSATS_ENDPOINT  - Wallet JSON-RPC URL (default: http://localhost:3321)
 *   CLAWSATS_API_KEY   - Optional API key for admin methods
 *
 * Usage in Claude Code settings.json:
 *   {
 *     "mcpServers": {
 *       "clawsats": {
 *         "command": "node",
 *         "args": ["path/to/clawsats-indelible/mcp-adapter/index.js"],
 *         "env": {
 *           "CLAWSATS_ENDPOINT": "http://localhost:3321",
 *           "CLAWSATS_API_KEY": "your-api-key"
 *         }
 *       }
 *     }
 *   }
 */

import { createInterface } from 'readline'
import { TOOLS } from './tools.js'

const ENDPOINT = process.env.CLAWSATS_ENDPOINT || 'http://localhost:3321'
const API_KEY = process.env.CLAWSATS_API_KEY || ''

const SERVER_INFO = {
  name: 'clawsats-mcp',
  version: '0.1.0',
  description: 'MCP adapter for ClawSats wallet — BRC-100 wallet operations, payments, peers, courses, on-chain memory'
}

// JSON-RPC ID counter for proxied calls
let rpcId = 1

/**
 * Proxy a tool call to the ClawSats wallet JSON-RPC endpoint.
 * Each MCP tool name maps 1:1 to a JSON-RPC method name.
 */
async function callWallet(method, params) {
  const body = {
    jsonrpc: '2.0',
    id: rpcId++,
    method,
    params: params || {}
  }

  const headers = { 'Content-Type': 'application/json' }
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Wallet returned ${res.status}: ${text.slice(0, 300)}`)
  }

  const json = await res.json()

  if (json.error) {
    throw new Error(json.error.message || JSON.stringify(json.error))
  }

  return json.result
}

/**
 * Call an HTTP endpoint (non-JSON-RPC) on the ClawSats wallet.
 * Used for /health, /discovery, /call/:capability etc.
 */
async function callHttp(path, options = {}) {
  const url = ENDPOINT.replace(/\/$/, '') + path
  const headers = { 'Content-Type': 'application/json' }
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(30000)
  })

  return res.json()
}

/**
 * Handle an MCP request.
 */
async function handleRequest(request) {
  const { method, params, id } = request

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: SERVER_INFO,
            capabilities: {
              tools: {}
            }
          }
        }

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS }
        }

      case 'tools/call': {
        const { name, arguments: args } = params

        // Verify tool exists
        const tool = TOOLS.find(t => t.name === name)
        if (!tool) {
          throw new Error(`Unknown tool: ${name}`)
        }

        // Proxy to ClawSats wallet JSON-RPC
        const result = await callWallet(name, args || {})

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          }
        }
      }

      case 'notifications/initialized':
        return null

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        }
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: error.message }
    }
  }
}

// ── CLI flags ──────────────────────────────────────────────────────

if (process.argv.includes('--show-config')) {
  console.log(`
Add this to your Claude Code settings.json:

{
  "mcpServers": {
    "clawsats": {
      "command": "node",
      "args": ["${process.argv[1]}"],
      "env": {
        "CLAWSATS_ENDPOINT": "http://localhost:3321",
        "CLAWSATS_API_KEY": ""
      }
    }
  }
}

Then restart Claude Code. The AI will have access to all ClawSats
wallet operations: payments, peers, courses, on-chain memory, and more.
`)
  process.exit(0)
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
ClawSats MCP Adapter — BRC-100 wallet operations for Claude Code

Usage:
  node index.js              Start MCP server (used by Claude Code)
  node index.js --show-config  Show Claude Code configuration
  node index.js --test         Test connection to wallet endpoint
  node index.js --help         Show this help message

Environment:
  CLAWSATS_ENDPOINT  Wallet JSON-RPC URL (default: http://localhost:3321)
  CLAWSATS_API_KEY   API key for admin methods (optional)
`)
  process.exit(0)
}

if (process.argv.includes('--test')) {
  console.log(`Testing connection to ${ENDPOINT}...`)
  try {
    const result = await callWallet('ping', {})
    console.log('Connected:', JSON.stringify(result, null, 2))

    const caps = await callWallet('getCapabilities', {})
    console.log('\nCapabilities:', JSON.stringify(caps, null, 2))

    const config = await callWallet('getConfig', {})
    console.log('\nConfig:', JSON.stringify(config, null, 2))

    console.log('\nAll good — wallet is reachable.')
  } catch (err) {
    console.error('Connection failed:', err.message)
    process.exit(1)
  }
  process.exit(0)
}

// ── Main: stdio JSON-RPC loop ─────────────────────────────────────

async function main() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })

  for await (const line of rl) {
    if (!line.trim()) continue

    try {
      const request = JSON.parse(line)
      const response = await handleRequest(request)

      if (response) {
        console.log(JSON.stringify(response))
      }
    } catch (error) {
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' }
      }))
    }
  }
}

main().catch(console.error)
