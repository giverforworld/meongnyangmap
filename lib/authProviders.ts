/**
 * 어떤 소셜 로그인이 실제로 열려 있는지.
 *
 * 구글은 콘솔(OAuth 클라이언트)·Supabase(provider) 설정이 끝나기 전까지 닫아 두었다 —
 * 열어 두면 눌렀을 때 구글 쪽 오류 화면으로 튕긴다. 2026-09-16 설정 완료로 열었다
 * (순서는 supabase/google.md). 구글 쪽을 다시 닫아야 하면 false 로.
 */
export const GOOGLE_LOGIN_READY = true

export const GOOGLE_PENDING = '구글 로그인은 아직 준비 중이에요. 지금은 카카오로 로그인해주세요.'
