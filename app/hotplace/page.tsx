'use client'

import { useEffect, useMemo, useState } from 'react'

interface Curated {
  contentid: string
  title: string
  addr1: string
  cat: string
  firstimage: string
  regnCd: string
  reasons: string[]
  summary: string
  needs: string[]
  usetime: string
  restdate: string
}

interface Region {
  code: string
  name: string
}

const CAT_EMOJI: Record<string, string> = {
  관광지: '🏞', 문화시설: '🎨', 레포츠: '⛰', 숙박: '🏡', 음식점: '🍽', 쇼핑: '🛍',
}

const PAGE = 24

export default function Hotplace() {
  const [items, setItems] = useState<Curated[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [regnCd, setRegnCd] = useState('')
  const [cat, setCat] = useState('전체')
  const [limit, setLimit] = useState(PAGE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/regions')
      .then((r) => r.json())
      .then((d) => setRegions(d.regions ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setLimit(PAGE)
    fetch(`/api/curated?kind=hotplace${regnCd ? `&regnCd=${regnCd}` : ''}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false))
  }, [regnCd])

  const cats = useMemo(() => {
    const m: Record<string, number> = {}
    items.forEach((i) => (m[i.cat] = (m[i.cat] ?? 0) + 1))
    return ['전체', ...Object.keys(m).sort((a, b) => m[b] - m[a])]
  }, [items])

  const shown = useMemo(
    () => items.filter((i) => cat === '전체' || i.cat === cat).slice(0, limit),
    [items, cat, limit]
  )
  const total = items.filter((i) => cat === '전체' || i.cat === cat).length

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#FAF6EF' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px 56px' }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          <h1 className="jua" style={{ margin: 0, fontSize: 26, color: '#2B2420' }}>
            확실히 갈 수 있는 곳
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#8A7A65', lineHeight: 1.6, maxWidth: 620 }}>
            방문수 대신 <b style={{ color: '#2B2420' }}>규정이 확실한 정도</b>로 골랐어요.
            전 구역 동반 가능하고, 조건 정보가 빠짐없이 등록돼 있고, 보여줄 사진과 소개가 있는 곳만 모았습니다.
          </p>
        </header>

        {/* 지역·종류 필터 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <select value={regnCd} onChange={(e) => setRegnCd(e.target.value)}
            style={{ font: 'inherit', fontSize: 14, padding: '7px 12px', borderRadius: 12, border: '1.5px solid #EAE3D6', background: '#FFFFFF', color: '#2B2420', cursor: 'pointer' }}>
            <option value="">전국</option>
            {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
          {cats.map((c) => {
            const on = c === cat
            return (
              <button key={c} className="hov-accent" onClick={() => { setCat(c); setLimit(PAGE) }}
                style={{ fontFamily: 'inherit', fontSize: 13.5, fontWeight: on ? 700 : 500, padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${on ? '#2B2420' : '#E3DCCE'}`, background: on ? '#2B2420' : '#FFFFFF', color: on ? '#FFFFFF' : '#6E5F4D', cursor: 'pointer' }}>
                {c}
              </button>
            )
          })}
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#B3A78F' }}>
            {loading ? '불러오는 중…' : `${total.toLocaleString()}곳`}
          </span>
        </div>

        {!loading && total === 0 && (
          <p style={{ padding: 40, textAlign: 'center', color: '#A08872', fontSize: 14 }}>
            이 지역에는 조건이 완전하게 등록된 곳이 아직 없어요
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 14 }}>
          {shown.map((p) => (
            <article key={p.contentid}
              style={{ background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 132, background: p.firstimage ? `center/cover url(${p.firstimage})` : 'linear-gradient(135deg,#FFE0D3,#FFF4EF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>
                {!p.firstimage && (CAT_EMOJI[p.cat] ?? '📍')}
              </div>
              <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: '#2B2420', wordBreak: 'keep-all' }}>{p.title}</h2>
                <p style={{ margin: 0, fontSize: 12, color: '#A08872' }}>
                  {p.cat} · {p.addr1.split(' ').slice(0, 2).join(' ')}
                </p>
                {p.summary && (
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: '#6E5F4D', wordBreak: 'keep-all' }}>
                    {p.summary}…
                  </p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 'auto', paddingTop: 4 }}>
                  {p.reasons.map((r) => (
                    <span key={r} style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: '#EAF6EA', color: '#2F8F4E' }}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        {shown.length < total && (
          <button className="hov-accent" onClick={() => setLimit((n) => n + PAGE)}
            style={{ display: 'block', margin: '20px auto 0', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '11px 28px', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
            {Math.min(PAGE, total - shown.length)}곳 더 보기
          </button>
        )}

        <p style={{ marginTop: 32, fontSize: 12, color: '#B3A78F' }}>출처 ⓒ한국관광공사</p>
      </div>
    </div>
  )
}
