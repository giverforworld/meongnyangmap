'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

/**
 * 카카오·구글이 로그인을 마치고 돌려보내는 자리.
 *
 * 주소에 ?code= 가 실려 온다. 그걸 세션으로 바꾸고, 로그인 누르기 전에 보던
 * 화면으로 되돌린다. 실패하면 사유를 적고 홈으로 보낸다 — 이 화면에 사람이
 * 머물 이유는 없다.
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

  useEffect(() => {
    const sb = supabaseBrowser()
    const code = params.get('code')
    // 돌아갈 곳은 우리 사이트 안이어야 한다. 밖으로 보내는 값은 무시한다
    const raw = params.get('next') ?? '/'
    const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'

    if (!sb || !code) {
      setError(params.get('error_description') ?? '로그인 정보를 받지 못했어요')
      return
    }
    sb.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setError(error.message)
      else router.replace(next)
    })
  }, [params, router])

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
