'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'

/**
 * 대메뉴. 멍냥맵은 "이 장소, 갈 수 있나?"에 답하고
 * 나머지는 "뭐 하고 놀지?"에 답한다 — 서로 반대 방향이라 나란히 둔다.
 */
const MENUS = [
  { href: '/', label: '멍냥맵', hint: '우리 아이 기준 동반 판정' },
  { href: '/hotplace', label: '핫플레이스', hint: '확실히 갈 수 있는 곳' },
  { href: '/festival', label: '페스티벌', hint: '반려동물 행사·팝업' },
  { href: '/community', label: '커뮤니티', hint: '다녀온 이야기' },
]

export default function Nav() {
  const path = usePathname()
  const isMobile = useIsMobile()
  const active = useRef<HTMLAnchorElement>(null)

  // 좁은 화면에서 메뉴가 넘칠 때, 지금 보고 있는 메뉴가 화면 밖에 있으면 안 된다
  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [path])

  return (
    <nav
      className="chip-row"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: isMobile ? 0 : 6,
        padding: isMobile ? '0 6px' : '0 24px',
        background: '#FFFFFF',
        borderBottom: '1px solid #EAE3D6',
        flex: 'none',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {/* 좁은 화면에서는 로고가 메뉴 하나를 밀어낸다. 발자국만 남긴다 */}
      <Link
        href="/"
        aria-label="멍냥맵 홈"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginRight: isMobile ? 4 : 22,
          marginLeft: isMobile ? 4 : 0,
          textDecoration: 'none',
          flex: 'none',
        }}
      >
        {!isMobile && (
          <span className="jua" style={{ fontSize: 28, color: '#E85D3D', lineHeight: 1 }}>
            멍냥맵
          </span>
        )}
        <span style={{ fontSize: isMobile ? 19 : 20 }}>🐾</span>
      </Link>

      {MENUS.map((m) => {
        const on = m.href === '/' ? path === '/' : path.startsWith(m.href)
        return (
          <Link
            key={m.href}
            href={m.href}
            title={m.hint}
            className="nav-tab"
            ref={on ? active : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 2,
              flex: 'none',
              padding: isMobile ? '12px 11px 10px' : '15px 16px 12px',
              fontSize: isMobile ? 14.5 : 16.5,
              fontWeight: on ? 700 : 500,
              color: on ? '#2B2420' : '#8A7A65',
              textDecoration: 'none',
              borderBottom: `3px solid ${on ? '#E85D3D' : 'transparent'}`,
            }}
          >
            {m.label}
            {/* 넓은 화면에서는 각 메뉴가 뭘 하는지 한 줄로 알려준다 */}
            {!isMobile && (
              <span style={{ fontSize: 11.5, fontWeight: 500, color: on ? '#A08872' : '#C4B8A4' }}>
                {m.hint}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
