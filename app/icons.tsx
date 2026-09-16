/**
 * 상단 바의 작은 아이콘들 — 이모지 대신.
 * 이모지(📍 🔎)는 기기마다 모양이 다르고, 빨간 핀은 이 화면의 살구·주황 톤과 어울리지 않았다.
 */

/** 지역 — 주황 핀 안에 발자국. 멍냥맵의 "여기" */
export function PawPinIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ flex: 'none', display: 'block' }}>
      <path d="M12 22.2c4.5-5 6.8-8.8 6.8-11.5a6.8 6.8 0 1 0-13.6 0c0 2.7 2.3 6.5 6.8 11.5Z" fill="#E85D3D" />
      <g fill="#FFFFFF">
        <ellipse cx="9.2" cy="8.9" rx="1.05" ry="1.25" />
        <ellipse cx="11.1" cy="7.7" rx="1.05" ry="1.25" />
        <ellipse cx="12.9" cy="7.7" rx="1.05" ry="1.25" />
        <ellipse cx="14.8" cy="8.9" rx="1.05" ry="1.25" />
        <path d="M12 9.9c2 0 3.4 1.1 3.4 2.5 0 1-.9 1.5-1.8 1.2-.55-.2-1-.3-1.6-.3s-1.05.1-1.6.3c-.9.3-1.8-.2-1.8-1.2 0-1.4 1.4-2.5 3.4-2.5Z" />
      </g>
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
