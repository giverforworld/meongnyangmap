'use client'

import { supabaseBrowser } from './supabaseBrowser'

/**
 * 구글 로그인 — Google Identity Services(GIS) 버튼 + Supabase signInWithIdToken.
 *
 * 왜 리디렉션(signInWithOAuth) 대신 이걸 쓰나: 리디렉션 방식은 구글 동의 화면에
 * "yxipzdcyqzeuieisylgx.supabase.co(으)로 이동"이라고 Supabase 주소가 뜬다 — 구글은 브랜드
 * 인증을 받지 않은 앱엔 앱 이름 대신 리디렉션 도메인을 보여준다. GIS 버튼은 팝업이 우리
 * 페이지(meongnyangmap.vercel.app)에서 열리므로 우리 도메인이 뜨고, 받은 ID 토큰을
 * Supabase 에 넘겨 세션을 만든다. 콘솔 설정은 supabase/google.md.
 *
 * 클라이언트 ID 는 공개값이다(모든 브라우저에 그대로 내려간다). 보안 비밀은 여기 없다 —
 * 그건 Supabase 대시보드에만 있다.
 */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
export const GIS_SRC = 'https://accounts.google.com/gsi/client'

declare global {
  interface Window {
    google?: any
  }
}

const hex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

/**
 * nonce 원문과 SHA-256 해시. 구글엔 **해시**를, Supabase 엔 **원문**을 준다 —
 * Supabase 가 원문을 해시해 토큰 안의 값과 맞춰 보고, 남이 가로챈 토큰을 못 쓰게 한다.
 */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = hex(crypto.getRandomValues(new Uint8Array(32)))
  const hashed = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))
  return { raw, hashed }
}

/** GIS 가 준 ID 토큰으로 Supabase 세션을 만든다. 실패하면 사람이 읽을 한 줄을 돌려준다 */
export async function finishGoogleSignIn(credential: string, nonce: string): Promise<string | null> {
  const sb = supabaseBrowser()
  if (!sb) return '로그인 기능이 꺼져 있어요'
  const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token: credential, nonce })
  return error ? `구글 로그인에 실패했어요 — ${error.message}` : null
}
