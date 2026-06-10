/**
 * Band Open API 클라이언트
 * 스펙: https://developers.band.us/develop/guide/api
 * - 토큰 교환은 Basic 인증(client_id:client_secret base64) 필수
 * - client_secret은 서버에서만 사용한다 (모바일 노출 금지)
 */

const BAND_AUTH_BASE = 'https://auth.band.us';
const BAND_API_BASE = 'https://openapi.band.us';

export interface BandTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user_key: string;
}

export interface BandProfile {
  user_key: string;
  name: string;
  profile_image_url?: string;
  is_app_member?: boolean;
  message_allowed?: boolean;
}

export function isBandConfigured(): boolean {
  return Boolean(process.env.BAND_CLIENT_ID && process.env.BAND_CLIENT_SECRET);
}

export function getAuthorizeUrl(redirectUri: string): string {
  const clientId = process.env.BAND_CLIENT_ID;
  if (!clientId) throw new Error('BAND_CLIENT_ID not configured');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  return `${BAND_AUTH_BASE}/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<BandTokenResponse> {
  const clientId = process.env.BAND_CLIENT_ID;
  const clientSecret = process.env.BAND_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Band OAuth not configured');

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const url = `${BAND_AUTH_BASE}/oauth2/token?grant_type=authorization_code&code=${encodeURIComponent(code)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${basic}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Band token exchange failed (${response.status}): ${body}`);
  }
  return (await response.json()) as BandTokenResponse;
}

export async function getProfile(accessToken: string): Promise<BandProfile> {
  const url = `${BAND_API_BASE}/v2/profile?access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Band profile fetch failed (${response.status})`);
  }

  const json = (await response.json()) as { result_code: number; result_data: BandProfile };
  if (json.result_code !== 1) {
    throw new Error(`Band profile error: result_code=${json.result_code}`);
  }
  return json.result_data;
}
