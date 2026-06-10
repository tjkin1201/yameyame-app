/**
 * Band OAuth 인증 서비스
 * - 브라우저에서 서버 /api/auth/band/login 으로 시작
 * - 서버가 Band 인증 → JWT 발급 → 딥링크(<scheme>://auth?token=...)로 복귀
 * - 토큰은 expo-secure-store에 보관, axios 기본 헤더에 주입
 */

import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { api, Member } from './api';

const TOKEN_KEY = 'yameyame_auth_token';
const GUEST_KEY = 'yameyame_guest_mode';

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function isGuestMode(): Promise<boolean> {
  return (await SecureStore.getItemAsync(GUEST_KEY)) === '1';
}

export async function continueAsGuest(): Promise<void> {
  await SecureStore.setItemAsync(GUEST_KEY, '1');
}

/** 앱 부팅 시 저장된 토큰을 axios 헤더에 복원 */
export async function restoreAuthHeader(): Promise<boolean> {
  const token = await getStoredToken();
  if (!token) return false;
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
  return true;
}

export async function signInWithBand(): Promise<{ ok: boolean; error?: string }> {
  const loginUrl = `${api.defaults.baseURL}/api/auth/band/login`;
  // 프로덕션 빌드: yameyame://auth / Expo Go: exp://<host>/--/auth
  const returnUrl = Linking.createURL('auth');

  const result = await WebBrowser.openAuthSessionAsync(loginUrl, returnUrl);
  if (result.type !== 'success' || !result.url) {
    return { ok: false, error: result.type === 'cancel' ? undefined : '로그인이 중단되었습니다' };
  }

  const { queryParams } = Linking.parse(result.url);
  const token = queryParams?.token;
  if (typeof token !== 'string' || !token) {
    const serverError = typeof queryParams?.error === 'string' ? queryParams.error : 'unknown';
    return { ok: false, error: `로그인에 실패했습니다 (${serverError})` };
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.deleteItemAsync(GUEST_KEY);
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(GUEST_KEY);
  delete api.defaults.headers.common.Authorization;
}

/** 토큰 유효성 확인 겸 내 정보 조회 */
export async function getCurrentMember(): Promise<Member | null> {
  try {
    const { data } = await api.get<Member>('/api/auth/me');
    return data;
  } catch {
    return null;
  }
}
