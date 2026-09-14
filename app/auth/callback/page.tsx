'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

/**
 * 카카오·구글이 로그인을 마치고 돌려보내는 자리.
 *
 * 주소에 ?code= 가 실려 온다. **교환은 supabase-js 가 한다** — 클라이언트가 만들어질 때
 * 주소의 code 를 알아서 세션으로 바꾸고, 주소에서 code 를 지운다(replaceState).
 * 예전엔 여기서 exchangeCodeForSession 을 한 번 더 불렀는데, 둘이 경쟁하다가
 * Next 가 지워진 주소를 감지해 effect 를 다시 돌리면 "code 가 없다"는 오류가 떴다 —
 * 로그인은 이미 됐는데도. 그래서 여기는 세션이 생길 때까지 기다리기만 한다.
 *
 * 성공하면 로그인 누르기 전에 보던 화면으로 되돌린다. 이 화면에 사람이 머물 이유는 없다.
 */
export default function AuthCallback() {
  // useSearchParams 는 정적 빌드 때 Suspense 경계가 있어야 한다
  return (
    <Suspense fallback={<Shell />}>
      <Exchange />
    </Suspense>
  )
}

function Exchange() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  // 처음 들어온 주소의 값만 쓴다. supabase-js 가 주소를 고쳐도 다시 읽지 않는다
  const first = useRef({
    next: params.get('next') ?? '/',
    code: params.get('code'),
    errorDescription: params.get('error_description'),
  })

  useEffect(() => {
    const { next: raw, code, errorDescription } = first.current
    // 돌아갈 곳은 우리 사이트 안이어야 한다. 밖으로 보내는 값은 무시한다
    const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'

    if (errorDescription) return setError(errorDescription)
    const sb = supabaseBrowser()
    if (!sb) return setError('로그인 기능이 꺼져 있어요')
    if (!code) return setError('로그인 정보를 받지 못했어요')

    let alive = true
    // getSession 은 클라이언트 초기화(= 주소의 code 교환)가 끝나기를 기다렸다가 답한다
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return
      if (data.session) router.replace(next)
      else setError('로그인 정보를 받지 못했어요')
    })
    return () => { alive = false }
  }, [router])

  return <Shell error={error} />
}

function Shell({ error }: { error?: string | null }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#FAF6EF' }}>
      <div style={{ textAlign: 'center', fontSize: 14, color: '#6E5F4D', lineHeight: 1.7 }}>
        {error ? (
          <>
            <b style={{ color: '#C0392B' }}>로그인이 안 됐어요</b>
            <br />{error}
            <br />
            <a href="/" style={{ color: '#E85D3D', fontWeight: 700 }}>홈으로</a>
          </>
        ) : (
          '로그인 중…'
        )}
      </div>
    </div>
  )
}
