import 'dotenv/config';
import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMcpServer } from './mcp-server.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3333;
const API_KEY = process.env.API_KEY ?? '';

const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req, res) => {
  if (API_KEY) {
    const auth = (req.headers.authorization ?? req.query['key']) as string;
    if (auth !== `Bearer ${API_KEY}` && auth !== API_KEY) {
      res.status(401).send('Unauthorized');
      return;
    }
  }

  const transport = new SSEServerTransport('/message', res);
  transports.set(transport.sessionId, transport);
  res.on('close', () => transports.delete(transport.sessionId));

  const server = createMcpServer();
  await server.connect(transport);
});

app.post('/message', async (req, res) => {
  const sessionId = req.query['sessionId'] as string;
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).send('Session not found');
    return;
  }
  await transport.handlePostMessage(req, res);
});

app.listen(PORT, () => {
  console.log(`MCP Server running on http://0.0.0.0:${PORT}`);
  console.log(`SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.log(`DB Server URL: ${process.env.DB_SERVER_URL ?? 'http://localhost:3334'}`);
});
