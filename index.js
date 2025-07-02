// index.js
const express = require('express');
const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');
const { PredictionServiceClient } = require('@google-cloud/aiplatform').v1;

const app = express();
app.use(express.json());

const PROJECT_ID = 'main-shade-160919';
const LOCATION = 'us-central1';
const MODEL = 'veo-3.0-generate-preview';
const BASE = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}`;

// Lê da variável de ambiente (Railway)
const jsonKey = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

const auth = new GoogleAuth({
  credentials: {
    client_email: jsonKey.client_email,
    private_key: jsonKey.private_key,
  },
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

const client = new PredictionServiceClient({
  credentials: {
    client_email: jsonKey.client_email,
    private_key: jsonKey.private_key,
  },
  projectId: jsonKey.project_id,
});

app.post('/generate-video', async (req, res) => {
  try {
    const { prompt } = req.body;
    const token = await auth.getAccessToken();

    // 1) dispara a geração
    const { data: { name } } = await axios.post(
      `${BASE}:predictLongRunning`,
      {
        instances: [{ prompt }],
        parameters: { durationSeconds: 8, generateAudio: true, aspectRatio: '16:9' },
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // 2) polling até ficar pronto
    let uri = null;
    while (!uri) {
      await new Promise(r => setTimeout(r, 10000));
      const op = await axios.get(
        `https://us-central1-aiplatform.googleapis.com/v1/${name}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).catch(() => ({ data: {} }));

      if (op.data.done && op.data.response?.predictions?.[0]?.videoUri) {
        uri = op.data.response.predictions[0].videoUri;
      }
    }

    return res.json({ videoUri: uri });
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Listening on', port));
