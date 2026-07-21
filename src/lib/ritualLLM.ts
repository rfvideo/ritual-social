import { encodeAbiParameters, decodeAbiParameters, parseAbiParameters, keccak256, toHex } from 'viem';
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
] as const;

const TEE_REGISTRY_ABI = [
  {
    name: 'pickServiceByCapability',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'capability', type: 'uint8' },
      { name: 'checkValidity', type: 'bool' },
      { name: 'seed', type: 'uint256' },
      { name: 'maxProbes', type: 'uint256' },
    ],
    outputs: [
      { name: 'teeAddress', type: 'address' },
      { name: 'found', type: 'bool' },
    ],
  },
] as const;

export async function ensureRitualWalletFunded(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: Address,
  minBalanceWei = 400_000_000_000_000_000n,
  depositWei = 500_000_000_000_000_000n,
): Promise<void> {
  const balance = (await publicClient.readContract({
    address: RITUAL_WALLET,
    abi: RITUAL_WALLET_ABI,
    functionName: 'balanceOf',
    args: [account],
  })) as bigint;

  if (balance >= minBalanceWei) return;

  const hash = await walletClient.writeContract({
    address: RITUAL_WALLET,
    abi: RITUAL_WALLET_ABI,
    functionName: 'deposit',
    args: [5000n],
    value: depositWei,
    account,
    chain: walletClient.chain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

export async function pickLLMExecutor(publicClient: PublicClient): Promise<Address> {
  const [teeAddress, found] = (await publicClient.readContract({
    address: TEE_SERVICE_REGISTRY,
    abi: TEE_REGISTRY_ABI,
    functionName: 'pickServiceByCapability',
    args: [CAPABILITY_LLM, true, BigInt(Math.floor(Math.random() * 1_000_000)), 8n],
  })) as [Address, boolean];

  if (!found || teeAddress === '0x0000000000000000000000000000000000000000') {
    throw new Error('No LLM-capable executor is currently available on Ritual Chain.');
  }
  return teeAddress;
}

export interface LLMCallResult {
  hasError: boolean;
  pending?: boolean;
  errorMessage: string;
  content: string;
}

export async function callRitualLLM(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: Address,
  systemPrompt: string,
  userPrompt: string,
): Promise<LLMCallResult> {
  const executor = await pickLLMExecutor(publicClient);

  const messagesJson = JSON.stringify([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  const encoded: Hex = encodeAbiParameters(parseAbiParameters(LLM_REQUEST_TYPES), [
    executor,
    [],
    300n,
    [],
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
    ['', '', ''] as [string, string, string],
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
      const receipt = await publicClient.getTransactionReceipt({ hash });
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

function decodeLLMReceipt(receipt: TransactionReceipt): LLMCallResult {
  if (receipt.status === 'reverted') {
    return {
      hasError: true,
      errorMessage: `Transaction reverted on-chain (not an async-settlement issue). Block ${receipt.blockNumber}, gasUsed ${receipt.gasUsed}.`,
      content: '',
    };
  }

  const PRECOMPILE_CALLED_TOPIC = keccak256(toHex('PrecompileCalled(address,bytes,bytes)'));

  let raw: Hex | null = null;
  let matchingLogFound = false;

  for (const log of receipt.logs) {
    if (log.topics[0] !== PRECOMPILE_CALLED_TOPIC) continue;
    const [addr, , output] = decodeAbiParameters(parseAbiParameters('address, bytes, bytes'), log.data);
    if ((addr as string).toLowerCase() !== LLM_PRECOMPILE) continue;

    matchingLogFound = true;
    try {
      const [, actual] = decodeAbiParameters(parseAbiParameters('bytes, bytes'), output as Hex);
      raw = actual as Hex;
    } catch {
      raw = output as Hex;
    }
    break;
  }

  if (!raw || raw === '0x') {
    const detail = matchingLogFound
      ? 'PrecompileCalled log found but its output is still empty'
      : `no PrecompileCalled log for 0x0802 among ${receipt.logs.length} log(s)`;
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
