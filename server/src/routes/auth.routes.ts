import { Request, Response, Router } from 'express';
import Member, { IMember } from '../models/Member.model';
import * as bandService from '../services/band.service';
import { requireAuth, signAuthToken } from '../middleware/auth.middleware';

const router = Router();

/**
 * 콜백 후 앱으로 복귀할 딥링크 주소.
 * - 프로덕션 빌드: yameyame://auth (app.json scheme)
 * - Expo Go 개발: APP_REDIRECT_URL=exp://<LAN IP>:8081/--/auth 로 덮어쓰기
 */
function getAppRedirectUrl(): string {
  return process.env.APP_REDIRECT_URL || `${process.env.APP_SCHEME || 'yameyame'}://auth`;
}

function getCallbackUrl(req: Request): string {
  const base = process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/api/auth/band/callback`;
}

// 로그인 시작 — Band 인증 페이지로 redirect
router.get('/band/login', (req: Request, res: Response) => {
  if (!bandService.isBandConfigured()) {
    return res.status(503).json({
      error: 'Band OAuth not configured',
      hint: 'Set BAND_CLIENT_ID and BAND_CLIENT_SECRET (see server/.env.example)',
    });
  }
  return res.redirect(bandService.getAuthorizeUrl(getCallbackUrl(req)));
});

// Band 콜백 — code → access token → 프로필 → Member 연결 → JWT 딥링크 복귀
router.get('/band/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  const appRedirect = getAppRedirectUrl();

  if (typeof code !== 'string' || !code) {
    return res.redirect(`${appRedirect}?error=missing_code`);
  }

  try {
    const token = await bandService.exchangeCodeForToken(code);
    const profile = await bandService.getProfile(token.access_token);
    const member = await findOrCreateMemberByBandProfile(profile);

    const authToken = signAuthToken({
      memberId: String(member._id),
      bandUserKey: profile.user_key,
    });
    return res.redirect(`${appRedirect}?token=${encodeURIComponent(authToken)}`);
  } catch (error) {
    console.error('Band OAuth callback failed:', error);
    return res.redirect(`${appRedirect}?error=oauth_failed`);
  }
});

// 현재 로그인한 회원 조회 (모바일 부팅 시 토큰 유효성 확인용)
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const member = await Member.findById(req.auth!.memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    return res.json(member);
  } catch (error) {
    return res
      .status(500)
      .json({ error: 'Failed to fetch member', details: (error as Error).message });
  }
});

/**
 * Band 프로필로 기존 Member를 찾거나 새로 만든다.
 * 정책: bandId(=user_key) 일치 회원이 없으면 항상 신규 생성.
 * 기존 수동 등록 회원과의 연결은 운영진이 별도로 처리한다.
 */
async function findOrCreateMemberByBandProfile(
  profile: bandService.BandProfile
): Promise<IMember> {
  const existing = await Member.findOne({ bandId: profile.user_key });
  if (existing) return existing;

  return Member.create({
    bandId: profile.user_key,
    name: profile.name,
    profileImage: profile.profile_image_url,
  });
}

export default router;
