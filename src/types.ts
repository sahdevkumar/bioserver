export interface AttendanceLog {
  id: string;
  userId: string;
  timestamp: string;
  state: number; // 0 for Check-In, 1 for Check-Out, etc.
  verifyMode: number;
  deviceSn: string;
}

export interface DeviceStatus {
  sn: string;
  lastSeen: string;
  ip?: string;
  status: 'online' | 'offline';
}

export interface ServerState {
  logs: AttendanceLog[];
  devices: Record<string, DeviceStatus>;
}
