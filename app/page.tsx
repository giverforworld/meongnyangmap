'use client'

import { useEffect, useMemo, useState } from 'react'
import { judge, isDangerousBreed, sizeOf } from '@/lib/petTour'
import type { Judgement, Pet, Place } from '@/lib/types'
import KakaoMap from './KakaoMap'

const PETS: Record<string, Pet> = {
  choco: {
    key: 'choco', name: '초코', breed: '말티즈', kg: 3.2, emoji: '🐶',
    size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false,
  },
  bori: {
    key: 'bori', name: '보리', breed: '리트리버', kg: 28, emoji: '🦮',
    size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false,
  },
}

const BADGE = {
  ok: {
    text: '✓ 입장 가능', border: '#2F8F4E', color: '#2F8F4E', bg: '#EAF6EA', checkBg: '#F2FAF2',
  },
  cond: {
    text: '△ 조건부 가능', border: '#C98A12', color: '#8A6208', bg: '#FBF3DD', checkBg: '#FDF8EA',
  },
} as const

const CAT_EMOJI: Record<string, string> = {
  관광지: '🏞', 문화시설: '🎨', 레포츠: '⛰', 숙박: '🏡', 음식점: '🍽',
}

const CATS = ['전체', '관광지', '음식점', '숙박', '문화시설', '레포츠']

interface Region {
  code: string
  name: string
  sigungu: { code: string; name: string }[]
}

type Judged = Place & { j: Judgement }

export default function Home() {
  const [regions, setRegions] = useState<Region[]>([])
  const [regnCd, setRegnCd] = useState('11')
  const [signguCd, setSignguCd] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState(0)
  const [degraded, setDegraded] = useState(false)

  const [petKey, setPetKey] = useState('choco')
  const [cat, setCat] = useState('전체')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const pet = PETS[petKey]

  useEffect(() => {
    fetch('/api/regions')
      .then((r) => r.json())
      .then((d) => setRegions(d.regions ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    setSelectedId(null)
    const qs = new URLSearchParams({ regnCd, ...(signguCd ? { signguCd } : {}) })
    fetch(`/api/places?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        setPlaces(d.places ?? [])
        setFailed(d.failed ?? 0)
        setDegraded(Boolean(d.degraded))
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [regnCd, signguCd])

  // ── 판정
  const judged: Judged[] = useMemo(
    () => places.map((p) => ({ ...p, j: judge(p.rules, pet) })),
    [places, pet]
  )

  const visible = useMemo(() => judged.filter((p) => p.j.status !== 'no'), [judged])
  const hiddenCount = judged.length - visible.length

  const inCat = useMemo(
    () => visible.filter((p) => cat === '전체' || p.cat === cat),
    [visible, cat]
  )

  const sorted = useMemo(
    () => [...inCat].sort((a, b) => (a.j.status === 'ok' ? 0 : 1) - (b.j.status === 'ok' ? 0 : 1)),
    [inCat]
  )

  const okCount = visible.filter((p) => p.j.status === 'ok').length
  const condCount = visible.filter((p) => p.j.status === 'cond').length

  const sel = sorted.find((p) => p.contentid === selectedId) ?? null
  const region = regions.find((r) => r.code === regnCd)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 1100, overflow: 'hidden' }}>
      {/* ── 상단 바 */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', background: '#FFFFFF', borderBottom: '1px solid #EAE3D6', flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="jua" style={{ fontSize: 26, color: '#E85D3D' }}>멍냥맵</span>
          <span style={{ fontSize: 20 }}>🐾</span>
        </div>

        <div className="hov-accent" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F6F1E7', border: '1.5px solid #EAE3D6', borderRadius: 12, padding: '7px 12px' }}>
          <span>📍</span>
          <select value={regnCd} onChange={(e) => { setRegnCd(e.target.value); setSignguCd('') }}
            style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 14, color: '#2B2420', cursor: 'pointer', outline: 'none' }}>
            {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
          <select value={signguCd} onChange={(e) => setSignguCd(e.target.value)}
            style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 14, color: '#6E5F4D', cursor: 'pointer', outline: 'none' }}>
            <option value="">전체</option>
            {region?.sigungu.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ flex: 1 }} />

        <button className="hov-accent" onClick={() => { setPetKey(petKey === 'choco' ? 'bori' : 'choco'); setSelectedId(null) }}
          style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#FFF4EF', border: '1.5px solid #F3C9BB', borderRadius: 99, padding: '6px 14px 6px 8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#2B2420' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: '#FFE0D3', borderRadius: '50%', fontSize: 16 }}>{pet.emoji}</span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
            <span style={{ fontWeight: 700 }}>{pet.name} · {pet.breed}</span>
            <span style={{ fontSize: 11.5, color: '#A08872' }}>{pet.kg}kg · {pet.sizeLabel} · 프로필 전환 ▾</span>
          </span>
        </button>
      </header>

      {/* ── 필터 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#FFFFFF', borderBottom: '1px solid #EAE3D6', flex: 'none' }}>
        {CATS.map((label) => {
          const on = label === cat
          return (
            <button key={label} className="hov-accent" onClick={() => setCat(label)}
              style={{ fontFamily: 'inherit', fontSize: 13.5, fontWeight: on ? 700 : 500, padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${on ? '#2B2420' : '#E3DCCE'}`, background: on ? '#2B2420' : '#FFFFFF', color: on ? '#FFFFFF' : '#6E5F4D', cursor: 'pointer' }}>
              {label}
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        {degraded && (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#C0392B', marginRight: 12 }}>
            ! 조건 정보를 불러오지 못했어요{failed > 0 ? ` (${failed}곳)` : ''} — 새로고침하면 다시
            시도해요
          </span>
        )}
        <span style={{ fontSize: 12.5, color: '#B3A78F' }}>
          ✕ 동반 불가 {hiddenCount}곳은 지도에 표시되지 않아요
        </span>
      </div>

      {/* ── 본문 */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 좌측 결과 리스트 */}
        <aside style={{ width: 312, flex: 'none', background: '#FFFFFF', borderRight: '1px solid #EAE3D6', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {pet.name}가 갈 수 있는 곳 <span style={{ color: '#E85D3D' }}>{sorted.length}</span>
            </span>
            <span style={{ fontSize: 12, color: '#B3A78F' }}>가능 순</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading && <div style={{ padding: 20, fontSize: 13, color: '#A08872', textAlign: 'center' }}>불러오는 중…</div>}
            {!loading && error && <div style={{ padding: 16, fontSize: 12.5, color: '#C0392B', lineHeight: 1.5 }}>{error}</div>}
            {!loading && !error && sorted.length === 0 && (
              <div style={{ padding: 20, fontSize: 13, color: '#A08872', textAlign: 'center', lineHeight: 1.6 }}>
                이 지역에는 등록된<br />동반 가능 장소가 없어요
              </div>
            )}

            {sorted.map((p) => {
              const b = BADGE[p.j.status as 'ok' | 'cond']
              const on = p.contentid === selectedId
              const condCheck = p.j.checks.find((c) => c.icon === '!')
              return (
                <div key={p.contentid} className="hov-card" onClick={() => setSelectedId(p.contentid)}
                  style={{ border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF6F2' : '#FFFFFF', borderRadius: 14, padding: '11px 13px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 99, border: `1.5px solid ${b.border}`, color: b.color, background: b.bg, whiteSpace: 'nowrap' }}>{b.text}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#A08872' }}>{p.cat} · {p.addr1.split(' ').slice(1, 3).join(' ')}</div>
                  <div style={{ fontSize: 12.5, color: condCheck ? '#8A6208' : '#2F8F4E' }}>
                    {condCheck ? condCheck.text : p.j.checks[0]?.text}
                  </div>
                </div>
              )
            })}
          </div>
        </aside>

        {/* 지도 영역 */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#EFEAE0' }}>
          <KakaoMap places={inCat} selectedId={selectedId} onSelect={setSelectedId} />

          {/* 범례 */}
          <div style={{ position: 'absolute', right: 16, bottom: 16, background: '#FFFFFF', border: '1px solid #EAE3D6', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 5, boxShadow: '0 4px 14px rgba(43,36,32,.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#2F8F4E' }} />입장 가능 {okCount}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#C98A12' }} />조건부 가능 {condCount}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#B3A78F' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#D8D0C0' }} />불가 {hiddenCount} (숨김)</div>
          </div>

          <div style={{ position: 'absolute', left: 16, top: 14, background: 'rgba(255,255,255,.92)', border: '1px solid #EAE3D6', borderRadius: 99, padding: '6px 14px', fontSize: 12.5, color: '#6E5F4D' }}>
            {pet.emoji} <b>{pet.name}</b> 기준으로 판정된 지도예요 · 출처 ⓒ한국관광공사
          </div>

          {/* 상세 패널 */}
          {sel && (() => {
            const b = BADGE[sel.j.status as 'ok' | 'cond']
            return (
              <div style={{ position: 'absolute', left: 14, top: 56, bottom: 14, width: 330, background: '#FFFFFF', border: '1px solid #EAE3D6', borderRadius: 18, boxShadow: '0 10px 34px rgba(43,36,32,.16)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slidein .22s ease-out', zIndex: 30 }}>
                <div style={{ height: 96, background: sel.firstimage ? `center/cover url(${sel.firstimage})` : 'linear-gradient(135deg,#FFE0D3,#FFF4EF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, position: 'relative' }}>
                  {!sel.firstimage && (CAT_EMOJI[sel.cat] ?? '📍')}
                  <button onClick={() => setSelectedId(null)}
                    style={{ position: 'absolute', right: 10, top: 10, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.85)', cursor: 'pointer', fontSize: 14, color: '#6E5F4D' }}>✕</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="jua" style={{ fontSize: 21 }}>{sel.title}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '3px 11px', borderRadius: 99, border: `1.5px solid ${b.border}`, color: b.color, background: b.bg, whiteSpace: 'nowrap' }}>{b.text}</span>
                  </div>

                  <div style={{ fontSize: 12.5, color: '#A08872' }}>{sel.cat} · {sel.addr1}</div>

                  <div style={{ border: `1.5px solid ${b.border}`, background: b.checkBg, borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>입장 조건 체크리스트 — {pet.name} 기준</span>
                    {sel.j.checks.map((ck, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700, color: ck.color }}>{ck.icon}</span>
                        <span>{ck.text}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1.5px dashed #E3D9C6', paddingTop: 7, fontSize: 11.5, color: '#A08872' }}>
                      조건 정보 충실도 {sel.rules?.completeness ?? '—'}등급 · 출처 ⓒ한국관광공사
                    </div>
                  </div>

                  {sel.rules && sel.rules.notes.length > 0 && (
                    <div style={{ border: '1.5px solid #F0D9A0', background: '#FBF3DD', borderRadius: 12, padding: '10px 13px', fontSize: 12.5, color: '#8A6208', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <b>현장 규정</b>
                      {sel.rules.notes.map((n, i) => <div key={i}>• {n}</div>)}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    <a className="btn-primary" href={`https://map.kakao.com/link/to/${encodeURIComponent(sel.title)},${sel.mapy},${sel.mapx}`} target="_blank" rel="noreferrer"
                      style={{ flex: 1, fontSize: 14, fontWeight: 700, padding: '11px 0', borderRadius: 12, border: 'none', background: '#E85D3D', color: '#FFFFFF', cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>길찾기</a>
                    <button className="hov-accent"
                      style={{ flex: 1, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '11px 0', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#2B2420', cursor: 'pointer' }}>전화 확인</button>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
