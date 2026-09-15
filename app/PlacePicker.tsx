'use client'

import { useEffect, useRef, useState } from 'react'
import PlaceMapPicker from './PlaceMapPicker'

export interface PlaceRef {
  id: string
  title: string
  addr: string
}

/**
 * 글에 장소를 붙인다. 이름으로 전국에서 찾아 고른다 — /api/places 의 q 검색을 그대로 쓴다.
 * 지도·핫플레이스에서 "이곳 이야기 쓰기"로 들어오면 이미 골라진 채로 온다.
 */
export default function PlacePicker({
  value, onChange,
}: {
  value: PlaceRef | null
  onChange: (v: PlaceRef | null) => void
}) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PlaceRef[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)

  // 글자마다 부르지 않는다 — 300ms 멈추면 그때 한 번
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const k = q.trim()
    if (k.length < 2) { setHits([]); return }
    timer.current = setTimeout(() => {
      const my = ++seq.current
      setBusy(true)
      fetch(`/api/places?q=${encodeURIComponent(k)}&limit=8`)
        .then((r) => r.json())
        .then((d) => { if (my === seq.current) setHits((d.places ?? []).map((p: { contentid: string; title: string; addr1: string }) => ({ id: p.contentid, title: p.title, addr: p.addr1 }))) })
        .catch(() => { if (my === seq.current) setHits([]) })
        .finally(() => { if (my === seq.current) setBusy(false) })
    }, 300)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [q])

  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, border: '1.5px solid #F3C9BB', background: '#FFF4EF' }}>
        <span style={{ fontSize: 14, flex: 'none' }}>📍</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
          <b style={{ fontSize: 13.5, color: '#2B2420', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.title}</b>
          {value.addr && <span style={{ fontSize: 11.5, color: '#A08872', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.addr}</span>}
        </span>
        <button type="button" onClick={() => onChange(null)} aria-label="장소 연결 풀기"
          style={{ flex: 'none', fontFamily: 'inherit', fontSize: 12.5, color: '#A08872', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          ✕
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 0 12px', borderRadius: 12, border: '1.5px solid #EAE3D6', background: '#FFFFFF' }}>
        <span style={{ fontSize: 14, flex: 'none', color: '#A08872' }}>📍</span>
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="어느 곳 이야기인가요? 이름으로 찾기 (선택)"
          style={{ flex: 1, font: 'inherit', fontSize: 14, padding: '10px 0', border: 'none', background: 'transparent', color: '#2B2420', outline: 'none', minWidth: 0 }} />
        {busy && <span style={{ fontSize: 11.5, color: '#B3A78F', flex: 'none' }}>찾는 중…</span>}
        {/* 이름을 모르면 지도에서 핀으로 */}
        <button type="button" onClick={() => setMapOpen(true)}
          style={{ flex: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '6px 10px', borderRadius: 9, border: '1.5px solid #E3DCCE', background: '#F6F1E7', color: '#6E5F4D', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          지도에서 고르기
        </button>
      </div>
      {mapOpen && (
        <PlaceMapPicker onClose={() => setMapOpen(false)} onPick={(p) => { onChange(p); setMapOpen(false) }} />
      )}
      {open && hits.length > 0 && (
        <ul role="listbox" onMouseDown={(e) => e.preventDefault()} style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 20, margin: 0, padding: 6, listStyle: 'none', background: '#FFFFFF', border: '1px solid #EAE3D6', borderRadius: 12, boxShadow: '0 10px 28px rgba(43,36,32,.14)', maxHeight: 260, overflowY: 'auto' }}>
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(h); setQ(''); setHits([]); setOpen(false) }}
                className="hov-row"
                style={{ width: '100%', textAlign: 'left', fontFamily: 'inherit', background: 'none', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#2B2420' }}>{h.title}</span>
                <span style={{ fontSize: 11.5, color: '#A08872' }}>{h.addr}</span>
              </button>
            </li>
          ))}
          <li style={{ padding: '4px 10px 2px', fontSize: 10.5, color: '#B3A78F' }}>출처 ⓒ한국관광공사</li>
        </ul>
      )}
    </div>
  )
}
