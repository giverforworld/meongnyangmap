'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * 브라우저용 Supabase 클라이언트 — 로그인과 프로필 동기화에만 쓴다.
 *
 * anon 키를 쓴다. 이 키는 브라우저로 나가도 되는 키다 — 할 수 있는 일이 RLS 정책
 * 안으로 묶여 있어, 로그인한 본인의 pets 행만 읽고 쓸 수 있다.
 * service_role 키(lib/supabase.ts)와 절대 헷갈리지 말 것. 그쪽은 서버 전용이다.
 *
 * 세션은 localStorage 에 남는다. 서버 렌더가 로그인 상태를 알아야 하는 화면이 없어
 * 쿠키 기반(@supabase/ssr)은 쓰지 않는다 — 미들웨어와 쿠키 동기화가 통째로 빠진다.
 *
 * 환경변수가 없으면 null 이다. 로그인은 선택 기능이라 없어도 서비스는 그대로 돈다.
 */
let client: SupabaseClient | null | undefined

export function supabaseBrowser(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  client = url && key ? createClient(url, key) : null
  return client
}

/** 로그인 기능이 켜져 있는지 — 버튼을 그릴지 말지 정한다 */
export const authReady = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
