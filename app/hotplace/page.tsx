'use client'

import { useEffect, useMemo, useState } from 'react'
import { PETS, DEFAULT_PET } from '@/lib/pets'
import { splitTags, type Camp, type CampJudge } from '@/lib/camping'
import { distance } from '@/lib/geo'

interface Curated {
  contentid: string
  title: string
  addr1: string
  cat: string
  firstimage: string
  mapx: number
  mapy: number
  regnCd: string
  reasons: string[]
  summary: string
  needs: string[]
  usetime: string
  restdate: string
  regionName: string
  regionRank: number | null
}

interface Region {
  code: string
  name: string
}

const CAT_EMOJI: Record<string, string> = {
  관광지: '🏞', 문화시설: '🎨', 레포츠: '⛰', 숙박: '🏡', 음식점: '🍽', 쇼핑: '🛍',
}

const PAGE = 24

/**
 * "뭐 하고 놀지?"에 답하는 화면. 지도가 "이 장소, 갈 수 있나?"의 반대 방향이라
 * 우리가 먼저 골라 줘야 한다. 고르는 기준이 서로 달라 중메뉴로 나눈다 —
 * 핫플레이스는 조건이 확실한 곳, 캠핑은 별도 서비스(고캠핑)에서 온 3,115곳이다.
 */
type Tab = 'hot' | 'camp'

const TABS: { key: Tab; label: string; title: string; lede: React.ReactNode }[] = [
  {
    key: 'hot',
    label: '핫플레이스',
    title: '우리 아이랑 가기 좋은 곳',
    lede: (
      <>
        <b style={{ color: '#2B2420' }}>문 앞에서 눈치 볼 일 없는 곳</b>만 모았어요.
        구역 제한 없이 함께 들어갈 수 있고, 동반 조건이 빠짐없이 확인된 곳들이에요.
      </>
    ),
  },
  {
    key: 'camp',
    label: '캠핑',
    title: '우리 아이랑 하룻밤',
    lede: (
      <>
        전국 캠핑장 중 <b style={{ color: '#2B2420' }}>반려동물과 함께 묵을 수 있는 곳</b>이에요.
        크기 제한이 있는 곳은 우리 아이 기준으로 걸러서 보여드려요.
      </>
    ),
  },
]

/** 정렬 — 고르는 기준이 셋이라 각각 무엇을 앞으로 보내는지 이름에 담는다 */
type Sort = 'default' | 'visitors' | 'near'

const SORTS: { key: Sort; label: string }[] = [
  { key: 'default', label: '조건이 확실한 순' },
  { key: 'visitors', label: '요즘 붐비는 지역 순' },
  { key: 'near', label: '나와 가까운 순' },
]

/** 거리 표기 — 1km 미만은 m 로 */
const meters = (m: number) => (m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`)

const chip = (on: boolean): React.CSSProperties => ({
  flex: 'none',
  fontFamily: 'inherit',
  fontSize: 13.5,
  fontWeight: on ? 700 : 500,
  padding: '7px 14px',
  borderRadius: 99,
  border: `1.5px solid ${on ? '#2B2420' : '#E3DCCE'}`,
  background: on ? '#2B2420' : '#FFFFFF',
  color: on ? '#FFFFFF' : '#6E5F4D',
  cursor: 'pointer',
})

export default function Hotplace() {
  const [tab, setTab] = useState<Tab>('hot')
  const meta = TABS.find((t) => t.key === tab)!

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#FAF6EF' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px 56px' }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <h1 className="jua" style={{ margin: 0, fontSize: 26, color: '#2B2420' }}>
            {meta.title}
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#8A7A65', lineHeight: 1.6, maxWidth: 620 }}>
            {meta.lede}
          </p>
        </header>

        {/* 중메뉴 — 고르는 기준이 다른 목록들이라 나란히 둔다 */}
        <div
          className="chip-row"
          role="tablist"
          style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid #EAE3D6' }}
        >
          {TABS.map((t) => {
            const on = t.key === tab
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                style={{
                  flex: 'none',
                  fontFamily: 'inherit',
                  fontSize: 15,
                  fontWeight: on ? 700 : 500,
                  padding: '10px 16px',
                  border: 'none',
                  borderBottom: `2.5px solid ${on ? '#E85D3D' : 'transparent'}`,
                  background: 'transparent',
                  color: on ? '#E85D3D' : '#8A7A65',
                  cursor: 'pointer',
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'hot' ? <HotView /> : <CampView />}

        <p style={{ marginTop: 32, fontSize: 12, color: '#B3A78F' }}>출처 ⓒ한국관광공사</p>
      </div>
    </div>
  )
}

/* ── 핫플레이스 ──────────────────────────────────────────── */

function HotView() {
  const [items, setItems] = useState<Curated[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [regnCd, setRegnCd] = useState('')
  const [cat, setCat] = useState('전체')
  const [limit, setLimit] = useState(PAGE)
  const [loading, setLoading] = useState(true)
  /** 기본은 '조건이 확실한 순'. 방문자 순은 지역 인기를 얹어 보는 것이다 */
  const [sort, setSort] = useState<Sort>('default')
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(null)

  /**
   * 나와 가까운 순 — 좌표를 서버로 보내지 않는다.
   *
   * 위치를 서버로 전송하면 저장 여부와 무관하게 위치기반서비스사업자 신고 대상이
   * 된다(공모전 공지 FAQ). 목록이 이미 각 장소의 좌표를 들고 있으니, 브라우저에서
   * 거리만 재고 다시 늘어놓는다. 위치는 단말을 떠나지 않는다.
   */
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  async function pickSort(k: Sort) {
    setGeoError(null)
    setLimit(PAGE)
    if (k !== 'near' || here) {
      setSort(k)
      return
    }
    if (!navigator.geolocation) {
      setGeoError('이 브라우저는 위치를 알려주지 못해요')
      return
    }
    setGeoBusy(true)
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      )
      setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      setSort('near')
    } catch {
      setGeoError('위치를 가져오지 못했어요 — 브라우저에서 위치 권한을 허용해주세요')
    } finally {
      setGeoBusy(false)
    }
  }

  useEffect(() => {
    fetch('/api/regions')
      .then((r) => r.json())
      .then((d) => setRegions(d.regions ?? []))
      .catch(() => {})
  }, [])

  // 거리순은 받아온 목록을 브라우저에서 다시 늘어놓는 것이라 서버에 되묻지 않는다
  const serverSort = sort === 'visitors' ? 'visitors' : 'default'

  useEffect(() => {
    setLoading(true)
    setLimit(PAGE)
    const qs = new URLSearchParams({
      kind: 'hotplace',
      ...(regnCd ? { regnCd } : {}),
      ...(serverSort === 'visitors' ? { sort: serverSort } : {}),
    })
    fetch(`/api/curated?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? [])
        setPeriod(d.visitPeriod?.from ? d.visitPeriod : null)
      })
      .finally(() => setLoading(false))
  }, [regnCd, serverSort])

  const cats = useMemo(() => {
    const m: Record<string, number> = {}
    items.forEach((i) => (m[i.cat] = (m[i.cat] ?? 0) + 1))
    return ['전체', ...Object.keys(m).sort((a, b) => m[b] - m[a])]
  }, [items])

  /** 좌표가 없는 곳은 거리를 알 수 없다 — 0km 로 속이지 말고 뒤로 보낸다 */
  const matched = useMemo<(Curated & { meters?: number })[]>(() => {
    const list = items.filter((i) => cat === '전체' || i.cat === cat)
    if (sort !== 'near' || !here) return list
    return list
      .map((i) => ({
        ...i,
        meters: i.mapx && i.mapy ? distance(here.lat, here.lng, i.mapy, i.mapx) : Infinity,
      }))
      .sort((a, b) => a.meters - b.meters)
  }, [items, cat, sort, here])
  const shown = matched.slice(0, limit)

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <select
          value={regnCd}
          onChange={(e) => setRegnCd(e.target.value)}
          style={{ font: 'inherit', fontSize: 14, padding: '7px 12px', borderRadius: 12, border: '1.5px solid #EAE3D6', background: '#FFFFFF', color: '#2B2420', cursor: 'pointer' }}
        >
          <option value="">전국</option>
          {regions.map((r) => (
            <option key={r.code} value={r.code}>{r.name}</option>
          ))}
        </select>
        {cats.map((c) => (
          <button key={c} className="hov-accent" onClick={() => { setCat(c); setLimit(PAGE) }} style={chip(c === cat)}>
            {c}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#B3A78F' }}>
          {loading ? '불러오는 중…' : `${matched.length.toLocaleString()}곳`}
        </span>
      </div>

      {/* 정렬 — 방문자 데이터는 '지역'의 것이라 문구가 그 선을 넘지 않아야 한다 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {SORTS.map(({ key: k, label }) => {
          const on = k === sort
          const busy = k === 'near' && geoBusy
          return (
            <button key={k} className="hov-accent" onClick={() => pickSort(k)} disabled={busy}
              style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 500, padding: '5px 12px', borderRadius: 99, border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF4EF' : '#FFFFFF', color: on ? '#E85D3D' : '#8A7A65', cursor: busy ? 'default' : 'pointer' }}>
              {k === 'near' && '🧭 '}{busy ? '위치 확인 중…' : label}
            </button>
          )
        })}
        {sort === 'visitors' && period && (
          <span style={{ fontSize: 11.5, color: '#B3A78F', lineHeight: 1.5 }}>
            장소가 아니라 <b style={{ color: '#8A7A65' }}>시군구</b> 기준 외지인 방문 수예요
            · {period.from.slice(4, 6)}.{period.from.slice(6)}~{period.to.slice(4, 6)}.{period.to.slice(6)} 집계
          </span>
        )}
        {sort === 'near' && here && (
          <span style={{ fontSize: 11.5, color: '#B3A78F', lineHeight: 1.5 }}>
            위치는 <b style={{ color: '#8A7A65' }}>이 브라우저 안에서만</b> 쓰고 서버로 보내지 않아요
          </span>
        )}
        {geoError && (
          <span style={{ fontSize: 11.5, color: '#C0392B', lineHeight: 1.5 }}>{geoError}</span>
        )}
      </div>

      {!loading && matched.length === 0 && (
        <p style={{ padding: 40, textAlign: 'center', color: '#A08872', fontSize: 14 }}>
          이 지역에는 조건이 완전하게 등록된 곳이 아직 없어요
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 14 }}>
        {shown.map((p) => (
          <article key={p.contentid} style={{ background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 132, background: p.firstimage ? `center/cover url(${p.firstimage})` : 'linear-gradient(135deg,#FFE0D3,#FFF4EF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>
              {!p.firstimage && (CAT_EMOJI[p.cat] ?? '📍')}
            </div>
            <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: '#2B2420', wordBreak: 'keep-all' }}>{p.title}</h2>
              <p style={{ margin: 0, fontSize: 12, color: '#A08872' }}>
                {p.cat} · {p.addr1.split(' ').slice(0, 2).join(' ')}
                {p.meters !== undefined && Number.isFinite(p.meters) && (
                  <span style={{ color: '#E85D3D', fontWeight: 700 }}> · {meters(p.meters)}</span>
                )}
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

      {shown.length < matched.length && (
        <button className="hov-accent" onClick={() => setLimit((n) => n + PAGE)}
          style={{ display: 'block', margin: '20px auto 0', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '11px 28px', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
          {Math.min(PAGE, matched.length - shown.length)}곳 더 보기
        </button>
      )}
    </>
  )
}

/* ── 캠핑 ────────────────────────────────────────────────── */

type JudgedCamp = Camp & { j: CampJudge }

/** 위치 유형 — 데이터에 실제로 쓰이는 값들. 어떤 곳인지 한 단어로 고르게 한다 */
const TAGS = ['해변', '산', '숲', '강', '호수', '섬', '도심']

function CampView() {
  const [petKey, setPetKey] = useState(DEFAULT_PET)
  const [region, setRegion] = useState('')
  const [tag, setTag] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [data, setData] = useState<{
    camps: JudgedCamp[]
    total: number
    hidden: number
    okCount: number
    regions: { name: string; n: number }[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const pet = PETS[petKey]

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams({
      size: pet.size,
      petName: pet.name,
      limit: String(limit),
      ...(region ? { do: region } : {}),
      ...(tag ? { tag } : {}),
    })
    fetch(`/api/camping?${qs}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [pet.size, pet.name, region, tag, limit])

  const camps = data?.camps ?? []

  return (
    <>
      {/* 우리 아이 기준 — 크기에 따라 결과가 크게 갈려서 여기서 바로 바꾸게 한다 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button className="hov-accent"
          onClick={() => { setPetKey(petKey === 'ruby' ? 'bori' : 'ruby'); setLimit(PAGE) }}
          title="다른 아이 기준으로 다시 판정"
          style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#FFF4EF', border: '1.5px solid #F3C9BB', borderRadius: 99, padding: '6px 15px 6px 7px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#2B2420' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: '#FFE0D3', borderRadius: '50%', fontSize: 16, overflow: 'hidden', flex: 'none' }}>
            {pet.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pet.photo} alt="" width={30} height={30}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.textContent = pet.emoji }} />
            ) : pet.emoji}
          </span>
          <span style={{ fontWeight: 700 }}>{pet.name}</span>
          <span style={{ fontSize: 12.5, color: '#A08872' }}>{pet.kg}kg · {pet.sizeLabel} ▾</span>
        </button>

        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#B3A78F' }}>
          {loading && !data ? '불러오는 중…' : `${(data?.total ?? 0).toLocaleString()}곳`}
          {data && data.hidden > 0 && (
            <span style={{ color: '#C4B8A4' }}> · 동반 불가 {data.hidden.toLocaleString()}곳 숨김</span>
          )}
        </span>
      </div>

      {/* 지역 */}
      <div className="chip-row" style={{ display: 'flex', gap: 7, marginBottom: 10, overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: 2 }}>
        <button className="hov-accent" onClick={() => { setRegion(''); setLimit(PAGE) }} style={chip(region === '')}>전국</button>
        {(data?.regions ?? []).map((r) => (
          <button key={r.name} className="hov-accent" onClick={() => { setRegion(r.name); setLimit(PAGE) }} style={chip(region === r.name)}>
            {r.name} <span style={{ opacity: 0.65, fontWeight: 500 }}>{r.n}</span>
          </button>
        ))}
      </div>

      {/* 어떤 곳 — 해변·산·숲 */}
      <div className="chip-row" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <span style={{ flex: 'none', fontSize: 12, color: '#B3A78F', marginRight: 2 }}>어떤 곳</span>
        {['전체', ...TAGS].map((t) => {
          const key = t === '전체' ? '' : t
          const on = key === tag
          return (
            <button key={t} className="hov-accent" onClick={() => { setTag(key); setLimit(PAGE) }}
              style={{ flex: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 500, padding: '4px 11px', borderRadius: 99, border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF4EF' : '#FFFFFF', color: on ? '#E85D3D' : '#8A7A65', cursor: 'pointer' }}>
              {t}
            </button>
          )
        })}
      </div>

      {!loading && camps.length === 0 && (
        <p style={{ padding: 40, textAlign: 'center', color: '#A08872', fontSize: 14, lineHeight: 1.7 }}>
          {pet.name}가 묵을 수 있는 캠핑장이<br />이 조건에는 없어요
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 14 }}>
        {camps.map((c) => {
          const ok = c.j.state === 'ok'
          return (
            <article key={c.id} style={{ background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 132, background: c.image ? `center/cover url(${c.image})` : 'linear-gradient(135deg,#E4F0E4,#F4FAF4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>
                {!c.image && '⛺'}
              </div>
              <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: '#2B2420', wordBreak: 'keep-all' }}>{c.name}</h2>
                  <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap', border: `1.5px solid ${ok ? '#2F8F4E' : '#C98A12'}`, color: ok ? '#2F8F4E' : '#8A6208', background: ok ? '#EAF6EA' : '#FBF3DD' }}>
                    {ok ? '○ 동반 가능' : '✓ 확인 필요'}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 12, color: '#A08872' }}>
                  {c.doNm} {c.sigunguNm}
                  {c.induty && <> · {splitTags(c.induty)[0]}</>}
                </p>

                <p style={{ margin: 0, fontSize: 12.5, color: ok ? '#2F8F4E' : '#8A6208', lineHeight: 1.5 }}>
                  {c.j.why}
                </p>

                {c.intro && (
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: '#6E5F4D', wordBreak: 'keep-all' }}>
                    {c.intro}…
                  </p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 'auto', paddingTop: 4 }}>
                  {splitTags(c.lctCl).map((t) => (
                    <span key={t} style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: '#F1EDE3', color: '#6E5F4D' }}>
                      {t}
                    </span>
                  ))}
                </div>

                {(c.mapx > 0 || c.tel) && (
                  <div style={{ display: 'flex', gap: 6, paddingTop: 4 }}>
                    {c.mapx > 0 && (
                      <a className="hov-accent" href={`https://map.kakao.com/link/to/${encodeURIComponent(c.name)},${c.mapy},${c.mapx}`} target="_blank" rel="noreferrer"
                        style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 700, padding: '7px 0', borderRadius: 10, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#2B2420', textDecoration: 'none' }}>
                        길찾기
                      </a>
                    )}
                    {c.tel && (
                      <a className="hov-accent" href={`tel:${c.tel.replace(/[^0-9+]/g, '')}`}
                        style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 700, padding: '7px 0', borderRadius: 10, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#2B2420', textDecoration: 'none' }}>
                        ☎ 전화
                      </a>
                    )}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {data && camps.length < data.total && (
        <button className="hov-accent" onClick={() => setLimit((n) => n + PAGE)}
          style={{ display: 'block', margin: '20px auto 0', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '11px 28px', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
          {Math.min(PAGE, data.total - camps.length)}곳 더 보기
        </button>
      )}
    </>
  )
}
