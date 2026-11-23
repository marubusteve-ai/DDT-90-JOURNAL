import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT ?? 3000);
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '1mb' }));

  // System health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'ddt-90-journal',
      stage: 0,
      timestamp: new Date().toISOString(),
    });
  });

  // Honest capability manifest (never exposes secret values)
  app.get('/api/system/capabilities', (_req, res) => {
    const hasFirebaseConfig = fs.existsSync(path.resolve(__dirname, 'firebase-applet-config.json'));
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    res.json({
      stage: 0,
      auth: {
        provider: 'firebase_google',
        configured: hasFirebaseConfig,
      },
      persistence: {
        provider: 'cloud_firestore',
        configured: hasFirebaseConfig,
      },
      aiCoach: {
        stageTarget: 'Stage 5+',
        implemented: false,
        serverSecretConfigured: hasGeminiKey,
      },
      brokerSync: {
        implemented: false,
        note: 'Planned for future stages; manual account entry and verified snapshots active in Stage 0.',
      },
    });
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DDT-90 JOURNAL server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start DDT-90 JOURNAL server:', err);
  process.exit(1);
});
