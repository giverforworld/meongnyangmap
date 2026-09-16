'use client'

import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authReady } from '@/lib/supabaseBrowser'
import { GoogleIcon, KakaoIcon, ProviderMark } from './PetSwitch'

/**
 * 상단 메뉴의 로그인 버튼. 프로필 등록 버튼 오른쪽에 붙는다.
 *
 * 로그인은 선택이다 — 안 해도 전부 쓴다. 그래서 프로필 버튼(주황)보다 조용한
 * 테두리 버튼이고, 누르면 카카오·구글 둘만 있는 작은 메뉴가 열린다.
 * 로그인돼 있으면 누구로 들어왔는지와 로그아웃.
 *
 * 등록 화면(PetSwitch) 안의 AccountBlock 과 같은 일을 한다. 둘 다 두는 이유 —
 * 헤더 버튼은 "로그인이 있다"를 알리는 자리고, 등록 화면 것은 등록하다가
 * "다른 기기에서 했던 건데" 하는 사람을 위한 자리다.
 */
export default function AuthMenu({
  session, syncing, onSignIn, onSignOut, compact = false,
}: {
  session: Session | null
  syncing: boolean
  onSignIn: (provider: 'kakao' | 'google') => void
  onSignOut: () => void
  /** 좁은 화면 — 글자 없이 아이콘만 */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // 바깥을 누르거나 Esc 를 치면 닫는다
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // 환경변수가 없으면 로그인 기능 자체가 없다 — 버튼도 없다
  if (!authReady) return null

  const u = session?.user
  const m = u?.user_metadata ?? {}
  const who = (m.nickname as string) || (m.name as string) || (m.full_name as string) || u?.email || '로그인됨'
  const picture = (m.picture as string) || (m.avatar_url as string) || ''
  const p = u?.app_metadata?.provider as string | undefined

  return (
    <div ref={root} style={{ position: 'relative', flex: 'none' }}>
      <button
        className="hov-accent"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={u ? `${who} · 로그아웃` : '소셜 로그인 — 안 해도 전부 쓸 수 있어요'}
        // 옆의 프로필 칩과 같은 키(아바타 40 · 두 줄)로 맞춘다 — 둘이 높이가 다르면 나란히 서지 않는다
        style={{
          display: 'flex', alignItems: 'center', gap: compact ? 6 : 11, flex: 'none',
          fontFamily: 'inherit', fontSize: compact ? 13 : 16, fontWeight: 700, lineHeight: 1.15,
          // 좁은 화면 로그인 전은 글자 한 줄 — 높이는 옆 프로필 칩(아바타 28 + 여백 + 테두리)과 같은 37
          padding: compact ? (u ? '3px 3px' : '0 10px') : '6px 20px 6px 7px', minWidth: compact ? undefined : 150,
          height: compact && !u ? 37 : undefined,
          borderRadius: 99, border: `1.5px solid ${open ? '#E85D3D' : '#E3DCCE'}`,
          background: '#FFFFFF', color: '#2B2420', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {u ? (
          <>
            <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: compact ? 28 : 40, height: compact ? 28 : 40, borderRadius: '50%', background: '#EAF0F7', overflow: 'hidden', flex: 'none', color: '#6E7E99' }}>
              {picture
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={picture} alt="" width={40} height={40} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <PersonIcon size={compact ? 16 : 22} />}
            </span>
            {!compact && (
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{who}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 500, color: '#A08872', marginTop: 2 }}>
                  <ProviderMark provider={p} /> 계정 ▾
                </span>
              </span>
            )}
          </>
        ) : compact ? (
          // 좁은 화면 — 사람 아이콘만 두면 로그인 버튼인 줄 모른다. 글자로
          <span style={{ fontSize: 12 }}>로그인</span>
        ) : (
          <>
            <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: '#F6F1E7', flex: 'none', color: '#8A7A65' }}>
              <PersonIcon size={22} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span>소셜 로그인</span>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: '#A08872', marginTop: 2 }}>카카오 · 구글 ▾</span>
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 90, width: 250, background: '#FFFFFF', border: '1px solid #EAE3D6', borderRadius: 16, padding: 12, boxShadow: '0 12px 32px rgba(43,36,32,.16)', display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {u ? (
            <>
              <div style={{ fontSize: 13, color: '#6E5F4D', lineHeight: 1.5, padding: '2px 4px' }}>
                <b style={{ color: '#2B2420' }}>{who}</b> <ProviderMark provider={p} />
                <br />
                <span style={{ color: '#B3A78F' }}>
                  {syncing ? '계정과 맞추는 중…' : '우리 아이 정보는 로그인 계정에 저장됩니다.'}
                </span>
              </div>
              <button onClick={() => { setOpen(false); onSignOut() }}
                style={{ fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '10px 0', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onSignIn('kakao')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '11px 0', borderRadius: 12, border: 'none', background: '#FEE500', color: '#191919', cursor: 'pointer' }}>
                <KakaoIcon /> 카카오 로그인
              </button>
              <button onClick={() => onSignIn('google')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '11px 0', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#2B2420', cursor: 'pointer' }}>
                <GoogleIcon /> 구글 로그인
              </button>
              <span style={{ fontSize: 11, color: '#B3A78F', lineHeight: 1.5, padding: '0 4px' }}>
                로그인을 하지 않아도 서비스 이용이 가능합니다.
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** 사람 실루엣 — 로그인 전에는 이것만, 로그인 뒤에는 사진이 없을 때 */
function PersonIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', display: 'block' }}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c.8-3.6 3.9-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />
    </svg>
  )
}
