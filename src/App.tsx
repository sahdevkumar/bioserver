import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Clock, 
  Database, 
  Laptop, 
  Fingerprint, 
  History, 
  Info, 
  LogIn, 
  LogOut, 
  RefreshCw, 
  Server, 
  Wifi, 
  WifiOff 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { AttendanceLog, DeviceStatus } from './types';

export default function App() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [devices, setDevices] = useState<Record<string, DeviceStatus>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isApiOnline, setIsApiOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setDevices(data.devices);
        setIsApiOnline(true);
      }
    } catch (err) {
      console.error('Failed to fetch state:', err);
      setIsApiOnline(false);
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial state
  useEffect(() => {
    fetchState();
  }, []);

  // WebSocket for real-time updates with polling fallback
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws: WebSocket | null = null;
    let pollInterval: any = null;

    const connectWS = () => {
      try {
        ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = () => {
          setIsConnected(true);
          setIsPolling(false);
          if (pollInterval) clearInterval(pollInterval);
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Start polling if WS fails (common on Vercel)
          if (!pollInterval) {
            setIsPolling(true);
            pollInterval = setInterval(fetchState, 5000);
          }
        };

        ws.onerror = () => {
          setIsConnected(false);
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_LOGS') {
            setLogs(prev => [...data.logs, ...prev].slice(0, 100));
          } else if (data.type === 'DEVICE_UPDATE') {
            setDevices(prev => ({
              ...prev,
              [data.device.sn]: data.device
            }));
          }
        };
      } catch (e) {
        console.error('WS Connection failed:', e);
        setIsPolling(true);
        pollInterval = setInterval(fetchState, 5000);
      }
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const deviceList = useMemo(() => Object.values(devices), [devices]);

  const getStateLabel = (state: number) => {
    switch (state) {
      case 0: return { label: 'Check-In', icon: LogIn, color: 'text-emerald-500' };
      case 1: return { label: 'Check-Out', icon: LogOut, color: 'text-rose-500' };
      case 4: return { label: 'Overtime-In', icon: LogIn, color: 'text-blue-500' };
      case 5: return { label: 'Overtime-Out', icon: LogOut, color: 'text-amber-500' };
      default: return { label: `State ${state}`, icon: Clock, color: 'text-slate-500' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Fingerprint className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Attendance Log Server</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
              isConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
              isPolling ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {isConnected ? <Wifi className="w-3 h-3" /> : isPolling ? <RefreshCw className="w-3 h-3 animate-spin" /> : <WifiOff className="w-3 h-3" />}
              {isConnected ? 'Real-time Online' : isPolling ? 'Connection Stable (Polling)' : 'Server Offline'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Configuration & Devices */}
          <div className="space-y-8">
            {/* Configuration Card */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-slate-500" />
                  <h2 className="font-semibold">Device Configuration</h2>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600">
                  Configure your Biomax BN60 device with these settings:
                </p>
                <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm text-slate-300 space-y-2">
                  <div><span className="text-slate-500"># Server IP:</span> {window.location.hostname}</div>
                  <div><span className="text-slate-500"># Server Port:</span> 3000</div>
                  <div><span className="text-slate-500"># Protocol:</span> HTTP (ADMS)</div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    Ensure the device is in the same network or the server is publicly accessible via your App URL.
                  </p>
                </div>
              </div>
            </section>

            {/* Devices Card */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-slate-500" />
                  <h2 className="font-semibold">Active Devices</h2>
                </div>
                <span className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                  {deviceList.length} Total
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {deviceList.length === 0 ? (
                  <div className="p-12 text-center">
                    <RefreshCw className="w-8 h-8 text-slate-300 mx-auto mb-3 animate-spin-slow" />
                    <p className="text-sm text-slate-400">Waiting for devices...</p>
                  </div>
                ) : (
                  deviceList.map(device => (
                    <div key={device.sn} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                          <Database className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{device.sn}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{device.ip}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Last Seen</div>
                        <div className="text-xs font-medium text-slate-600">
                          {format(new Date(device.lastSeen), 'HH:mm:ss')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Logs */}
          <div className="lg:col-span-2">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-500" />
                  <h2 className="font-semibold">Attendance Logs</h2>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => { setLoading(true); fetchState(); }}
                    className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
                    title="Refresh Logs"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">
                    Showing last 100 records
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">User ID</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timestamp</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Device SN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <AnimatePresence initial={false}>
                      {logs.map((log) => {
                        const stateInfo = getStateLabel(log.state);
                        return (
                          <motion.tr 
                            key={log.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="hover:bg-slate-50/50 transition-colors group"
                          >
                            <td className="px-6 py-4">
                              <div className="font-mono text-sm font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-block">
                                {log.userId}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-600">
                                {log.timestamp}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className={`flex items-center gap-2 text-sm font-medium ${stateInfo.color}`}>
                                <stateInfo.icon className="w-4 h-4" />
                                {stateInfo.label}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-xs text-slate-400 font-mono">
                                {log.deviceSn}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                    {logs.length === 0 && !loading && (
                      <tr>
                        <td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic">
                          No attendance logs received yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

        </div>
      </main>
    </div>
  );
}
