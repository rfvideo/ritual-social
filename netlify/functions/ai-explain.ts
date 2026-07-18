import type { Handler } from '@netlify/functions';
import { runInfernetJob, jsonResponse } from './_infernet-client';
import type { ExplainOutput } from '../../src/types';

const GLOSSARY: Record<string, string> = {
  ZK: 'Zero-Knowledge proofs let one party prove a statement is true without revealing the underlying data.',
  TEE: 'A Trusted Execution Environment is a secure, isolated area of a processor that runs code with confidentiality and integrity guarantees.',
  MPC: 'Multi-Party Computation lets several parties jointly compute a result over their private inputs without revealing those inputs to each other.',
  Inference: 'Inference is the step where a trained AI model produces an output (a prediction, translation, or generation) from new input data.',
  Restaking: 'Restaking lets already-staked assets secure additional protocols, extending economic security beyond a single network.',
  Rollup: 'A rollup executes transactions off the main chain and posts compressed data/proofs back, inheriting the base chain\u2019s security while scaling throughput.',
  Blockchain: 'A blockchain is a distributed, append-only ledger maintained by a network of nodes using consensus rules instead of a central authority.',
  'Smart Contract': 'A smart contract is self-executing code deployed on a blockchain that runs exactly as programmed once its conditions are met.',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const { term } = JSON.parse(event.body ?? '{}');
  if (!term) return jsonResponse({ error: 'term is required' }, 400);

  const job = await runInfernetJob<ExplainOutput>(
    { containerId: 'ritual-explain', input: { term } },
    () => ({
      term,
      explanation: GLOSSARY[term] ?? `No local definition available yet for "${term}".`,
    }),
  );

  return jsonResponse(job);
};
