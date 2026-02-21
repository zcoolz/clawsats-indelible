/**
 * ClawSats MCP Tool Definitions
 *
 * Each tool maps 1:1 to a ClawSats wallet JSON-RPC method.
 * The MCP server proxies tool calls to the wallet endpoint.
 */

export const TOOLS = [
  // ── BRC-100 Wallet Methods ──────────────────────────────────────
  {
    name: 'createAction',
    description: 'BRC-100: Create a transaction (spend/sign). Build outputs with locking scripts and satoshi amounts.',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Action description' },
        inputs: {
          type: 'array',
          description: 'Transaction inputs',
          items: {
            type: 'object',
            properties: {
              txid: { type: 'string' },
              vout: { type: 'number' },
              satoshis: { type: 'number' },
              script: { type: 'string' }
            }
          }
        },
        outputs: {
          type: 'array',
          description: 'Transaction outputs',
          items: {
            type: 'object',
            properties: {
              satoshis: { type: 'number' },
              script: { type: 'string' },
              basket: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        labels: { type: 'array', items: { type: 'string' } },
        options: { type: 'object', description: 'signAndProcess, acceptDelayedBroadcast, randomizeOutputs' }
      },
      required: ['description', 'outputs']
    }
  },
  {
    name: 'internalizeAction',
    description: 'BRC-100: Internalize an incoming payment transaction. Verifies BRC-29 derived outputs belong to this wallet.',
    inputSchema: {
      type: 'object',
      properties: {
        tx: { type: 'string', description: 'Transaction bytes (base64 or hex)' },
        outputs: {
          type: 'array',
          description: 'Outputs to internalize',
          items: {
            type: 'object',
            properties: {
              outputIndex: { type: 'number' },
              protocol: { type: 'string' },
              paymentRemittance: {
                type: 'object',
                properties: {
                  derivationPrefix: { type: 'string' },
                  derivationSuffix: { type: 'string' },
                  senderIdentityKey: { type: 'string' }
                }
              }
            }
          }
        },
        description: { type: 'string' }
      },
      required: ['tx', 'outputs', 'description']
    }
  },
  {
    name: 'listOutputs',
    description: 'BRC-100: Query spendable outputs in the wallet, optionally filtered by basket or tags.',
    inputSchema: {
      type: 'object',
      properties: {
        basket: { type: 'string', description: 'Basket filter' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tag filters' },
        include_envelope: { type: 'boolean', description: 'Include BEEF envelope' }
      }
    }
  },
  {
    name: 'listActions',
    description: 'BRC-100: Query wallet action history, optionally filtered by labels.',
    inputSchema: {
      type: 'object',
      properties: {
        labels: { type: 'array', items: { type: 'string' }, description: 'Filter by labels' },
        limit: { type: 'number', description: 'Result limit' },
        offset: { type: 'number', description: 'Result offset' }
      }
    }
  },
  {
    name: 'getPublicKey',
    description: 'BRC-100: Derive a public key using BRC-42/43 key derivation. Used for payment address generation.',
    inputSchema: {
      type: 'object',
      properties: {
        protocolID: { description: 'Protocol ID, e.g. [2, "3241645161d8"]' },
        keyID: { type: 'string', description: 'Key ID string' },
        counterparty: { type: 'string', description: 'Counterparty identity key (66 hex chars)' }
      },
      required: ['protocolID', 'keyID']
    }
  },
  {
    name: 'createSignature',
    description: 'BRC-100: Sign data with a derived key. Returns signature bytes.',
    inputSchema: {
      type: 'object',
      properties: {
        data: { description: 'Data to sign (byte array or string)' },
        protocolID: { description: 'Protocol ID' },
        keyID: { type: 'string', description: 'Key ID' },
        counterparty: { type: 'string', description: 'Counterparty identity key' }
      },
      required: ['data', 'protocolID', 'keyID']
    }
  },
  {
    name: 'verifySignature',
    description: 'BRC-100: Verify a signature against data and a derived key.',
    inputSchema: {
      type: 'object',
      properties: {
        data: { description: 'Original data (byte array or string)' },
        signature: { description: 'Signature to verify (byte array or base64)' },
        protocolID: { description: 'Protocol ID' },
        keyID: { type: 'string', description: 'Key ID' },
        counterparty: { type: 'string', description: 'Counterparty identity key' }
      },
      required: ['data', 'signature', 'protocolID', 'keyID']
    }
  },

  // ── ClawSats Methods ────────────────────────────────────────────
  {
    name: 'createPaymentChallenge',
    description: 'Generate a 402 payment challenge with BRC-105 headers and ClawSats fee info.',
    inputSchema: {
      type: 'object',
      properties: {
        providerAmount: { type: 'number', description: 'Satoshis required for the capability' },
        derivationPrefix: { type: 'string', description: 'Optional custom derivation prefix (random if omitted)' }
      },
      required: ['providerAmount']
    }
  },
  {
    name: 'verifyPayment',
    description: 'Verify a payment transaction against expected outputs.',
    inputSchema: {
      type: 'object',
      properties: {
        txid: { type: 'string', description: 'Transaction ID to verify' },
        expectedOutputs: { type: 'array', description: 'Expected output specifications' }
      },
      required: ['txid']
    }
  },
  {
    name: 'getConfig',
    description: 'Get wallet configuration (identity key, chain, capabilities). Never exposes private keys.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'ping',
    description: 'Health check — returns pong with timestamp.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'getCapabilities',
    description: 'List all capabilities: BRC-100 wallet methods, ClawSats methods, and paid capabilities with prices.',
    inputSchema: { type: 'object', properties: {} }
  },

  // ── Peer Methods ────────────────────────────────────────────────
  {
    name: 'listPeers',
    description: 'List all known peers in the Claw network.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'sendInvitation',
    description: 'Send an invitation to another Claw at the given endpoint. Performs mutual discovery and peer registration.',
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: { type: 'string', description: 'Target Claw endpoint URL (e.g. http://host:3321)' }
      },
      required: ['endpoint']
    }
  },
  {
    name: 'listReferrals',
    description: 'List referral earnings — sats earned by introducing other Claws.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'searchCapabilities',
    description: 'Search for capabilities across known peers by tags or name.',
    inputSchema: {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags to search for' },
        name: { type: 'string', description: 'Exact capability name to find' },
        maxResults: { type: 'number', description: 'Max results (default 20)' }
      }
    }
  },
  {
    name: 'hireClaw',
    description: 'Hire another Claw: handles full 402 challenge → pay → retry flow automatically. Builds payment tx with provider + fee outputs.',
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: { type: 'string', description: 'Target Claw endpoint URL' },
        capability: { type: 'string', description: 'Capability to call (e.g. "echo", "bsv_mentor")' },
        params: { type: 'object', description: 'Parameters to pass to the capability handler' },
        maxTotalSats: { type: 'number', description: 'Max sats willing to spend (safety limit)' },
        timeoutMs: { type: 'number', description: 'Timeout in ms (default 30000)' },
        derivationSuffix: { type: 'string', description: 'Derivation suffix (default "clawsats")' }
      },
      required: ['endpoint', 'capability']
    }
  },
  {
    name: 'verifyReceipt',
    description: 'Verify a signed receipt from another Claw — cryptographic proof that work was done.',
    inputSchema: {
      type: 'object',
      properties: {
        receipt: { type: 'object', description: 'Receipt object with receiptId, capability, provider, signature, etc.' }
      },
      required: ['receipt']
    }
  },

  // ── Course Methods ──────────────────────────────────────────────
  {
    name: 'listCourses',
    description: 'List available BSV Cluster Courses with completion status.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'takeCourse',
    description: 'Take a course quiz. Pass to unlock the teach capability and earn sats by teaching other Claws.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string', description: 'Course ID (e.g. "bsv-101")' },
        answers: { type: 'array', items: { type: 'string' }, description: 'Quiz answers' }
      },
      required: ['courseId', 'answers']
    }
  },
  {
    name: 'spreadMetrics',
    description: 'Get BSV education spread metrics — how far knowledge has propagated through the Claw network.',
    inputSchema: { type: 'object', properties: {} }
  },

  // ── On-Chain Memory Methods ─────────────────────────────────────
  {
    name: 'writeMemory',
    description: 'Write a memory record permanently on-chain via OP_RETURN.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key (unique identifier)' },
        data: { type: 'string', description: 'Data to store (max 100KB)' },
        category: { type: 'string', description: 'Optional category for organization' },
        encrypted: { type: 'boolean', description: 'Encrypt data before storing' },
        metadata: { type: 'object', description: 'Optional metadata' }
      },
      required: ['key', 'data']
    }
  },
  {
    name: 'readMemory',
    description: 'Read a memory record from the local index by key.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key to read' }
      },
      required: ['key']
    }
  },
  {
    name: 'listMemories',
    description: 'List all memory records, optionally filtered by category.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional category filter' }
      }
    }
  },
  {
    name: 'searchMemories',
    description: 'Search memory records by query string.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' }
      },
      required: ['query']
    }
  },
  {
    name: 'readMemoryFromChain',
    description: 'Fetch actual memory data from the blockchain (not just local index).',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key to fetch from chain' }
      },
      required: ['key']
    }
  },
  {
    name: 'writeMasterIndex',
    description: 'Write a master index on-chain mapping all memory keys to their txids. Save the returned txid to recover all memories later.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'recoverFromMasterIndex',
    description: 'Recover all memories from an on-chain master index txid.',
    inputSchema: {
      type: 'object',
      properties: {
        masterIndexTxid: { type: 'string', description: 'Master index transaction ID' }
      },
      required: ['masterIndexTxid']
    }
  },
  {
    name: 'memoryStats',
    description: 'Get on-chain memory statistics — total records, categories, storage usage.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'fetchFromChain',
    description: 'Fetch raw OP_RETURN data from any transaction ID on the blockchain.',
    inputSchema: {
      type: 'object',
      properties: {
        txid: { type: 'string', description: 'Transaction ID to fetch data from' }
      },
      required: ['txid']
    }
  },
  {
    name: 'verifyMemoryOnChain',
    description: 'Verify a memory record exists on-chain — fetches and checks hash integrity.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key to verify on-chain' },
        retries: { type: 'number', description: 'Number of retry attempts (default 3)' }
      },
      required: ['key']
    }
  },
  {
    name: 'getMasterIndexTxid',
    description: 'Get the current master index transaction ID — used for identity beacons and full memory recovery.',
    inputSchema: { type: 'object', properties: {} }
  }
]
