'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import type { CardState, Place } from '@/lib/types'

type Judged = Place & { state: CardState }

const PIN = {
  ok: { bg: '#2F8F4E', border: '#256F3D', icon: '✓' },
  cond: { bg: '#C98A12', border: '#9C6B0C', icon: '△' },
  loading: { bg: '#B3A78F', border: '#8E836E', icon: '…' },
  failed: { bg: '#C0392B', border: '#96271B', icon: '!' },
} as const

declare global {
  interface Window {
    kakao: any
  }
}

const KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY

interface Props {
  places: Judged[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function KakaoMap({ places, selectedId, onSelect }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const pinsRef = useRef(new Map<string, HTMLElement>())
  const selectRef = useRef(onSelect)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => setOrigin(window.location.origin), [])

  selectRef.current = onSelect

  const load = useCallback(() => window.kakao.maps.load(() => setReady(true)), [])

  // ── 지도 생성
  useEffect(() => {
    if (!ready || !boxRef.current || mapRef.current) return
    mapRef.current = new window.kakao.maps.Map(boxRef.current, {
      center: new window.kakao.maps.LatLng(37.5665, 126.978),
      level: 8,
    })
  }, [ready])

  // ── 핀 그리기 (지역·필터가 바뀔 때만)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const { kakao } = window

    pinsRef.current.forEach((el) => (el as any)._overlay.setMap(null))
    pinsRef.current.clear()

    const pts = places.filter((p) => p.mapx && p.mapy)
    if (pts.length === 0) return

    const bounds = new kakao.maps.LatLngBounds()

    pts.forEach((p) => {
      const pos = new kakao.maps.LatLng(p.mapy, p.mapx)
      bounds.extend(pos)

      const el = buildPin(p)
      el.onclick = () => selectRef.current(p.contentid)

      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        content: el,
        yAnchor: 1,
        clickable: true,
      })
      // 이름표가 펼쳐지는 동안은 이웃 핀 위로 올린다
      el.onmouseenter = () => overlay.setZIndex(el.classList.contains('on') ? 20 : 10)
      el.onmouseleave = () => overlay.setZIndex(el.classList.contains('on') ? 20 : 1)

      overlay.setMap(map)
      ;(el as any)._overlay = overlay
      pinsRef.current.set(p.contentid, el)
    })

    map.setBounds(bounds, 60, 60, 60, 360)
    if (pts.length === 1) map.setLevel(5)
  }, [places, ready])

  // ── 선택 상태 반영
  useEffect(() => {
    pinsRef.current.forEach((el, id) => {
      const on = id === selectedId
      el.classList.toggle('on', on)
      ;(el as any)._overlay.setZIndex(on ? 20 : 1)
    })
    const el = selectedId ? pinsRef.current.get(selectedId) : null
    if (el && mapRef.current) mapRef.current.panTo((el as any)._overlay.getPosition())
  }, [selectedId, places, ready])

  if (!KEY) {
    return (
      <div style={fallbackBox}>
        <b style={{ fontSize: 15 }}>카카오맵 키가 없어요</b>
        <span>
          <code>.env.local</code>에 <code>NEXT_PUBLIC_KAKAO_MAP_KEY</code>를 넣고 dev 서버를 다시
          띄워주세요.
        </span>
      </div>
    )
  }

  return (
    <>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false`}
        strategy="afterInteractive"
        onLoad={load}
        onError={() => setFailed(true)}
      />
      {/* zIndex 0 — 핀들의 z-index를 지도 안에 가둬 범례·상세 패널이 항상 위에 오게 한다 */}
      <div ref={boxRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {failed && (
        <div style={fallbackBox}>
          <b style={{ fontSize: 15 }}>지도를 불러오지 못했어요</b>
          <span>
            카카오 개발자센터 → 앱 설정 → 플랫폼 → Web의 사이트 도메인에
            <br />
            <code>{origin}</code> 이 등록돼 있는지 확인해주세요.
          </span>
        </div>
      )}
    </>
  )
}

function buildPin(p: Judged) {
  const s = PIN[p.state]

  const el = document.createElement('div')
  el.className = 'map-pin'

  const body = document.createElement('div')
  body.className = 'map-pin-body'
  body.style.background = s.bg
  body.style.borderColor = s.border

  const icon = document.createElement('span')
  icon.textContent = s.icon

  const label = document.createElement('span')
  label.className = 'map-pin-label'
  label.textContent = p.title

  const stem = document.createElement('div')
  stem.className = 'map-pin-stem'
  stem.style.background = s.border

  body.append(icon, label)
  el.append(body, stem)
  return el
}

const fallbackBox: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: '#EFEAE0',
  color: '#6E5F4D',
  fontSize: 13,
  lineHeight: 1.6,
  textAlign: 'center',
}
