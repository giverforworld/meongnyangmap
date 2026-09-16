'use client'

import { supabaseBrowser } from './supabaseBrowser'

/**
 * 서버 라우트에 "나 로그인했어"를 증명하는 헤더. 세션이 없으면 빈 객체 —
 * 로그인은 선택이라 없어도 요청은 그대로 간다. 확인은 서버(lib/auth.ts)가 한다.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const sb = supabaseBrowser()
  if (!sb) return {}
  try {
    // getSession 은 토큰이 만료됐으면 갱신부터 한다. 갱신이 안 되면(다른 기기에서 로그인해
    // 갱신 토큰이 돌았거나 오래 자리를 비웠거나) 세션이 null 로 온다 — 그땐 화면도
    // 로그아웃으로 맞춘다. 로그인된 것처럼 보이는데 서버는 모르는 상태를 두지 않는다
    const { data, error } = await sb.auth.getSession()
    if (!data.session) {
      if (error) await sb.auth.signOut({ scope: 'local' }).catch(() => {})
      return {}
    }
    return { Authorization: `Bearer ${data.session.access_token}` }
  } catch {
    return {}
  }
}
