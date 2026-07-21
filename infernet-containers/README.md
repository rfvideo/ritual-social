# Ritual Social — self-hosted AI compute layer

This folder contains the job containers that form the Infernet-compatible
compute layer for Ritual Social. Each container is a plain HTTP service that
receives a `{ input, jobId }` JSON body at `POST /job` and returns
`{ model, output, proof }`. The `router/` service dispatches jobs to the right
container by `containerId`.

```
Netlify Function (ai-translate, ai-caption, …)
        │  POST { containerId, input, jobId }
        ▼
   router/  (:4000) — job dispatcher, mirrors an Infernet Node's interface
        │  forwards to the matching container
        ▼
translate/ | caption/ | moderate/ | summarize/ | recommend/
```

## Containers

| containerId | Container | Model | Notes |
|---|---|---|---|
| `ritual-translate` | `translate/` | `facebook/nllb-200-distilled-600M` | 200+ languages, ~2.4 GB |
| `ritual-caption` | `caption/` | `Salesforce/blip-image-captioning-base` | Vision → text, ~1 GB |
| `ritual-moderate` | `moderate/` | `unitary/toxic-bert` + regex | Toxicity + spam/phishing, ~250 MB |
| `ritual-summarize` | `summarize/` | `facebook/bart-large-cnn` | Abstractive summary, ~1.6 GB |
| `ritual-recommend` | `recommend/` | Engagement-gravity ranking | No model download — starts instantly |

All models run **entirely on your own infrastructure** — no third-party AI API
calls (OpenAI, Gemini, Anthropic, etc.).

## Running locally

```bash
cd infernet-containers
docker compose up --build
```

This starts `router` on `:4000` and all containers on internal ports. Set
`INFERNET_ROUTER_URL=http://localhost:4000` in your root `.env`.

**First-request cold start times** (model download + load):

| Container | First request | Subsequent |
|---|---|---|
| `translate` | ~60–120 s (2.4 GB download) | ~0.5–2 s |
| `caption` | ~30–60 s (~1 GB download) | ~1–3 s |
| `moderate` | ~15–30 s (~250 MB download) | ~50–200 ms |
| `summarize` | ~60–90 s (~1.6 GB download) | ~1–4 s |
| `recommend` | instant | instant |

To pre-warm a container after deploy (avoids slow first user request):

```bash
# translate
curl -X POST http://localhost:4000/api/jobs \
  -H 'Content-Type: application/json' \
  -d '{"containerId":"ritual-translate","input":{"text":"hello","targetLanguage":"id"}}'

# caption
curl -X POST http://localhost:4000/api/jobs \
  -H 'Content-Type: application/json' \
  -d '{"containerId":"ritual-caption","input":{"imageURIs":["https://picsum.photos/400"]}}'

# moderate
curl -X POST http://localhost:4000/api/jobs \
  -H 'Content-Type: application/json' \
  -d '{"containerId":"ritual-moderate","input":{"text":"hello world"}}'

# summarize
curl -X POST http://localhost:4000/api/jobs \
  -H 'Content-Type: application/json' \
  -d '{"containerId":"ritual-summarize","input":{"threadText":"This is a test thread."}}'
```

## Where to host

Any Docker host reachable over HTTP: DigitalOcean, Hetzner, Railway, Render,
Fly.io, or a bare VPS. Only `router` (:4000) needs to be publicly reachable —
the individual containers communicate over the private Docker network.

```
INFERNET_ROUTER_URL=https://your-vps-ip-or-domain:4000
```

## On-chain AI path (independent of these containers)

These containers handle features where you want **fast, self-hosted inference**.
A separate, independent path — the **Ritual Chain LLM precompile** — handles
features that need **on-chain attestation / verifiable proofs**:

- Content moderation (`useRitualModeration.ts`, `useRitualLLM.ts`)
- Any feature using `callRitualLLM()` in `src/lib/ritualLLM.ts`

That path sends a transaction directly to precompile `0x0000000000000000000000000000000000000802`
on Ritual Chain, where a TEE executor settles it on-chain. No container
involvement — it is entirely independent of `INFERNET_ROUTER_URL`.

## Migrating to a real Infernet Node

When you're ready to run an official Infernet Node:

1. Package each container per the
   [`infernet-container-starter`](https://github.com/ritual-net/infernet-container-starter)
   template.
2. Register them in your Infernet Node's `config.json`.
3. Update `RitualSocial.sol` (or a dedicated consumer contract) to call
   Infernet via its Subscription/Callback interface instead of the Netlify
   function → router HTTP path.
4. Wire the real attestation from your node's response into
   `InfernetJobResult.proof` in `src/types/index.ts` — the shape is already
   there; you just need to populate `attestation` and `verifiedAt`.
