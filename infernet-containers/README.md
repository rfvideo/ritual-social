# Ritual Social — self-hosted AI compute layer

Ritual's actual Infernet stack integrates with smart contracts through the
Infernet SDK (Subscription/Callback pattern) and Infernet Nodes that you run
yourself — there is no public hosted "Ritual AI" endpoint to call directly.
See: https://www.ritualfoundation.org/docs

To ship a working product **today**, this folder gives you a small
self-hosted compute layer that mirrors that architecture closely enough to
swap in the real thing later without touching the frontend:

```
Netlify Function (ai-translate, ai-caption, ...)
        │  POST { containerId, input, jobId }
        ▼
   router/  (tiny HTTP dispatcher — stands in for an Infernet Node)
        │  forwards to the right container by containerId
        ▼
translate/ | caption/ | moderate/   (one container per AI job type)
```

Point `INFERNET_ROUTER_URL` (see root `.env.example`) at wherever you deploy
`router/`. Each container is a plain HTTP service — replace the placeholder
logic inside with real models (HuggingFace/PyTorch/ONNX, as Infernet's own
`infernet-ml` supports) whenever you're ready, and no other code changes are
required.

## Running locally

```bash
cd infernet-containers
docker compose up --build
```

This starts `router` on :4000, plus `translate`, `caption`, and `moderate` on
internal ports. Set `INFERNET_ROUTER_URL=http://localhost:4000` in your
frontend `.env` to use it.

**About `caption`:** this container runs a real open-source vision model
(BLIP, `Salesforce/blip-image-captioning-base`) — it actually looks at the
image and describes it, not a canned string. The model downloads (~1GB) and
loads into memory on the **first** request after the container starts, which
can take 30-60s; every request after that is fast (1-3s on CPU). To avoid a
slow first real user request, "warm up" the container right after deploying:

```bash
curl -X POST http://your-host:8000/job \
  -H "Content-Type: application/json" \
  -d '{"input":{"imageURIs":["https://picsum.photos/400"]}}'
```

Netlify Functions on the free plan time out around 10s — if your caption
requests are timing out from the app (rather than the container itself
being slow), that's the Netlify-side limit, not the container. Either warm
the container up before traffic hits it, or move `ai-caption` to a Netlify
plan/function type with a longer timeout.

## Where to host this

Any place that can run a Docker container and stays reachable over HTTP works:
a small VPS (DigitalOcean, Hetzner, etc), Railway, Render, or Fly.io all have
usable free/cheap tiers. Point `INFERNET_ROUTER_URL` at wherever `router`
ends up — the containers don't need to be public individually, only `router`
does (it talks to the others over the private Docker network).

## Migrating to real Ritual infrastructure

When Ritual Chain / Infernet access is available to you beyond a private
testnet, the natural upgrade path is:

1. Package each container per the `infernet-container-starter` template
   (https://github.com/ritual-net/infernet-container-starter).
2. Register them with your Infernet Node's `config.json`.
3. Have `RitualSocial.sol` (or a dedicated consumer contract) call Infernet
   via its Subscription/Callback interface instead of a Netlify function
   calling `router/` over plain HTTP.
4. Surface the returned proof/attestation in the UI — `InfernetJobResult.proof`
   in `src/types/index.ts` already has the shape for this; wire real
   attestation data into it once your node returns one.
