'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import type { CardState, Place } from '@/lib/types'

type Judged = Place & { state: CardState }

const PIN = {
  ok: { bg: '#2F8F4E', border: '#256F3D', icon: '○' },
  cond: { bg: '#C98A12', border: '#9C6B0C', icon: '✓' },
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
  /**
   * 지도 아래쪽이 목록 시트에 가려지는 비율(0~1).
   * 핀을 이 위로 몰아 두지 않으면 시트를 내려야만 보이는 핀이 생긴다.
   */
  bottomInset?: number
  /**
   * 좁은 화면인지. 지도가 차지하는 폭으로 짐작하면 안 된다 —
   * 넓은 화면에서도 왼쪽 목록(312px)을 빼고 나면 지도만은 좁아지기 때문이다.
   */
  narrow?: boolean
}

export default function KakaoMap({ places, selectedId, onSelect, bottomInset = 0, narrow = false }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const pinsRef = useRef(new Map<string, HTMLElement>())
  /** 마지막으로 맞춘 범위. 지도 크기가 바뀌면 이걸로 다시 맞춘다 */
  const boundsRef = useRef<any>(null)
  /** 최신 bottomInset·narrow — ResizeObserver 콜백이 낡은 값을 보지 않게 */
  const insetRef = useRef(bottomInset)
  const narrowRef = useRef(narrow)
  narrowRef.current = narrow
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

    boundsRef.current = bounds
    refit(map, bounds, pts.length, boxRef.current, insetRef.current, narrowRef.current)
  }, [places, ready])

  /**
   * 지도 크기가 바뀌면 다시 그린다.
   *
   * 좁은 화면에서는 목록/지도를 탭으로 오가는데, 지도가 숨겨진 채(크기 0) 만들어지면
   * 타일이 아예 안 그려진다. 카카오맵은 컨테이너 크기를 생성 시점에 재기 때문이다.
   * relayout() 으로 다시 재게 하고, 크기가 달라졌으니 범위도 다시 맞춘다.
   */
  useEffect(() => {
    const box = boxRef.current
    if (!box || !ready) return

    let w = 0
    let h = 0
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      if (width === w && height === h) return
      w = width
      h = height
      const map = mapRef.current
      if (!map || width === 0 || height === 0) return
      map.relayout()
      if (boundsRef.current) refit(map, boundsRef.current, pinsRef.current.size, box, insetRef.current, narrowRef.current)
    })
    ro.observe(box)
    return () => ro.disconnect()
  }, [ready])

  /**
   * 목록 시트를 올리고 내리면 지도에서 실제로 보이는 높이가 달라진다.
   * 보고 있던 핀이 시트 뒤로 숨지 않게 범위를 다시 맞춘다.
   * 다만 특정 장소를 골라 둔 동안에는 화면이 튀므로 건드리지 않는다.
   */
  useEffect(() => {
    insetRef.current = bottomInset
    const map = mapRef.current
    if (!map || !boundsRef.current || selectedId) return
    refit(map, boundsRef.current, pinsRef.current.size, boxRef.current, bottomInset, narrow)
    // selectedId 는 '고른 게 있으면 건너뛴다' 판단에만 쓴다 — 선택이 바뀔 때마다 맞추면 안 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomInset])

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

/** 컨테이너에서 현재 크기를 읽어 fit 에 넘긴다. 크기가 0이면 맞출 게 없다 */
function refit(map: any, bounds: any, count: number, box: HTMLElement | null, inset: number, narrow: boolean) {
  const h = box?.clientHeight ?? 0
  if ((box?.clientWidth ?? 0) === 0 || h === 0) return
  fit(map, bounds, count, h, inset, narrow)
}

/**
 * 범위에 맞춰 지도를 움직인다.
 *
 * 위아래 여백은 지도 위에 떠 있는 것들(프로필 버튼·목록 시트)에 핀이 가리지 않을 만큼만 준다.
 * 좌우는 같게 준다 — 한쪽만 넓히면 지도가 늘 그쪽으로 쏠려 보인다.
 */
function fit(map: any, bounds: any, count: number, height: number, inset: number, narrow: boolean) {
  // 좁은 화면의 아래쪽은 목록 시트가 덮는다. 그 높이만큼 핀을 위로 올린다
  const bottom = narrow ? Math.round(height * Math.min(inset, 0.55)) + 14 : 60
  // 좌우는 같게 준다. 예전에는 왼쪽에만 360을 줬는데(상세 패널 자리),
  // 패널이 닫혀 있을 때도 그 값이 걸려 지도가 늘 한쪽으로 쏠려 보였다.
  // 패널을 열면 고른 핀으로 panTo 가 따라가므로 여기서 자리를 비워 둘 이유가 없다
  map.setBounds(
    bounds,
    narrow ? 52 : 60, // 위 — 반려동물 프로필 버튼
    narrow ? 20 : 60, // 오른쪽
    bottom,
    narrow ? 20 : 60
  )
  // 핀이 한 곳뿐이면 범위가 점이라 지도가 끝까지 당겨진다. 주변이 보이게 물러난다
  if (count === 1) {
    map.setLevel(5)
    return
  }

  /*
   * 지도 단계는 한 칸이 두 배씩 벌어진다. setBounds 는 다 들어가는 쪽으로 물러나므로
   * 서울만 보려는데 경기도까지 나오는 일이 잦다. 한 칸 당겨 보되,
   * 그 결과가 빡빡하면 되돌린다 — 예전에는 되돌리지 않아 가장자리 핀이 화면 밖으로 밀려났다.
   */
  const level = map.getLevel()
  if (level <= 1) return
  map.setLevel(level - 1)
  const view = map.getBounds()
  if (!view) return
  const span = (b: any) => {
    const sw = b.getSouthWest()
    const ne = b.getNorthEast()
    return [Math.abs(ne.getLat() - sw.getLat()), Math.abs(ne.getLng() - sw.getLng())]
  }
  const [vLat, vLng] = span(view)
  const [tLat, tLng] = span(bounds)
  // 핀 범위가 보이는 범위의 86%를 넘으면 가장자리에 붙는다. 그럴 바에는 물러난 채로 둔다
  if (vLat <= 0 || vLng <= 0 || tLat / vLat > 0.86 || tLng / vLng > 0.86) map.setLevel(level)
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
