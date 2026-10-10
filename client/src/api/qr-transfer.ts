import axios from 'axios';
import { getToken } from './auth-store';
import type {
  CreateSessionResponse,
  SessionStatusResponse,
  MobileJoinResponse,
  MobileApproveRequest,
  PhotoUploadRequest,
  PhotoUploadResponse,
  DesktopAckRequest,
  DesktopCompleteRequest,
  SimpleResponse,
  SignalRequest,
  SignalResponse,
} from '@shared/api.interface';

const http = axios.create({
  baseURL: '',
  timeout: 30000,
});

// 自动注入 JWT
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function createSession(): Promise<CreateSessionResponse> {
  const response = await http.post<CreateSessionResponse>('/api/qr/sessions');
  return response.data;
}

export interface ShortcutBackupSession {
  code: string;
  mobileToken: string;
  shortcutId: string;
  uploadUrl: string;
  configUrl: string;
  completeUrl: string;
  serverUrl: string;
  expiresAt: string;
}

export async function createShortcutSession(): Promise<{
  success: boolean;
  data: ShortcutBackupSession;
  message: string;
}> {
  const response = await http.post('/api/shortcut/sessions');
  return response.data;
}

export async function getSessionStatus(code: string, desktopToken: string): Promise<SessionStatusResponse> {
  const response = await http.get<SessionStatusResponse>(`/api/qr/sessions/${code}/status`, {
    params: { desktopToken },
  });
  return response.data;
}

export async function mobileJoin(code: string): Promise<MobileJoinResponse> {
  const response = await http.post<MobileJoinResponse>(`/api/qr/sessions/${code}/join`);
  return response.data;
}

export async function mobileApprove(body: MobileApproveRequest): Promise<SimpleResponse> {
  const response = await http.post<SimpleResponse>(`/api/qr/sessions/${body.code}/approve`, body);
  return response.data;
}

export async function mobileReject(code: string, mobileToken: string): Promise<SimpleResponse> {
  const response = await http.post<SimpleResponse>(`/api/qr/sessions/${code}/reject`, { mobileToken });
  return response.data;
}

export async function uploadPhoto(body: PhotoUploadRequest): Promise<PhotoUploadResponse> {
  const response = await http.post<PhotoUploadResponse>(`/api/qr/sessions/${body.code}/photos`, body);
  return response.data;
}

export async function desktopAck(body: DesktopAckRequest): Promise<SimpleResponse> {
  const response = await http.post<SimpleResponse>(`/api/qr/sessions/${body.code}/ack`, body);
  return response.data;
}

export async function desktopComplete(body: DesktopCompleteRequest): Promise<SimpleResponse> {
  const response = await http.post<SimpleResponse>(`/api/qr/sessions/${body.code}/complete`, body);
  return response.data;
}

// 手机端拉 session 状态（不传 token，公开接口）
export async function getSessionStatusPublic(code: string): Promise<SessionStatusResponse> {
  const response = await http.get<SessionStatusResponse>(`/api/qr/sessions/${code}/status`);
  return response.data;
}

// 直接上传文件到后端（替代 dataloom.storage.uploadFile）
export async function uploadFileToServer(
  code: string,
  mobileToken: string,
  file: File,
  sortOrder: number,
): Promise<PhotoUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('code', code);
  formData.append('mobileToken', mobileToken);
  formData.append('fileName', file.name);
  formData.append('fileSize', String(file.size));
  formData.append('sortOrder', String(sortOrder));

  const response = await http.post<PhotoUploadResponse>(
    `/api/qr/sessions/${code}/photos-upload`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    },
  );
  return response.data;
}

// ============ WebRTC 信令 ============

export async function sendSignal(body: SignalRequest): Promise<SignalResponse> {
  const { code, ...rest } = body;
  const response = await http.post<SignalResponse>(`/api/qr/sessions/${code}/signal`, rest);
  return response.data;
}

export async function pollSignals(
  code: string,
  token: string,
  role: 'desktop' | 'mobile',
): Promise<SignalResponse> {
  const response = await http.get<SignalResponse>(`/api/qr/sessions/${code}/signals`, {
    params: { token, role },
  });
  return response.data;
}

// ============ 永久码（打印店场景） ============

export async function createSessionFromPermanentCode(permanentCode: string): Promise<{
  code: string;
  mobileToken: string;
  user: { username: string; shopName: string | null };
}> {
  const response = await http.post(`/api/qr/sessions/from-permanent/${permanentCode}`);
  return response.data;
}
