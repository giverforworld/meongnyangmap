'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Place } from '@/lib/types'
import { useIsMobile } from '@/lib/useIsMobile'
import KakaoMap from './KakaoMap'
import type { PlaceRef } from './PlacePicker'
import { PlacePinIcon } from './icons'

interface Region {
  code: string
  name: string
  sigungu: { code: string; name: string }[]
}

/**
 * 지도에서 장소 고르기 — 글에 붙일 곳을 핀으로 찍는다.
 *
 * 지도 화면과 같은 KakaoMap 을 쓴다. 지역을 고르면 그 지역 장소가 핀으로 뜨고,
 * 핀을 누르면 아래에 이름이 보이고 '이 장소로' 를 누르면 끝.
 * 판정은 하지 않는다 — 여기서는 "어디"만 고르는 자리라 핀은 전부 초록이다.
 */
export default function PlaceMapPicker({
  onPick, onClose,
}: {
  onPick: (p: PlaceRef) => void
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  const [regions, setRegions] = useState<Region[]>([])
  const [regnCd, setRegnCd] = useState('11')
  const [signguCd, setSignguCd] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/regions').then((r) => r.json()).then((d) => setRegions(d.regions ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setSelectedId(null)
    const qs = new URLSearchParams({ regnCd, ...(signguCd ? { signguCd } : {}), limit: '300' })
    fetch(`/api/places?${qs}`)
      .then((r) => r.json())
      .then((d) => { if (!alive) return; setPlaces(d.places ?? []); setTotal(d.total ?? 0) })
      .catch(() => { if (alive) setPlaces([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [regnCd, signguCd])

  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const region = regions.find((r) => r.code === regnCd)
  const judged = useMemo(() => places.map((p) => ({ ...p, state: 'info' as const })), [places])
  const sel = places.find((p) => p.contentid === selectedId) ?? null

  const selectStyle: React.CSSProperties = {
    font: 'inherit', fontSize: 14, padding: '8px 10px', borderRadius: 10, border: '1.5px solid #EAE3D6',
    background: '#F6F1E7', color: '#2B2420', outline: 'none', cursor: 'pointer',
  }

  return (
    <div onClick={onClose} role="dialog" aria-label="지도에서 장소 고르기"
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(43,36,32,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 760, height: isMobile ? '100%' : 'min(640px, 92vh)', background: '#FFFFFF', borderRadius: isMobile ? 0 : 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(43,36,32,.24)' }}>
        <header style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid #F1EBE0', flexWrap: 'wrap' }}>
          <span className="jua" style={{ fontSize: 18, marginRight: 4 }}>지도에서 고르기</span>
          <select value={regnCd} onChange={(e) => { setRegnCd(e.target.value); setSignguCd('') }} style={selectStyle}>
            {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
          <select value={signguCd} onChange={(e) => setSignguCd(e.target.value)} style={selectStyle}>
            <option value="">전체</option>
            {region?.sigungu.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          <span style={{ fontSize: 12, color: '#B3A78F' }}>
            {loading ? '불러오는 중…' : total > places.length ? `${places.length}곳 표시 (전체 ${total.toLocaleString()}곳 — 시군구를 고르면 더 정확해요)` : `${places.length}곳`}
          </span>
          <button onClick={onClose} aria-label="닫기"
            style={{ marginLeft: 'auto', border: 'none', background: 'none', fontSize: 16, color: '#A08872', cursor: 'pointer', padding: 4 }}>✕</button>
        </header>

        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <KakaoMap places={judged} selectedId={selectedId} onSelect={setSelectedId} narrow={isMobile} />
          <div style={{ position: 'absolute', left: 10, bottom: 10, fontSize: 11, color: '#6E5F4D', background: 'rgba(255,255,255,.9)', borderRadius: 99, padding: '3px 9px' }}>
            데이터 출처: ⓒ한국관광공사
          </div>
        </div>

        <footer style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: '1px solid #F1EBE0' }}>
          {sel ? (
            <>
              <span style={{ color: '#E85D3D', flex: 'none', display: 'flex' }}><PlacePinIcon size={18} /></span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                <b style={{ fontSize: 14, color: '#2B2420', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sel.title}</b>
                <span style={{ fontSize: 11.5, color: '#A08872', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sel.cat} · {sel.addr1}</span>
              </span>
              <button className="btn-primary" onClick={() => onPick({ id: sel.contentid, title: sel.title, addr: sel.addr1 })}
                style={{ flex: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '10px 18px', borderRadius: 12, border: 'none', background: '#E85D3D', color: '#FFFFFF', cursor: 'pointer' }}>
                이 장소로
              </button>
            </>
          ) : (
            <span style={{ fontSize: 13, color: '#A08872' }}>지도의 핀을 눌러 장소를 고르세요</span>
          )}
        </footer>
      </div>
    </div>
  )
}
