import axios from 'axios';
import { getToken } from './auth-store';
import type { AuthUser } from './auth-store';

const http = axios.create({ baseURL: '', timeout: 15000 });

export async function register(username: string, password: string, shopName?: string): Promise<{ token: string; user: AuthUser }> {
  const res = await http.post('/api/auth/register', { username, password, shopName });
  return res.data;
}

export async function login(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await http.post('/api/auth/login', { username, password });
  return res.data;
}

export async function me(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await http.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    return res.data || null;
  } catch {
    return null;
  }
}
