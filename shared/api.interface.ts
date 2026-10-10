export type QrSessionStatus = 'waiting' | 'connected' | 'transferring' | 'completed' | 'expired' | 'rejected';

export interface QrSessionInfo {
  code: string;
  status: QrSessionStatus;
  expiresAt: string;
  totalPhotos: number;
  receivedPhotos: number;
  /** 是否启用服务器中继（PC 端登录创建的会话才有，游客会话强制纯 P2P） */
  relayEnabled?: boolean;
}

export interface QrPhotoInfo {
  id: string;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  status: 'uploading' | 'ready' | 'received';
  sortOrder: number;
  createdAt: string;
}

export interface CreateSessionResponse {
  success: boolean;
  data: {
    code: string;
    desktopToken: string;
    mobileUrl: string;
    expiresAt: string;
  };
  message: string;
}

export interface SessionStatusResponse {
  success: boolean;
  data: {
    session: QrSessionInfo;
    photos: QrPhotoInfo[];
  };
  message: string;
}

export interface MobileJoinResponse {
  success: boolean;
  data: {
    session: QrSessionInfo;
    mobileToken: string;
  };
  message: string;
}

export interface MobileApproveRequest {
  code: string;
  mobileToken: string;
  totalPhotos: number;
}

export interface MobileRejectRequest {
  code: string;
  mobileToken: string;
}

export interface PhotoUploadRequest {
  code: string;
  mobileToken: string;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  filePath?: string;
  bucketId?: string;
  sortOrder: number;
}

export interface PhotoUploadResponse {
  success: boolean;
  data: QrPhotoInfo;
  message: string;
}

export interface DesktopAckRequest {
  code: string;
  desktopToken: string;
  photoIds: string[];
}

export interface DesktopCompleteRequest {
  code: string;
  desktopToken: string;
}

export interface SimpleResponse {
  success: boolean;
  message: string;
}

// ============ WebRTC 信令 ============

export type SignalRole = 'desktop' | 'mobile';
export type SignalType = 'offer' | 'answer' | 'ice';

export interface SignalMessage {
  type: SignalType;
  role: SignalRole;
  payload: string; // SDP 或 ICE candidate JSON 字符串
}

export interface SignalRequest {
  code: string;
  token: string;      // desktopToken 或 mobileToken
  role: SignalRole;
  message: SignalMessage;
}

export interface SignalResponse {
  success: boolean;
  // 对方角色发来的所有消息（offer/answer/ice），按发送顺序
  messages: SignalMessage[];
  message?: string;
}

export interface SignalPollResponse {
  success: boolean;
  messages: SignalMessage[];
  hasMore: boolean;
}
