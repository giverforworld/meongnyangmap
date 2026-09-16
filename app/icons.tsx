/**
 * 상단 바의 작은 아이콘들 — 이모지 대신.
 * 이모지(📍 🔎)는 기기마다 모양이 다르고, 빨간 핀은 이 화면의 살구·주황 톤과 어울리지 않았다.
 */

/** 지역 — 주황 핀 안에 발자국. 멍냥맵의 "여기". 핀은 둥글게, 발자국은 핀을 꽉 채우게 */
export function PawPinIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ flex: 'none', display: 'block' }}>
      <path d="M12 22.5c4.8-4.6 7.3-8.2 7.3-11.3A7.3 7.3 0 1 0 4.7 11.2c0 3.1 2.5 6.7 7.3 11.3Z" fill="#E85D3D" />
      <g fill="#FFFFFF">
        <ellipse cx="8.9" cy="9.6" rx="1.25" ry="1.5" />
        <ellipse cx="11" cy="8.1" rx="1.25" ry="1.5" />
        <ellipse cx="13" cy="8.1" rx="1.25" ry="1.5" />
        <ellipse cx="15.1" cy="9.6" rx="1.25" ry="1.5" />
        <path d="M12 10.6c2.3 0 3.9 1.3 3.9 2.9 0 1.2-1 1.7-2 1.4-.6-.2-1.2-.35-1.9-.35s-1.3.15-1.9.35c-1 .3-2-.2-2-1.4 0-1.6 1.6-2.9 3.9-2.9Z" />
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
