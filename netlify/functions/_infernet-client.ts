/**
 * Shared client for talking to an Infernet Router / Node that YOU deploy
 * and control (see /infernet-containers for example job containers).
 *
 * This file intentionally never calls a third-party AI vendor (OpenAI,
 * Gemini, Anthropic, etc). If INFERNET_ROUTER_URL is not configured, each
 * function below falls back to a small local heuristic so the product
 * still functions end-to-end while you finish standing up your node —
 * the fallback is clearly labeled in the response so it's never mistaken
 * for a verified Infernet result.
 */

import { randomUUID } from 'node:crypto';
import type { InfernetJobResult } from '../../src/types';

interface InfernetRequest {
  containerId: string; // matches a container in /infernet-containers
  input: Record<string, unknown>;
}

const ROUTER_URL = process.env.INFERNET_ROUTER_URL;
const API_KEY = process.env.INFERNET_API_KEY;

export async function runInfernetJob<T>(
  req: InfernetRequest,
  fallback: () => T,
): Promise<InfernetJobResult<T>> {
  const start = Date.now();
  const jobId = randomUUID();

  if (ROUTER_URL) {
    try {
      const res = await fetch(`${ROUTER_URL.replace(/\/$/, '')}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
        },
        body: JSON.stringify({ ...req, jobId }),
        // Infernet containers can be slow (cold-start GPU inference) — give it real room.
        signal: AbortSignal.timeout(25_000),
      });

      if (!res.ok) throw new Error(`Infernet node responded ${res.status}`);
      const data = await res.json();

      return {
        jobId,
        status: 'completed',
        model: data.model ?? req.containerId,
        output: data.output as T,
        proof: data.proof ?? { type: 'none' },
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      // Fall through to local fallback below — network/node issues shouldn't 500 the app.
      console.error(`[infernet] ${req.containerId} job failed, using fallback:`, err);
    }
  }

  return {
    jobId,
    status: 'completed',
    model: `${req.containerId}-local-fallback`,
    output: fallback(),
    proof: { type: 'none' },
    latencyMs: Date.now() - start,
  };
}

export function jsonResponse(body: unknown, statusCode = 200) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
