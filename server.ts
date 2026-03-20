import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import bodyParser from 'body-parser';
import { AttendanceLog, DeviceStatus } from './src/types.ts';

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// In-memory storage for logs and device status
const logs: AttendanceLog[] = [];
const devices: Record<string, DeviceStatus> = {};

// Helper to broadcast data to all connected WebSocket clients
function broadcast(data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// iClock Protocol Handlers
app.use('/iclock', bodyParser.text({ type: '*/*', limit: '10mb' }));

// 1. Initialization / Heartbeat
app.get('/iclock/cdata', (req, res) => {
  const sn = req.query.SN as string;
  const ip = req.ip;

  if (sn) {
    devices[sn] = {
      sn,
      lastSeen: new Date().toISOString(),
      ip,
      status: 'online',
    };
    console.log(`Device connected: ${sn} from ${ip}`);
    broadcast({ type: 'DEVICE_UPDATE', device: devices[sn] });
  }

  // Standard response for initialization
  res.send('OK');
});

// 2. Data Upload (Attendance Logs)
app.post('/iclock/cdata', (req, res) => {
  const sn = req.query.SN as string;
  const table = req.query.table as string;
  const body = req.body as string;

  if (sn && table === 'ATTLOG') {
    const lines = body.split('\n').filter(line => line.trim());
    const newLogs: AttendanceLog[] = [];

    lines.forEach(line => {
      // Standard format: USERID\tTIME\tSTATE\tVERIFY\t...
      // Or: USERID=1\tTIME=2023-10-20 08:30:00\t...
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const log: AttendanceLog = {
          id: Math.random().toString(36).substr(2, 9),
          userId: parts[0].includes('=') ? parts[0].split('=')[1] : parts[0],
          timestamp: parts[1].includes('=') ? parts[1].split('=')[1] : parts[1],
          state: parseInt(parts[2]?.includes('=') ? parts[2].split('=')[1] : parts[2] || '0'),
          verifyMode: parseInt(parts[3]?.includes('=') ? parts[3].split('=')[1] : parts[3] || '0'),
          deviceSn: sn,
        };
        newLogs.push(log);
        logs.unshift(log); // Add to beginning
      }
    });

    if (newLogs.length > 0) {
      console.log(`Received ${newLogs.length} logs from ${sn}`);
      broadcast({ type: 'NEW_LOGS', logs: newLogs });
    }

    // Keep logs array size manageable
    if (logs.length > 1000) logs.splice(1000);
  }

  res.send('OK');
});

// 3. Command Polling (The device checks for commands from the server)
app.get('/iclock/getrequest', (req, res) => {
  const sn = req.query.SN as string;
  if (sn && devices[sn]) {
    devices[sn].lastSeen = new Date().toISOString();
    broadcast({ type: 'DEVICE_UPDATE', device: devices[sn] });
  }
  
  // Return OK if no commands are pending
  res.send('OK');
});

// 4. Command Response
app.post('/iclock/devicecmd', (req, res) => {
  res.send('OK');
});

// API for Frontend
app.get('/api/state', (req, res) => {
  res.json({ logs, devices });
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

export default app;

setupVite().then(() => {
  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Attendance Server running on http://0.0.0.0:${PORT}`);
    console.log(`Configure your Biomax BN60 to point to this URL.`);
  });
});
