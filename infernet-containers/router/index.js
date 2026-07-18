/**
 * Minimal job-dispatch router.
 *
 * Stands in for an Infernet Node during self-hosted development: receives
 * the same { containerId, input, jobId } envelope the Netlify functions
 * send, forwards it to the matching container, and normalizes the response.
 *
 * Replace this file's role entirely once you're running a real Infernet
 * Node — see ../README.md.
 */
import express from 'express';

const app = express();
app.use(express.json({ limit: '15mb' }));

const CONTAINER_URLS = {
  'ritual-translate': process.env.TRANSLATE_URL || 'http://translate:8000',
  'ritual-caption': process.env.CAPTION_URL || 'http://caption:8000',
  'ritual-moderate': process.env.MODERATE_URL || 'http://moderate:8000',
};

app.post('/api/jobs', async (req, res) => {
  const { containerId, input, jobId } = req.body ?? {};
  const baseUrl = CONTAINER_URLS[containerId];

  if (!baseUrl) {
    return res.status(400).json({ error: `Unknown containerId: ${containerId}` });
  }

  try {
    const upstream = await fetch(`${baseUrl}/job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, jobId }),
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: `Container ${containerId} responded ${upstream.status}` });
    }
    const data = await upstream.json();
    return res.json({
      model: data.model ?? containerId,
      output: data.output,
      proof: data.proof ?? { type: 'none' },
    });
  } catch (err) {
    console.error(`[router] ${containerId} unreachable:`, err.message);
    return res.status(502).json({ error: `Container ${containerId} unreachable` });
  }
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`[router] listening on :${port}`));
