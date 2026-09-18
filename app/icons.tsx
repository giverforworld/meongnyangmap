/**
 * 상단 바의 작은 아이콘들 — 이모지 대신.
 * 이모지(📍 🔎)는 기기마다 모양이 다르고, 빨간 핀은 이 화면의 살구·주황 톤과 어울리지 않았다.
 */

/**
 * 지역 — 통통한 코랄 핀 안에 흰 발자국.
 *
 * 날카롭게 보이던 건 뾰족한 꼬리 끝과 작은 머리였다. 머리(r10.5)와 꼬리 끝(r2.2) 두 원을
 * 접선으로 잇고, 끝을 둥글게 남겨 물방울처럼 만든다. 위는 밝고 아래는 브랜드 주황인
 * 그라데이션에 작은 광택을 얹어 스티커 느낌을 낸다. 발가락은 동그라미, 패드는 하트.
 */
export function PawPinIcon({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 27" width={size} height={size * 27 / 24} aria-hidden="true" style={{ flex: 'none', display: 'block' }}>
      <defs>
        <linearGradient id="pawpin-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FA8B6D" />
          <stop offset="1" stopColor="#E85D3D" />
        </linearGradient>
      </defs>
      <path d="M4.2 18.63A10.5 10.5 0 1 1 19.8 18.63L13.63 25.47A2.2 2.2 0 0 1 10.37 25.47Z" fill="url(#pawpin-g)" />
      {/* 광택 */}
      <ellipse cx="7.4" cy="5.4" rx="2.3" ry="1.3" transform="rotate(-38 7.4 5.4)" fill="#FFFFFF" opacity=".42" />
      <g fill="#FFFFFF">
        <circle cx="6.02" cy="9.75" r="2.06" />
        <circle cx="9.75" cy="6.32" r="2.17" />
        <circle cx="14.25" cy="6.32" r="2.17" />
        <circle cx="17.98" cy="9.75" r="2.06" />
        {/* 하트 모양 패드 */}
        <g transform="translate(12 12.1) scale(0.921)">
          <path d="M0 6.1c-.4 0-.9-.1-1.3-.3C-3.7 4.9-5.5 3.5-5.5 1.4-5.5-.1-4.3-1.3-2.8-1.3-1.6-1.3-.6-.7 0 .2.6-.7 1.6-1.3 2.8-1.3 4.3-1.3 5.5-.1 5.5 1.4c0 2.1-1.8 3.5-4.2 4.4-.4.2-.9.3-1.3.3Z" />
        </g>
      </g>
    </svg>
  )
}

/**
 * 장소 핀 — 대메뉴 '멍냥맵'과 같은 선 핀. 글에 붙은 장소, 장소 고르기, 사진 없는 자리 등
 * '장소'를 뜻하는 곳은 전부 이걸 쓴다. currentColor 라 글자색을 따라간다.
 */
export function PlacePinIcon({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', display: 'inline-block', verticalAlign: '-2px', ...style }}>
      <path d="M12 21.2c4.1-4.8 6.2-8.5 6.2-11.2a6.2 6.2 0 1 0-12.4 0c0 2.7 2.1 6.4 6.2 11.2Z" />
      <circle cx="12" cy="9.9" r="2.4" />
    </svg>
  )
}

/** 검색 — 둥근 돋보기, 글자색과 같은 갈색 */
export function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="#8A7A65"
      strokeWidth="2.2" strokeLinecap="round" style={{ flex: 'none', display: 'block' }}>
      <circle cx="10.5" cy="10.5" r="6.2" />
      <path d="M15.3 15.3 20 20" />
    </svg>
  )
}

/** 전화 — 글자색을 따르는 수화기. '☎' 글자는 기기에 따라 팩스 이모지로 그려져 쓰지 않는다 */
export function PhoneIcon({ size = 14, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', display: 'inline-block', verticalAlign: '-2px', ...style }}>
      <path d="M5.5 3.5h3.2l1.6 4-2 1.3a11.5 11.5 0 0 0 6.9 6.9l1.3-2 4 1.6v3.2a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3.5 5.6a2 2 0 0 1 2-2.1Z" />
    </svg>
  )
}
