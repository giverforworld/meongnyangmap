'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { GIS_SRC, GOOGLE_CLIENT_ID, finishGoogleSignIn, makeNonce } from '@/lib/googleSignIn'
import { GoogleIcon } from './PetSwitch'

/**
 * 구글의 "Google 계정으로 로그인" 버튼(GIS). 누르면 팝업에서 계정을 고르고,
 * 돌아온 ID 토큰으로 Supabase 세션을 만든다 — 페이지를 떠나지 않는다.
 *
 * 클라이언트 ID 가 없거나 GIS 스크립트를 못 받으면 예전 리디렉션 방식(onFallback)으로
 * 가는 우리 버튼을 그린다 — 환경변수가 빠진 배포에서도 로그인은 되게.
 *
 * 폭은 부모를 재서 GIS 허용 범위(200~400px)에 맞춘다. GIS 버튼은 iframe 이라 CSS 로 못 늘린다.
 */
export default function GoogleButton({
  onDone, onError, onFallback,
}: {
  onDone?: () => void
  onError?: (message: string) => void
  onFallback: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && Boolean(window.google?.accounts?.id))
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const latest = useRef({ onDone, onError })
  latest.current = { onDone, onError }

  useEffect(() => {
    const el = box.current
    if (!ready || !el || !GOOGLE_CLIENT_ID) return
    let cancelled = false
    ;(async () => {
      const { raw, hashed } = await makeNonce()
      if (cancelled || !window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        nonce: hashed,
        ux_mode: 'popup',
        itp_support: true,
        callback: async (resp: { credential?: string }) => {
          if (!resp.credential) return
          setBusy(true)
          const err = await finishGoogleSignIn(resp.credential, raw)
          setBusy(false)
          if (err) latest.current.onError?.(err)
          else latest.current.onDone?.()
        },
      })
      el.innerHTML = ''
      const width = Math.max(200, Math.min(400, Math.floor(el.parentElement?.clientWidth || 300)))
      window.google.accounts.id.renderButton(el, {
        type: 'standard', theme: 'outline', size: 'large', text: 'signin_with',
        shape: 'pill', logo_alignment: 'center', locale: 'ko', width,
      })
    })()
    return () => { cancelled = true }
  }, [ready])

  if (!GOOGLE_CLIENT_ID || failed) {
    return (
      <button onClick={onFallback}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '11px 0', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#2B2420', cursor: 'pointer' }}>
        <GoogleIcon /> 구글 로그인
      </button>
    )
  }

  return (
    <>
      {/* onReady — 마운트마다 불린다. 팝오버·모달이 열릴 때마다 버튼을 다시 그려야 한다 */}
      <Script src={GIS_SRC} strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setFailed(true)} />
      <div style={{ position: 'relative', width: '100%', minHeight: 40, display: 'flex', justifyContent: 'center' }}>
        <div ref={box} style={{ opacity: busy ? .5 : 1 }} />
        {!ready && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, color: '#B3A78F' }}>구글 로그인 불러오는 중…</span>}
      </div>
    </>
  )
}
