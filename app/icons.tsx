/**
 * 상단 바의 작은 아이콘들 — 이모지 대신.
 * 이모지(📍 🔎)는 기기마다 모양이 다르고, 빨간 핀은 이 화면의 살구·주황 톤과 어울리지 않았다.
 */

/** 지역 — 주황 핀 안에 발자국. 핀이 상자를 꽉 채우고 발자국도 크게 — 작게 그리면 발자국이 안 보인다 */
export function PawPinIcon({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ flex: 'none', display: 'block' }}>
      <path d="M12 23.5c5.6-5.6 8.6-9.9 8.6-13.5A8.6 8.6 0 1 0 3.4 10c0 3.6 3 7.9 8.6 13.5Z" fill="#E85D3D" />
      <g fill="#FFFFFF">
        <ellipse cx="8.2" cy="8.4" rx="1.55" ry="1.85" />
        <ellipse cx="10.8" cy="6.6" rx="1.55" ry="1.85" />
        <ellipse cx="13.2" cy="6.6" rx="1.55" ry="1.85" />
        <ellipse cx="15.8" cy="8.4" rx="1.55" ry="1.85" />
        <path d="M12 9.8c2.9 0 4.9 1.6 4.9 3.6 0 1.5-1.2 2.1-2.5 1.7-.75-.25-1.5-.45-2.4-.45s-1.65.2-2.4.45c-1.3.4-2.5-.2-2.5-1.7 0-2 2-3.6 4.9-3.6Z" />
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
