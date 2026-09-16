/**
 * 상단 바의 작은 아이콘들 — 이모지 대신.
 * 이모지(📍 🔎)는 기기마다 모양이 다르고, 빨간 핀은 이 화면의 살구·주황 톤과 어울리지 않았다.
 */

/**
 * 지역 — 발자국 자체가 핀이다. 발가락 넷에 패드 끝이 아래로 뾰족해 '여기'를 가리킨다.
 * 핀 안에 발자국을 넣던 것은 26px 에서 발자국이 안 읽혔다. 발자국이 곧 아이콘이어야 한눈에 보인다.
 */
export function PawPinIcon({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ flex: 'none', display: 'block' }}>
      <g fill="#E85D3D">
        {/* 가운데 둘은 서로 떨어져 있어야 발가락으로 읽힌다 — 붙으면 한 덩어리가 된다 */}
        <ellipse cx="4.6" cy="9.6" rx="2.3" ry="2.9" transform="rotate(-20 4.6 9.6)" />
        <ellipse cx="9.2" cy="5.3" rx="2.3" ry="3" />
        <ellipse cx="14.8" cy="5.3" rx="2.3" ry="3" />
        <ellipse cx="19.4" cy="9.6" rx="2.3" ry="2.9" transform="rotate(20 19.4 9.6)" />
        <path d="M12 22.6C9.2 20.2 5.4 18.9 5.4 15.6c0-2.9 2.9-5 6.6-5s6.6 2.1 6.6 5c0 3.3-3.8 4.6-6.6 7Z" />
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
