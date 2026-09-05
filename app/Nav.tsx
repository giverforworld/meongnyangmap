'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'

/**
 * 대메뉴. 멍냥맵은 "이 장소, 갈 수 있나?"에 답하고
 * 나머지는 "뭐 하고 놀지?"에 답한다 — 서로 반대 방향이라 나란히 둔다.
 *
 * hint 는 화면에서 지우고 툴팁으로만 남긴다. 넉 줄을 지운 자리는 아이콘이 대신한다 —
 * 아이콘이 대신하는 건 정보가 아니라 분위기다.
 * 지금 보고 있는 메뉴는 주황 알약으로 통째로 칠한다.
 */
const MENUS = [
  { href: '/', label: '멍냥맵', hint: '우리 아이 기준 동반 판정', Icon: PinIcon },
  { href: '/hotplace', label: '핫플레이스', hint: '확실히 갈 수 있는 곳', Icon: SparkleIcon },
  { href: '/festival', label: '페스티벌', hint: '반려동물 행사·팝업', Icon: TentIcon },
  { href: '/community', label: '커뮤니티', hint: '다녀온 이야기', Icon: BubblePawIcon },
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
          <span className="jua" style={{ fontSize: 31, color: '#E85D3D', lineHeight: 1 }}>
            멍냥맵
          </span>
        )}
        <span style={{ fontSize: isMobile ? 20 : 22 }}>🐾</span>
      </Link>

      {MENUS.map((m) => {
        const on = m.href === '/' ? path === '/' : path.startsWith(m.href)
        return (
          <Link
            key={m.href}
            href={m.href}
            title={m.hint}
            className={on ? 'nav-tab on' : 'nav-tab'}
            ref={on ? active : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              flex: 'none',
              margin: isMobile ? '7px 0' : '8px 0',
              padding: isMobile ? '10px 11px' : '10px 17px',
              borderRadius: 99,
              fontSize: isMobile ? 15.5 : 18,
              fontWeight: on ? 700 : 500,
              background: on ? '#E85D3D' : 'transparent',
              color: on ? '#FFFFFF' : '#8A7A65',
              textDecoration: 'none',
            }}
          >
            {/* 좁은 화면에서는 아이콘까지 넣으면 메뉴 넉 줄이 가로로 넘친다 — 라벨만 둔다 */}
            {!isMobile && <m.Icon />}
            {m.label}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * 아이콘은 이모지가 아니라 SVG 다.
 * 이모지는 색이 고정이라 활성·비활성 상태를 따라오지 못한다.
 * currentColor 를 쓰면 탭 글자색을 그대로 따라가고, 활성일 때만 오렌지로 켜진다.
 */
const ico: React.CSSProperties = { width: 21, height: 21, flex: 'none', display: 'block' }

/** 멍냥맵 — 이 탭이 하는 일은 "이 장소, 갈 수 있나?" 판정이다 */
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" style={ico} aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21.2c4.1-4.8 6.2-8.5 6.2-11.2a6.2 6.2 0 1 0-12.4 0c0 2.7 2.1 6.4 6.2 11.2Z" />
      <circle cx="12" cy="9.9" r="2.4" />
    </svg>
  )
}

/** 핫플레이스 — "골라 뒀다"는 뜻만. 방문자수·평점 같은 없는 데이터를 암시하지 않는다 */
function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" style={ico} aria-hidden="true" fill="currentColor">
      <path d="M9.8 2c.75 4.9 2.3 6.45 7.2 7.2-4.9.75-6.45 2.3-7.2 7.2-.75-4.9-2.3-6.45-7.2-7.2 4.9-.75 6.45-2.3 7.2-7.2Z" />
      <path d="M17.9 13.4c.36 2.35 1.15 3.15 3.5 3.5-2.35.36-3.14 1.15-3.5 3.5-.36-2.35-1.15-3.14-3.5-3.5 2.35-.35 3.14-1.15 3.5-3.5Z" />
    </svg>
  )
}

/** 페스티벌 — page.tsx 의 CAT_EMOJI 행사=🎪 와 같은 어휘 */
function TentIcon() {
  return (
    <svg viewBox="0 0 24 24" style={ico} aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 7.2 3.6 19.8h16.8L12 7.2Z" />
      <path d="M12 7.2v12.6M8.3 19.8c0-3 1.5-6 3.7-8.4M15.7 19.8c0-3-1.5-6-3.7-8.4" />
      <path d="M12 7.2V3.6h3.3l-1.1 1.3 1.1 1.3H12" />
    </svg>
  )
}

/** 커뮤니티 — "다녀온 이야기" = 발자국 이야기. 발가락 셋은 슬픈 얼굴로 읽혀 넷으로 둔다 */
function BubblePawIcon() {
  return (
    <svg viewBox="0 0 24 24" style={ico} aria-hidden="true">
      <path d="M21 11.9c0 4.1-4 7.4-8.9 7.4-1 0-2-.14-2.9-.4L3.6 20.6l1.5-3.6C3.8 15.6 3.1 13.8 3.1 11.9c0-4.1 4-7.4 8.9-7.4S21 7.8 21 11.9Z"
        fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <g fill="currentColor">
        <ellipse cx="9.1" cy="10.6" rx=".78" ry=".95" />
        <ellipse cx="11.2" cy="9.9" rx=".82" ry="1" />
        <ellipse cx="13.4" cy="9.9" rx=".82" ry="1" />
        <ellipse cx="15.5" cy="10.6" rx=".78" ry=".95" />
        <path d="M12.3 11.8c1.65 0 3 .82 3 1.95 0 .9-.9 1.25-1.68 1-.5-.16-.87-.24-1.32-.24s-.82.08-1.32.24c-.78.25-1.68-.1-1.68-1 0-1.13 1.35-1.95 3-1.95Z" />
      </g>
    </svg>
  )
}
