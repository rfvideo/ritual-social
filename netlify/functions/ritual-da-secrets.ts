import type { Handler } from '@netlify/functions';
import { encrypt, ECIES_CONFIG } from 'eciesjs';

// Ritual's executor uses a 12-byte ECIES nonce; both eciesjs (TS) and
// eciespy (Py) default to 16. A mismatch causes SILENT decryption failure
// (tx mines, DA ops fail with no error). This line is mandatory.
ECIES_CONFIG.symmetricNonceLength = 12;

/**
 * Encrypts the Pinata DA credentials to a given executor public key so the
 * LLM precompile's convoHistory/output StorageRefs can actually persist.
 *
 * Runs server-side ONLY so the Pinata JWT never reaches the browser.
 * The frontend passes the executor's public key (from TEEServiceRegistry,
 * which is public info) and gets back the ciphertext blob to drop into the
 * precompile's `encryptedSecrets` array.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return { statusCode: 500, body: JSON.stringify({ error: 'PINATA_JWT not configured' }) };
  }

  let executorPublicKey: string;
  try {
    const body = JSON.parse(event.body ?? '{}');
    executorPublicKey = body.executorPublicKey;
    if (!executorPublicKey || typeof executorPublicKey !== 'string') {
      throw new Error('missing executorPublicKey');
    }
  } catch (err: any) {
    return { statusCode: 400, body: JSON.stringify({ error: err.message ?? 'bad request' }) };
  }

  try {
    const gateway = process.env.VITE_IPFS_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs';

    // The DA layer expects, per platform, a specific credential shape.
    // Pinata: JSON object with { jwt, gateway_url }, stored under a keyRef
    // that the StorageRef references (we use 'DA_PINATA_JWT').
    const secretsJson = JSON.stringify({
      DA_PINATA_JWT: JSON.stringify({
        jwt,
        gateway_url: gateway.replace(/\/$/, ''),
      }),
    });

    // eciesjs expects the pubkey without the 0x prefix.
    const pubkeyHex = executorPublicKey.startsWith('0x') ? executorPublicKey.slice(2) : executorPublicKey;
    const encryptedBytes = encrypt(pubkeyHex, Buffer.from(secretsJson));
    const encryptedSecret = `0x${Buffer.from(encryptedBytes).toString('hex')}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encryptedSecret }),
    };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message ?? 'encryption failed' }) };
  }
};
