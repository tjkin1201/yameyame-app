/**
 * 전역 상태: 인증 세션 + 내 클럽/멤버.
 * MVP는 1인 1클럽 가정 — 첫 멤버십을 활성 클럽으로 사용한다.
 */
import type { Session as AuthSession } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import type { Club, Member } from './types';

interface ClubState {
  authSession: AuthSession | null;
  authLoading: boolean;
  club: Club | null;
  me: Member | null;
  clubLoading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<ClubState | null>(null);

export function ClubProvider({ children }: { children: React.ReactNode }) {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [club, setClub] = useState<Club | null>(null);
  const [me, setMe] = useState<Member | null>(null);
  const [clubLoading, setClubLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // user.id만 의존 — TOKEN_REFRESHED 등으로 세션 객체가 갱신돼도 불필요한 재조회 방지
  const userId = authSession?.user.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setClub(null);
      setMe(null);
      setClubLoading(false);
      return;
    }
    setClubLoading(true);
    try {
      const { data: member, error } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!member) {
        setClub(null);
        setMe(null);
        return;
      }
      setMe(member as Member);
      const { data: clubRow, error: clubErr } = await supabase
        .from('clubs')
        .select('*')
        .eq('id', (member as Member).club_id)
        .single();
      if (clubErr) throw clubErr;
      setClub(clubRow as Club);
    } finally {
      setClubLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setClub(null);
    setMe(null);
  }, []);

  const value = useMemo(
    () => ({ authSession, authLoading, club, me, clubLoading, refresh, signOut }),
    [authSession, authLoading, club, me, clubLoading, refresh, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClub(): ClubState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useClub은 ClubProvider 안에서만 사용');
  return v;
}
