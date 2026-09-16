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
    const { data } = await sb.auth.getSession()
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}
  } catch {
    return {}
  }
}
