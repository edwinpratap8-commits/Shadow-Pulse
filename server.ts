import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Tactical Intel / Scout AI Endpoint
  app.post('/api/tactical-intel', async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(200).json({
          intel:
            'Tactical Field Advice: Seek elevation or dense tree cover. Avoid dead-ends with single exits. Maintain line of sight to open escape routes.',
          source: 'offline-tactical-manual',
        });
      }

      const { role, lat, lng, remainingTime, unfoundCount } = req.body;
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are the Tactical Dispatcher for a high-stakes outdoor live Hide and Seek game called ShadowPulse.
The player asking for intel has the role: ${role || 'HIDER'}.
Current coordinates: Latitude ${lat || '37.7749'}, Longitude ${lng || '-122.4194'}.
Overall game time remaining: ${remainingTime || '15:00'}.
Active unfound hiders: ${unfoundCount || 3}.
The radar cycle has a 30s warning and a 10s live GPS flash every 5 minutes.
Provide 2-3 concise, bulleted, high-intensity tactical recommendations for this player right now (e.g. stealth repositioning during safe phases, cover selection, prediction of Denner sweeping arcs, or search perimeter strategies).
Keep it punchy, military-dispatch tone, and under 90 words.`;

      // Try gemini-2.5-flash or gemini-3.8-flash
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text || 'Maintain stealth and observe enemy sweep vectors.';
      return res.json({ intel: text, source: 'gemini-tactical-ai' });
    } catch (error: any) {
      console.error('Tactical Intel API error:', error);
      return res.status(200).json({
        intel:
          'Tactical Dispatch: Maintain low profile. Reposition during the 4-minute radar silence. At 30s warning, freeze in dense cover.',
        source: 'fallback-tactical-protocol',
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ShadowPulse server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
