import { encodeAbiParameters, decodeAbiParameters, parseAbiParameters, keccak256, toHex, hexToBytes } from 'viem';
import type { Hex, Address, PublicClient, WalletClient, TransactionReceipt } from 'viem';

export const LLM_PRECOMPILE = '0x0000000000000000000000000000000000000802' as const;
export const RITUAL_WALLET = '0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948' as const;
export const TEE_SERVICE_REGISTRY = '0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F' as const;
export const CAPABILITY_LLM = 1;
export const MODEL = 'zai-org/GLM-4.7-FP8';

const LLM_REQUEST_TYPES = [
  'address, bytes[], uint256, bytes[], bytes,',
  'string, string, int256, string, bool, int256, string, string,',
  'uint256, bool, int256, string, bytes, int256, string, string, bool,',
  'int256, bytes, bytes, int256, int256, string, bool,',
  '(string,string,string)',
].join('');

const RITUAL_WALLET_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'payable', inputs: [{ name: 'lockDuration', type: 'uint256' }], outputs: [] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'lockUntil', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

const TEE_REGISTRY_ABI = [
  {
    name: 'getServicesByCapability',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'capability', type: 'uint8' },
      { name: 'activeOnly', type: 'bool' },
    ],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          {
            name: 'node',
            type: 'tuple',
            components: [
              { name: 'paymentAddress', type: 'address' },
              { name: 'teeAddress', type: 'address' },
              { name: 'teeType', type: 'uint8' },
              { name: 'publicKey', type: 'bytes' },
              { name: 'endpoint', type: 'string' },
              { name: 'certPubKeyHash', type: 'bytes32' },
              { name: 'capability', type: 'uint8' },
            ],
          },
          { name: 'isValid', type: 'bool' },
          { name: 'workloadId', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    name: 'getCapabilityIndexStatus',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'capability', type: 'uint8' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'count', type: 'uint256' },
          { name: 'finalized', type: 'bool' },
          { name: 'lastUpdatedBlock', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'pickServiceByCapability',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'capability', type: 'uint8' },
      { name: 'activeOnly', type: 'bool' },
      { name: 'seed', type: 'uint256' },
      { name: 'maxProbes', type: 'uint256' },
    ],
    outputs: [
      { name: 'teeAddress', type: 'address' },
      { name: 'found', type: 'bool' },
    ],
  },
  {
    name: 'getIndexedServiceByCapabilityAt',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'capability', type: 'uint8' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [
      {
        type: 'tuple',
        components: [
          {
            name: 'node',
            type: 'tuple',
            components: [
              { name: 'paymentAddress', type: 'address' },
              { name: 'teeAddress', type: 'address' },
              { name: 'teeType', type: 'uint8' },
              { name: 'publicKey', type: 'bytes' },
              { name: 'endpoint', type: 'string' },
              { name: 'certPubKeyHash', type: 'bytes32' },
              { name: 'capability', type: 'uint8' },
            ],
          },
          { name: 'isValid', type: 'bool' },
          { name: 'workloadId', type: 'bytes32' },
        ],
      },
    ],
  },
] as const;

interface LLMExecutor {
  teeAddress: Address;
  publicKey: `0x${string}`;
}

export async function ensureRitualWalletFunded(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: Address,
  minBalanceWei = 400_000_000_000_000_000n,
  depositWei = 500_000_000_000_000_000n,
): Promise<void> {
  const [balance, lockUntil, currentBlock] = await Promise.all([
    publicClient.readContract({
      address: RITUAL_WALLET,
      abi: RITUAL_WALLET_ABI,
      functionName: 'balanceOf',
      args: [account],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: RITUAL_WALLET,
      abi: RITUAL_WALLET_ABI,
      functionName: 'lockUntil',
      args: [account],
    }) as Promise<bigint>,
    publicClient.getBlockNumber(),
  ]);

  const SAFE_LOCK_BUFFER = 1000n;
  const lockCoversCall = lockUntil >= currentBlock + SAFE_LOCK_BUFFER;

  if (balance >= minBalanceWei && lockCoversCall) return;

  const hash = await walletClient.writeContract({
    address: RITUAL_WALLET,
    abi: RITUAL_WALLET_ABI,
    functionName: 'deposit',
    args: [100_000n],
    value: balance >= minBalanceWei ? 1n : depositWei,
    account,
    chain: walletClient.chain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

function isValidExecutor(s: {
  node: {
    teeAddress: Address;
    publicKey: `0x${string}`;
    certPubKeyHash: `0x${string}`;
    endpoint: string;
  };
  isValid: boolean;
}): boolean {
  return (
    s.isValid &&
    s.node.teeAddress !== ZERO_ADDRESS &&
    s.node.publicKey !== '0x' &&
    s.node.publicKey.length > 2 &&
    s.node.certPubKeyHash !== ZERO_BYTES32 &&
    s.node.certPubKeyHash.length > 2 &&
    s.node.endpoint.length > 0
  );
}

export async function pickLLMExecutor(publicClient: PublicClient): Promise<LLMExecutor> {
  // The canonical registry on the live Ritual Chain (chain id 1979) exposes
  // pickServiceByCapability. The contract reverts for getCapabilityIndexStatus,
  // so we use the registry's own selector and then resolve the public key from
  // the full service list. See ritual-dapp-contracts / ritual-dapp-llm skills.
  const latestBlock = await publicClient.getBlock({ blockTag: 'latest' });
  const seed = BigInt(latestBlock.hash);

  let pickedAddress: Address | null = null;
  try {
    const [teeAddress, found] = (await publicClient.readContract({
      address: TEE_SERVICE_REGISTRY,
      abi: TEE_REGISTRY_ABI,
      functionName: 'pickServiceByCapability',
      args: [CAPABILITY_LLM, true, seed, 10n],
    })) as readonly [Address, boolean];
    if (found && teeAddress !== ZERO_ADDRESS) {
      pickedAddress = teeAddress;
    }
  } catch (err) {
    console.warn('[pickLLMExecutor] pickServiceByCapability failed, falling back to enumeration:', err);
  }

  // Resolve the full service list to obtain the public key and verify the
  // picked address is valid (non-zero public key, cert hash, and endpoint).
  const services = (await publicClient.readContract({
    address: TEE_SERVICE_REGISTRY,
    abi: TEE_REGISTRY_ABI,
    functionName: 'getServicesByCapability',
    args: [CAPABILITY_LLM, true],
  })) as readonly {
    node: {
      teeAddress: Address;
      publicKey: `0x${string}`;
      certPubKeyHash: `0x${string}`;
      endpoint: string;
    };
    isValid: boolean;
  }[];

  if (pickedAddress) {
    const match = services.find((s) => s.isValid && s.node.teeAddress === pickedAddress && isValidExecutor(s));
    if (match) {
      return { teeAddress: match.node.teeAddress, publicKey: match.node.publicKey };
    }
  }

  const valid = services.find(isValidExecutor);
  if (!valid) {
    throw new Error(
      'No LLM-capable executor is currently available on Ritual Chain. ' +
        'All registered services lack a public key, cert hash, or endpoint.',
    );
  }
  return { teeAddress: valid.node.teeAddress, publicKey: valid.node.publicKey };
}

async function fetchEncryptedSecret(executorPublicKey: `0x${string}`): Promise<`0x${string}`> {
  const res = await fetch('/.netlify/functions/ritual-da-secrets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ executorPublicKey }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Failed to prepare DA credentials: ${detail || res.status}`);
  }
  const { encryptedSecret } = (await res.json()) as { encryptedSecret: `0x${string}` };
  return encryptedSecret;
}

export interface LLMCallResult {
  hasError: boolean;
  pending?: boolean;
  errorMessage: string;
  content: string;
}

export interface LLMCallOptions {
  /**
   * Optional DA (conversation-history) storage ref.
   * Use `['', '', '']` when you don't need conversation history (e.g. one-shot
   * moderation). Defaults to empty so no off-chain storage credentials are
   * required, matching the official Ritual dapp-llm examples.
   */
  convoHistory?: [string, string, string];
  /** Custom inference timeout in blocks. Defaults to 300 (safe for GLM-4.7-FP8). */
  ttl?: bigint;
}

export async function callRitualLLM(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: Address,
  systemPrompt: string,
  userPrompt: string,
  options: LLMCallOptions = {},
): Promise<LLMCallResult> {
  const executor = await pickLLMExecutor(publicClient);

  const convoHistory: [string, string, string] = options.convoHistory ?? ['', '', ''];
  const ttl = options.ttl ?? 300n;
  const requiresDA = convoHistory[0] !== '' || convoHistory[2] !== '';

  let encryptedSecrets: `0x${string}`[] = [];
  let secretSignatures: `0x${string}`[] = [];

  if (requiresDA) {
    // Only encrypt DA credentials when we actually need off-chain storage.
    // The executor uses the keyRef in convoHistory to look up the decrypted
    // secret; for the look-up to work the secret value must be a plain string
    // (not nested JSON). See ritual-dapp-da.
    const encryptedSecret = await fetchEncryptedSecret(executor.publicKey);
    const encryptedSecretBytes = hexToBytes(encryptedSecret);
    const secretSignature = await walletClient.signMessage({
      account,
      message: { raw: encryptedSecretBytes },
    });
    encryptedSecrets = [encryptedSecret];
    secretSignatures = [secretSignature];
  }

  const messagesJson = JSON.stringify([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  const encoded: Hex = encodeAbiParameters(parseAbiParameters(LLM_REQUEST_TYPES), [
    executor.teeAddress,
    encryptedSecrets,
    ttl,
    secretSignatures,
    '0x',
    messagesJson,
    MODEL,
    0n,
    '',
    false,
    4096n,
    '',
    '',
    1n,
    true,
    0n,
    'medium',
    '0x',
    -1n,
    'auto',
    '',
    false,
    200n,
    '0x',
    '0x',
    -1n,
    1000n,
    '',
    false,
    convoHistory,
  ]);

  const hash = await walletClient.sendTransaction({
    to: LLM_PRECOMPILE,
    data: encoded,
    gas: 3_000_000n,
    account,
    chain: walletClient.chain,
  });

  const POLL_INTERVAL_MS = 4000;
  const MAX_WAIT_MS = 110_000;
  const startedAt = Date.now();

  let lastResult: LLMCallResult = { hasError: true, errorMessage: 'Timed out waiting for settlement.', content: '' };
  let attempts = 0;

  while (Date.now() - startedAt < MAX_WAIT_MS) {
    attempts++;
    try {
      // Ritual Chain adds a custom `spcCalls` field to the receipt. viem's
      // typed TransactionReceipt does not declare it, so we read the raw RPC
      // response and cast it to our RitualReceipt extension.
      const receipt = (await publicClient.request({
        method: 'eth_getTransactionReceipt',
        params: [hash],
      })) as TransactionReceipt & RitualReceipt;

      const decoded = decodeLLMReceipt(receipt);
      if (!decoded.pending) {
        return decoded;
      }
      lastResult = {
        ...decoded,
        errorMessage: `${decoded.errorMessage} — checked ${attempts}x over ${Math.round((Date.now() - startedAt) / 1000)}s`,
      };
    } catch {
      lastResult = {
        hasError: true,
        pending: true,
        errorMessage: `Transaction temporarily not found (settlement in progress) — checked ${attempts}x over ${Math.round((Date.now() - startedAt) / 1000)}s`,
        content: '',
      };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return lastResult;
}

/**
 * Ritual Chain extends the standard transaction receipt with an `spcCalls`
 * field for short-running async precompiles (HTTP 0x0801, LLM 0x0802).
 * The settled result is here — NOT in the receipt logs. viem does not know
 * this field by default, so we cast it from the raw receipt.
 */
interface RitualReceipt {
  spcCalls?: Array<{ input: Hex; output: Hex }>;
}

function extractSpcOutput(receipt: TransactionReceipt): Hex | null {
  const ritual = receipt as unknown as RitualReceipt;
  const calls = ritual.spcCalls;
  if (!calls || calls.length === 0) return null;
  // At most one short-running async precompile per transaction; the LLM
  // precompile's settled output is the first (and only) spcCall entry.
  return calls[0].output;
}

function decodeLLMReceipt(receipt: TransactionReceipt): LLMCallResult {
  if (receipt.status === 'reverted') {
    return {
      hasError: true,
      errorMessage: `Transaction reverted on-chain (not an async-settlement issue). Block ${receipt.blockNumber}, gasUsed ${receipt.gasUsed}.`,
      content: '',
    };
  }

  const raw = extractSpcOutput(receipt);

  if (!raw || raw === '0x') {
    const detail = receipt.logs.length === 0
      ? 'spcCalls not yet present on receipt'
      : `spcCalls not yet present on receipt (receipt has ${receipt.logs.length} log(s), but short-running async precompiles write results to spcCalls, not logs)`;
    return { hasError: true, pending: true, errorMessage: `Not settled yet (${detail})`, content: '' };
  }

  const [hasError, completionData, , errorMessage] = decodeAbiParameters(
    parseAbiParameters('bool, bytes, bytes, string, (string,string,string)'),
    raw,
  ) as [boolean, Hex, Hex, string, [string, string, string]];

  if (hasError) {
    return { hasError: true, errorMessage, content: '' };
  }

  try {
    const [, , , , , , choicesCount, choicesData] = decodeAbiParameters(
      parseAbiParameters('string, string, uint256, string, string, string, uint256, bytes[], bytes'),
      completionData,
    ) as [string, string, bigint, string, string, string, bigint, Hex[], Hex];

    if (choicesCount === 0n || choicesData.length === 0) {
      return { hasError: true, errorMessage: 'Model returned no choices.', content: '' };
    }

    const [, , messageData] = decodeAbiParameters(
      parseAbiParameters('uint256, string, bytes'),
      choicesData[0],
    ) as [bigint, string, Hex];

    const [, content] = decodeAbiParameters(
      parseAbiParameters('string, string, string, uint256, bytes[]'),
      messageData,
    ) as [string, string, string, bigint, Hex[]];

    return { hasError: false, errorMessage: '', content };
  } catch {
    return { hasError: true, errorMessage: 'Failed to decode model response.', content: '' };
  }
}
