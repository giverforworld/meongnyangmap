'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { judge, isDangerousBreed, sizeOf } from '@/lib/petTour'
import type { CardState, Detail, Judgement, Place, RulesEntry } from '@/lib/types'
import { usePets } from '@/lib/usePets'
import PetSwitch from './PetSwitch'
import { crowdHint, crowdLevel, dowOf, type CrowdDay } from '@/lib/crowd'
import { restStatus, todayLabel } from '@/lib/openHours'
import { useIsMobile } from '@/lib/useIsMobile'
import { distance } from '@/lib/geo'
import KakaoMap from './KakaoMap'

const BADGE = {
  ok: {
    text: '○ 입장 가능', border: '#2F8F4E', color: '#2F8F4E', bg: '#EAF6EA', checkBg: '#F2FAF2',
  },
  cond: {
    text: '✓ 조건부 가능', border: '#C98A12', color: '#8A6208', bg: '#FBF3DD', checkBg: '#FDF8EA',
  },
  loading: {
    text: '조건 확인 중…', border: '#E3DCCE', color: '#A08872', bg: '#F8F5EE', checkBg: '#FAF8F3',
  },
  failed: {
    text: '! 조건 확인 실패', border: '#E0A9A0', color: '#C0392B', bg: '#FBEDEA', checkBg: '#FDF5F3',
  },
} as const

const CAT_EMOJI: Record<string, string> = {
  관광지: '🏞', 문화시설: '🎨', 행사: '🎪', 레포츠: '⛰', 숙박: '🏡', 쇼핑: '🛍', 음식점: '🍽',
}

/** 버튼 순서. 목록에 실제로 있는 것만 그린다 — 행사는 현재 전 지역 0건이다 */
const CAT_ORDER = ['관광지', '음식점', '숙박', '문화시설', '레포츠', '행사']

/**
 * 쇼핑은 기본 목록에서 뺀다.
 *
 * 관광공사 목록에서 쇼핑은 안경원·백화점 입점 매장 같은 개별 상점이고,
 * 서울 3,170곳 중 3,092곳(97.5%)·전국 9,691곳 중 8,647곳(89%)이 여기 속한다.
 * 이걸 '전체'에 섞으면 화면에 뜨는 숫자가 사실상 상점 수가 되어 갈 곳을 찾는 눈을 가린다.
 * 빼는 게 아니라 옆으로 옮기는 것이다 — 칩을 누르면 그대로 볼 수 있다.
 */
const ASIDE_CAT = '쇼핑'
/** 쇼핑을 뺀 나머지 전부 */
const ALL = '갈 만한 곳'

/** 한 번에 그리는 카드 수. 서버가 이만큼만 보내고, 이 수만큼만 동반 조건을 조회한다 */
const PAGE = 100

interface Region {
  code: string
  name: string
  sigungu: { code: string; name: string }[]
}

/**
 * 전화 필드는 "전통가옥 운영사무실 02-6358-5533" 처럼 이름과 번호가 한 덩어리로 온다.
 * 그대로 버튼에 넣으면 번호 중간에서 줄이 바뀌어 읽기 어렵다 — 갈라서 번호는 붙여 둔다.
 */
function splitTel(raw: string) {
  const m = raw.match(/(0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}|1[35]\d{2}[-\s.]?\d{4})/)
  if (!m) return { label: '', num: raw.trim() }
  return {
    label: raw.slice(0, m.index).trim().replace(/[(,\/·]+$/, '').trim(),
    num: m[0],
  }
}

type Judged = Place & { j: Judgement | null; state: CardState }

export default function Home() {
  const [regions, setRegions] = useState<Region[]>([])
  const [regnCd, setRegnCd] = useState('11')
  const [signguCd, setSignguCd] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  /** 걸러진 전체 개수. 화면에 그려진 수(places.length)와 다르다 */
  const [total, setTotal] = useState(0)
  /** 칩에 붙는 숫자 — 고르기 전 기준이라 서버가 세어 준다 */
  const [counts, setCounts] = useState<{
    all: number
    byCat: Record<string, number>
    bySub: Record<string, number>
  }>({ all: 0, byCat: {}, bySub: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  /** 이 장소의 향후 30일 혼잡 예측. 매칭된 곳에만 있다 */
  const [crowd, setCrowd] = useState<CrowdDay[] | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  /** 소개글은 길어서 접어 둔다 — 판정과 현장 규정이 먼저 보여야 한다 */
  const [overviewOpen, setOverviewOpen] = useState(false)
  /** 검색어와 '내 주변' — 셋 다 같은 전국 목록 위에서 걸러낸다 */
  const [q, setQ] = useState('')
  /** 현재 위치로 고른 contentid 목록. 좌표 자체는 서버로 보내지 않는다 */
  const [nearIds, setNearIds] = useState<string[] | null>(null)
  /** contentid → 내 위치에서의 거리(m). 브라우저가 계산한 값이다 */
  const [nearDist, setNearDist] = useState<Record<string, number>>({})
  const [nearBusy, setNearBusy] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const petStore = usePets()
  const [cat, setCat] = useState(ALL)
  const [sub, setSub] = useState('전체')
  const [limit, setLimit] = useState(PAGE)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  /** 동반 조건 — 화면에 그려진 장소만 채워진다 */
  const [rulesById, setRulesById] = useState<Record<string, RulesEntry>>({})
  /** 이미 조회를 건 contentid. 같은 장소를 두 번 부르지 않기 위한 것 */
  const requested = useRef(new Set<string>())
  /** 상세 패널 스크롤 영역 */
  const panelBody = useRef<HTMLDivElement>(null)
  /** 분류체계 코드 → 이름 */
  const [catNames, setCatNames] = useState<Record<string, string>>({})

  const isMobile = useIsMobile()
  /**
   * 좁은 화면 — 지도를 깔고 그 위를 목록 시트가 덮는다.
   * 목록과 지도를 탭으로 갈라 두면 "이게 어디쯤이지"를 확인할 때마다 화면을 갈아타야 한다.
   * 지도앱들이 시트를 쓰는 이유가 그것이라, 높이를 세 단계로 끊어 같은 방식을 따른다.
   */
  const [sheet, setSheet] = useState<'peek' | 'half' | 'full'>('half')
  /** 손가락으로 끄는 동안의 실제 높이(px). 놓으면 가장 가까운 단계로 붙는다 */
  const [sheetPx, setSheetPx] = useState<number | null>(null)
  /**
   * 좁은 화면 — 지역·종류·검색을 바 하나로 합치고, 고르는 일은 시트에서 한다.
   * 상단이 한 줄로 줄어 지도가 그만큼 넓어진다.
   */
  const [filterOpen, setFilterOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ y: number; h: number } | null>(null)

  const pet = petStore.pet

  useEffect(() => {
    fetch('/api/regions')
      .then((r) => r.json())
      .then((d) => setRegions(d.regions ?? []))
      .catch(() => {})
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCatNames(d.names ?? {}))
      .catch(() => {})
  }, [])

  /**
   * 지역·검색·내 주변이 바뀌면 보던 조건을 되돌린다.
   * 목록을 비우지 않으면, 새 목록이 도착하기 전에 이전 지역 장소로 조건 조회가
   * 한 번 더 나간다 — 조회 기록을 방금 비웠기 때문이다.
   */
  useEffect(() => {
    setCat(ALL)
    setSub('전체')
    setLimit(PAGE)
    setSelectedId(null)
    setRulesById({})
    // 이걸 비우지 않으면 지역을 갔다 돌아왔을 때 조회를 건너뛰어 카드가 '확인 중'에 멈춘다
    requested.current.clear()
    setPlaces([])
  }, [regnCd, signguCd, q, nearIds])

  /**
   * 목록 — **거르는 일은 서버가 한다.**
   *
   * 예전에는 지역 전체를 받아 브라우저가 걸렀다. 서울은 3,170곳이라 한 번에
   * 1,008KB 였고 화면은 50곳만 그렸다. 지금은 그릴 만큼만 받는다(100건 32KB).
   * 칩에 붙는 숫자도 서버가 세어 보낸다 — 전체를 갖고 있지 않으면 셀 수 없기 때문이다.
   */
  useEffect(() => {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({
      ...(nearIds
        ? { ids: nearIds.join(',') }
        : { regnCd, ...(signguCd ? { signguCd } : {}), ...(q ? { q } : {}) }),
      ...(cat !== ALL ? { cat } : {}),
      ...(sub !== '전체' ? { sub } : {}),
      limit: String(limit),
    })
    fetch(`/api/places?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        setPlaces(d.places ?? [])
        setTotal(d.total ?? 0)
        setCounts(d.counts ?? { all: 0, byCat: {}, bySub: {} })
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [regnCd, signguCd, q, nearIds, cat, sub, limit])

  // 장소를 바꾸면 앞 장소의 정보가 남지 않게 비우고 새로 받는다
  useEffect(() => {
    setDetail(null)
    setCrowd(null)
    setOverviewOpen(false)
    // 다른 장소를 열었는데 앞 장소에서 내려둔 스크롤이 남아 있으면 제목과 판정이 가려진다
    panelBody.current?.scrollTo({ top: 0 })
    if (!selectedId) return
    const p = places.find((x) => x.contentid === selectedId)
    if (!p) return

    let alive = true
    setDetailLoading(true)
    fetch(`/api/detail?contentId=${p.contentid}&contentTypeId=${p.contenttypeid}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        setDetail(d.detail ?? null)
        setCrowd(d.crowd ?? null)
      })
      .catch(() => { if (alive) { setDetail(null); setCrowd(null) } })
      .finally(() => { if (alive) setDetailLoading(false) })
    return () => { alive = false }
  }, [selectedId, places])

  /**
   * 내 주변 — 좌표를 서버로 보내지 않는다.
   *
   * 사용자 위치를 서버로 전송하면 저장 여부와 무관하게 위치기반서비스사업자 신고
   * 대상이 된다(공모전 공지 FAQ). 그래서 좌표만 담긴 색인을 받아 브라우저에서
   * 거리를 재고, 가까운 contentid 만 서버에 되묻는다. 위치는 단말을 떠나지 않는다.
   */
  const RADIUS = 20000
  const coordsRef = useRef<[string, number, number][] | null>(null)

  async function findNearby() {
    setGeoError(null)
    if (!navigator.geolocation) {
      setGeoError('이 브라우저는 위치를 알려주지 못해요')
      return
    }
    setNearBusy(true)
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      )
      if (!coordsRef.current) {
        const d = await fetch('/api/places/coords').then((r) => r.json())
        coordsRef.current = d.coords ?? []
      }
      const { latitude: lat, longitude: lng } = pos.coords
      const near = coordsRef.current!
        .map(([id, x, y]) => [id, distance(lat, lng, y, x)] as const)
        .filter(([, m]) => m <= RADIUS)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 200)

      if (near.length === 0) {
        setGeoError('20km 안에 등록된 곳이 없어요')
        return
      }
      setNearDist(Object.fromEntries(near))
      setNearIds(near.map(([id]) => id))
    } catch {
      setGeoError('위치를 가져오지 못했어요 — 브라우저에서 위치 권한을 허용해주세요')
    } finally {
      setNearBusy(false)
    }
  }

  // ── 필터: 콘텐츠 타입 → 분류체계 세분류 → 표시 개수
  //    거르는 일은 서버가 한다. 여기서는 서버가 준 숫자로 칩만 그린다.
  const catCounts = counts.byCat
  const subCounts = counts.bySub
  /** '갈 만한 곳'의 수 — 쇼핑을 뺀 나머지 */
  const allCount = counts.all

  const cats = useMemo(
    () => [ALL, ...CAT_ORDER.filter((c) => (catCounts[c] ?? 0) > 0)],
    [catCounts]
  )

  // '전체'에서는 세분류가 20종을 넘어 필터 바가 넘친다. 많은 순 상위만 노출한다
  const subs = useMemo(() => {
    // 좁은 화면에서는 세부 줄이 목록을 아래로 밀어낸다. 카테고리를 고른 뒤에만 보여준다
    if (isMobile && cat === ALL) return []
    const keys = Object.keys(subCounts).sort((a, b) => subCounts[b] - subCounts[a])
    return keys.length > 1 ? keys.slice(0, isMobile ? 6 : 10) : []
  }, [subCounts, isMobile, cat])

  /** 지금 고른 카테고리의 개수 — 세부분류를 고르기 전 기준이라 '전체' 칩에 쓴다 */
  const inCatCount = cat === ALL ? allCount : catCounts[cat] ?? 0

  /** 서버가 이미 걸러서 한 페이지만 보냈다 */
  const shown = places

  // ── 동반 조건은 화면에 그려진 것만 조회한다.
  //    목록 전체를 조회하면 서울(3,170곳)에서 일일 한도를 한 번에 넘긴다.
  useEffect(() => {
    const need = shown.map((p) => p.contentid).filter((id) => !requested.current.has(id))
    if (need.length === 0) return
    need.forEach((id) => requested.current.add(id))

    setRulesById((m) => {
      const next = { ...m }
      need.forEach((id) => (next[id] = { state: 'loading' }))
      return next
    })

    const mark = (fn: (id: string) => RulesEntry) =>
      setRulesById((m) => {
        const next = { ...m }
        need.forEach((id) => (next[id] = fn(id)))
        return next
      })

    fetch(`/api/pet-rules?ids=${need.join(',')}`)
      .then((r) => r.json())
      .then((d) => {
        const got: Record<string, any> = d.rules ?? {}
        // 상한을 넘겨 이번에 다루지 못한 것. 조회 기록에서 빼 다음 번에 다시 묻는다 —
        // 실패로 표시하면 새로고침 전까지 영영 '확인 실패'로 남는다
        const skipped: string[] = d.skipped ?? []
        skipped.forEach((id) => requested.current.delete(id))
        const pending = new Set(skipped)
        // 조회 실패와 '조건 정보 미등록'은 다른 상태다. 실패를 미등록으로 뭉개면
        // 화면에 "정보가 없는 장소"로 잘못 표시된다.
        mark((id) =>
          id in got
            ? { state: 'done', rules: got[id] }
            : pending.has(id)
              ? { state: 'loading' }
              : { state: 'failed' }
        )
      })
      .catch(() => {
        need.forEach((id) => requested.current.delete(id))
        mark(() => ({ state: 'failed' }))
      })
  }, [shown])

  // ── 판정
  type Row = Place & { j: Judgement | null; state: CardState | 'no' }

  const rows: Row[] = useMemo(
    () =>
      shown.map((p) => {
        const e = rulesById[p.contentid]
        if (!e || e.state === 'loading') return { ...p, j: null, state: 'loading' as const }
        if (e.state === 'failed') return { ...p, j: null, state: 'failed' as const }
        const j = judge(e.rules, pet)
        return { ...p, j, state: j.status }
      }),
    [shown, rulesById, pet]
  )

  const visible = useMemo(() => rows.filter((r) => r.state !== 'no') as Judged[], [rows])
  const hiddenCount = rows.length - visible.length

  const okCount = visible.filter((p) => p.state === 'ok').length
  const condCount = visible.filter((p) => p.state === 'cond').length
  const failedCount = visible.filter((p) => p.state === 'failed').length

  const sel = visible.find((p) => p.contentid === selectedId) ?? null

  /** 시트 단계별 높이. peek 은 손잡이와 머리글만 남긴다 */
  const SHEET_H = { peek: '86px', half: '46%', full: '88%' } as const
  /** 지도에서 시트에 가려지는 비율 — 핀을 그 위로 올리는 데 쓴다 */
  const mapInset = !isMobile ? 0 : sheet === 'peek' ? 0.14 : 0.5

  const dragStart = (e: React.PointerEvent) => {
    const el = sheetRef.current
    if (!el) return
    // 포인터를 놓친 채 화면 밖으로 나가도 끌기가 이어지게 잡아 둔다.
    // 마우스·펜에서 잡을 수 없는 경우가 있어 실패해도 끌기는 계속한다
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    dragRef.current = { y: e.clientY, h: el.clientHeight }
    setSheetPx(el.clientHeight)
  }
  const dragMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    const el = sheetRef.current
    if (!d || !el) return
    const max = (el.parentElement?.clientHeight ?? 0) * 0.92
    setSheetPx(Math.max(72, Math.min(max, d.h - (e.clientY - d.y))))
  }
  const dragEnd = () => {
    const el = sheetRef.current
    if (!dragRef.current || !el || sheetPx === null) return
    dragRef.current = null
    // 놓은 높이에서 가장 가까운 단계로 붙인다
    const r = sheetPx / (el.parentElement?.clientHeight || 1)
    setSheet(r < 0.28 ? 'peek' : r < 0.66 ? 'half' : 'full')
    setSheetPx(null)
  }

  /** 상세 패널에서 원본 조건이 필요할 때 — 조회가 끝난 경우에만 있다 */
  const rules = (p: Judged) => {
    const e = rulesById[p.contentid]
    return e && e.state === 'done' ? e.rules : null
  }
  const region = regions.find((r) => r.code === regnCd)

  /**
   * 프로필 전환 버튼.
   * 넓은 화면에서는 상단 바 오른쪽 끝에, 좁은 화면에서는 지도 오른쪽 위에 올린다 —
   * 상단 바에 두면 검색·지역과 세 줄을 이뤄 지도가 그만큼 밀린다.
   */
  const petSwitch = (compact: boolean) => (
    <PetSwitch
      pet={petStore.pet}
      pets={petStore.pets}
      list={petStore.list}
      activeKey={petStore.activeKey}
      onlySamples={petStore.onlySamples}
      onSelect={(k) => { petStore.select(k); setSelectedId(null) }}
      onAdd={(v) => { petStore.add(v); setSelectedId(null) }}
      onUpdate={(k, v) => { petStore.update(k, v); setSelectedId(null) }}
      onRemove={petStore.remove}
      compact={compact}
    />
  )

  /** 종류 칩 하나. 필터 바(넓은 화면)와 필터 시트(좁은 화면)가 같이 쓴다 */
  const catChip = (label: string, count: number) => {
    const on = label === cat
    return (
      <button key={label} className="hov-accent"
        onClick={() => { setCat(label); setSub('전체'); setLimit(PAGE); setSelectedId(null) }}
        style={{ flex: 'none', fontFamily: 'inherit', fontSize: 14.5, fontWeight: on ? 700 : 500, padding: '8px 16px', borderRadius: 99, border: `1.5px solid ${on ? '#2B2420' : '#E3DCCE'}`, background: on ? '#2B2420' : '#FFFFFF', color: on ? '#FFFFFF' : '#6E5F4D', cursor: 'pointer' }}>
        {label} <span style={{ opacity: .65, fontWeight: 500 }}>{count.toLocaleString()}</span>
      </button>
    )
  }

  /** 좁은 화면에서 '내 주변'은 지도 위에 둔다 — 지도앱들이 현위치 버튼을 두는 자리다 */
  const nearbyButton = (
    <button className="hov-accent" disabled={nearBusy}
      onClick={() => (nearIds ? setNearIds(null) : findNearby())}
      title={nearIds ? '지역으로 돌아가기' : '현재 위치 20km 안에서 찾기 — 위치는 이 기기 밖으로 나가지 않아요'}
      style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12.5, fontWeight: nearIds ? 700 : 500, padding: '7px 12px', borderRadius: 99, border: `1.5px solid ${nearIds ? '#E85D3D' : '#EAE3D6'}`, background: 'rgba(255,255,255,.96)', color: nearIds ? '#E85D3D' : '#6E5F4D', cursor: nearBusy ? 'default' : 'pointer', boxShadow: '0 3px 12px rgba(43,36,32,.16)', whiteSpace: 'nowrap' }}>
      🧭 {nearBusy ? '확인 중…' : nearIds ? '해제' : '내 주변'}
    </button>
  )

  /**
   * 결과 목록.
   * 넓은 화면에서는 지도 왼쪽에 세우고, 좁은 화면에서는 지도 위 시트에 넣는다 — 내용은 같다.
   */
  const listPanel = (
    <>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: isMobile ? '0 16px 6px' : '14px 16px 8px' }}>
      <span style={{ fontSize: 14, fontWeight: 700 }}>
        {pet.name}가 갈 수 있는 곳 <span style={{ color: '#E85D3D' }}>{visible.length}</span>
      </span>
      <span style={{ fontSize: 12, color: '#B3A78F' }}>
        {isMobile ? `${total.toLocaleString()}곳 중` : '이름 순'}
      </span>
    </div>

    {/* 좁은 화면에서는 지도 위에 범례를 놓을 자리가 없다 — 목록 머리에 붙인다 */}
    {isMobile && (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 11, padding: '0 16px 8px', fontSize: 11.5, color: '#6E5F4D' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#2F8F4E' }} />입장 가능 {okCount}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#C98A12' }} />조건부 {condCount}</span>
        {hiddenCount > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#B3A78F' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#D8D0C0' }} />불가 {hiddenCount} 숨김</span>
        )}
        {q && <b style={{ color: '#E85D3D' }}>전국 검색</b>}
        {nearIds && <b style={{ color: '#E85D3D' }}>내 주변 20km</b>}
        {/* 필터 바가 없는 화면이라 조회 실패는 여기서 알린다 */}
        {failedCount > 0 && (
          <span style={{ width: '100%', fontWeight: 700, color: '#C0392B' }}>
            ! 조건을 불러오지 못한 곳 {failedCount}개 — 새로고침하면 다시 시도해요
          </span>
        )}
      </div>
    )}

    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {loading && <div style={{ padding: 20, fontSize: 13, color: '#A08872', textAlign: 'center' }}>불러오는 중…</div>}
      {!loading && error && <div style={{ padding: 16, fontSize: 12.5, color: '#C0392B', lineHeight: 1.5 }}>{error}</div>}
      {!loading && !error && visible.length === 0 && (
        <div style={{ padding: 20, fontSize: 13, color: '#A08872', textAlign: 'center', lineHeight: 1.6 }}>
          이 조건에 맞는<br />동반 가능 장소가 없어요
        </div>
      )}

      {visible.map((p) => {
        const b = BADGE[p.state]
        const on = p.contentid === selectedId
        const condCheck = p.j?.checks.find((c) => c.icon === '!')
        return (
          <div key={p.contentid} className="hov-card"
            onClick={() => { setSelectedId(p.contentid); if (isMobile) setSheet('peek') }}
            style={{ border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF6F2' : '#FFFFFF', borderRadius: 14, padding: '11px 13px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 99, border: `1.5px solid ${b.border}`, color: b.color, background: b.bg, whiteSpace: 'nowrap' }}>{b.text}</span>
            </div>
            <div style={{ fontSize: 12, color: '#A08872' }}>
              {p.cat} · {p.addr1.split(' ').slice(1, 3).join(' ')}
              {nearDist[p.contentid] !== undefined && (
                <span style={{ color: '#E85D3D', fontWeight: 700 }}>
                  {' · '}{nearDist[p.contentid] < 1000
                    ? `${Math.round(nearDist[p.contentid])}m`
                    : `${(nearDist[p.contentid] / 1000).toFixed(1)}km`}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: p.j ? (condCheck ? '#8A6208' : '#2F8F4E') : '#A08872' }}>
              {p.j ? (condCheck ? condCheck.text : p.j.checks[0]?.text) : b.text}
            </div>
          </div>
        )
      })}

      {!loading && !error && shown.length < total && (
        <button className="hov-accent" onClick={() => setLimit((n) => n + PAGE)}
          style={{ fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '11px 0', marginTop: 4, borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
          {PAGE}곳 더 보기 <span style={{ fontWeight: 500, color: '#B3A78F' }}>({total - shown.length} 남음)</span>
        </button>
      )}

      {isMobile && (
        <p style={{ margin: '14px 4px 0', fontSize: 11.5, color: '#B3A78F' }}>출처 ⓒ한국관광공사</p>
      )}
    </div>
    </>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: isMobile ? 0 : 1100, overflow: 'hidden' }}>
      {/* ── 상단 바 */}
      {/* 좁은 화면에서는 지역·종류·검색을 요약한 바 한 줄. 누르면 시트에서 고른다 */}
      {isMobile ? (
        <div style={{ padding: '8px 12px', background: '#FFFFFF', borderBottom: '1px solid #EAE3D6', flex: 'none', display: 'flex', gap: 8 }}>
          <button className="hov-accent" onClick={() => setFilterOpen(true)}
            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: '#F6F1E7', border: '1.5px solid #EAE3D6', borderRadius: 14, padding: '13px 15px', fontFamily: 'inherit', fontSize: 15.5, color: '#2B2420', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ flex: 'none', fontSize: 17 }}>🔎</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nearIds ? <b style={{ color: '#E85D3D' }}>내 주변 20km</b> : region?.name ?? '지역'}
              {!nearIds && signguCd && ` · ${region?.sigungu.find((x) => x.code === signguCd)?.name ?? ''}`}
              {cat !== ALL && ` · ${cat}`}
              {q && <span style={{ color: '#E85D3D', fontWeight: 700 }}> · “{q}”</span>}
            </span>
          </button>
          {/* 조건을 되돌리는 버튼. 기본 상태에서는 누를 게 없으니 숨긴다 */}
          {(cat !== ALL || signguCd || q || nearIds) && (
            <button onClick={() => { setCat(ALL); setSub('전체'); setSignguCd(''); setQ(''); setNearIds(null); setLimit(PAGE); setSelectedId(null) }}
              aria-label="조건 지우기"
              style={{ flex: 'none', fontFamily: 'inherit', fontSize: 16, padding: '13px 16px', borderRadius: 14, border: '1.5px solid #EAE3D6', background: '#FFFFFF', color: '#A08872', cursor: 'pointer' }}>
              ✕
            </button>
          )}
        </div>
      ) : (
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', background: '#FFFFFF', borderBottom: '1px solid #EAE3D6', flex: 'none' }}>
        <div className="hov-accent" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F6F1E7', border: '1.5px solid #EAE3D6', borderRadius: 13, padding: '9px 14px' }}>
          <span style={{ fontSize: 16 }}>📍</span>
          <select value={regnCd} onChange={(e) => { setRegnCd(e.target.value); setSignguCd('') }}
            style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 15.5, color: '#2B2420', cursor: 'pointer', outline: 'none' }}>
            {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
          <select value={signguCd} onChange={(e) => setSignguCd(e.target.value)}
            style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 15.5, color: '#6E5F4D', cursor: 'pointer', outline: 'none' }}>
            <option value="">전체</option>
            {region?.sigungu.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        {/* 검색 — 전국 목록 위에서 이름·주소로 찾는다 */}
        <div className="hov-accent" style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#F6F1E7', border: '1.5px solid #EAE3D6', borderRadius: 13, padding: '9px 14px', minWidth: 230 }}>
          <span style={{ fontSize: 16 }}>🔎</span>
          <input value={q} placeholder="장소 이름으로 찾기"
            onChange={(e) => { setQ(e.target.value); setNearIds(null) }}
            style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 15.5, color: '#2B2420', outline: 'none', width: '100%' }} />
          {q && (
            <button onClick={() => setQ('')} title="검색어 지우기"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#A08872', fontSize: 15, lineHeight: 1, padding: 0 }}>✕</button>
          )}
        </div>

        <button className="hov-accent" disabled={nearBusy}
          onClick={() => (nearIds ? setNearIds(null) : findNearby())}
          title={nearIds ? '지역으로 돌아가기' : '현재 위치 20km 안에서 찾기 — 위치는 이 기기 밖으로 나가지 않아요'}
          style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: nearIds ? 700 : 500, padding: '10px 16px', borderRadius: 13, border: `1.5px solid ${nearIds ? '#E85D3D' : '#EAE3D6'}`, background: nearIds ? '#FFF4EF' : '#F6F1E7', color: nearIds ? '#E85D3D' : '#6E5F4D', cursor: nearBusy ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
          🧭 {nearBusy ? '위치 확인 중…' : nearIds ? '내 주변 해제' : '내 주변'}
        </button>

        {geoError && (
          <span style={{ fontSize: 12, color: '#C0392B', maxWidth: 220, lineHeight: 1.35 }}>{geoError}</span>
        )}

        <div style={{ flex: 1 }} />
        {petSwitch(false)}
      </header>
      )}

      {/* ── 필터 바 (넓은 화면 전용) */}
      {!isMobile && (
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #EAE3D6', flex: 'none' }}>
        <div className="chip-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '7px 12px 0' : '10px 20px 0', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {cats.map((label) => catChip(label, label === ALL ? allCount : catCounts[label]))}
          {/* 쇼핑은 개별 상점이라 수가 압도적이다. 구분선 뒤로 물려 따로 볼 수 있게만 둔다 */}
          {(catCounts[ASIDE_CAT] ?? 0) > 0 && (
            <>
              <span style={{ flex: 'none', width: 1, height: 18, background: '#EAE3D6', margin: '0 2px' }} />
              {catChip(ASIDE_CAT, catCounts[ASIDE_CAT])}
            </>
          )}
          <div style={{ flex: 1 }} />
          {failedCount > 0 && (
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#C0392B' }}>
              ! 조건 정보를 불러오지 못한 곳 {failedCount}개 — 새로고침하면 다시 시도해요
            </span>
          )}
        </div>

        {/* 세분류 — 쇼핑처럼 한 타입에 수천 곳이 몰릴 때 좁혀 보기 위한 2차 필터 */}
        {(!isMobile || subs.length > 0) && (
        <div className="chip-row" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '5px 12px 7px' : '8px 20px 10px', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: 'nowrap' }}>
          {subs.length > 0 && (
            <>
              <span style={{ fontSize: 12, color: '#B3A78F', marginRight: 2 }}>세부</span>
              {['전체', ...subs].map((code) => {
                const on = code === sub
                const label = code === '전체' ? '전체' : (catNames[code] ?? code)
                const n = code === '전체' ? inCatCount : subCounts[code]
                return (
                  <button key={code} className="hov-accent"
                    onClick={() => { setSub(code); setLimit(PAGE); setSelectedId(null) }}
                    style={{ flex: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 500, padding: '4px 11px', borderRadius: 99, border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF4EF' : '#FFFFFF', color: on ? '#E85D3D' : '#8A7A65', cursor: 'pointer' }}>
                    {label} <span style={{ opacity: .6, fontWeight: 500 }}>{n}</span>
                  </button>
                )
              })}
            </>
          )}
          {!isMobile && <div style={{ flex: 1 }} />}
          <span style={{ fontSize: 12.5, color: '#B3A78F', flex: 'none', paddingLeft: isMobile ? 4 : 0 }}>
            {q && <b style={{ color: '#E85D3D' }}>전국 검색 · </b>}
            {nearIds && <b style={{ color: '#E85D3D' }}>내 주변 20km · </b>}
            {total}곳 중 {shown.length}곳 확인함
            {hiddenCount > 0 && ` · 동반 불가 ${hiddenCount}곳 숨김`}
          </span>
        </div>
        )}
      </div>
      )}

      {/* ── 필터 시트 (좁은 화면) — 지역·종류·검색을 한 화면에서 고른다 */}
      {isMobile && filterOpen && (
        <div onClick={() => setFilterOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(43,36,32,.38)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: '#FFFFFF', borderRadius: '20px 20px 0 0', maxHeight: '86%', display: 'flex', flexDirection: 'column', animation: 'sheetup .22s ease-out' }}>
            <div style={{ flex: 'none', padding: '9px 0 4px', display: 'flex', justifyContent: 'center' }}>
              <span style={{ width: 38, height: 4, borderRadius: 99, background: '#DCD3C2' }} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 16px 4px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <section style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>어디서 찾을까요?</h2>
                <div className="chip-row" style={{ display: 'flex', gap: 7, overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: 2 }}>
                  {regions.map((r) => {
                    const on = r.code === regnCd && !nearIds
                    return (
                      <button key={r.code} className="hov-accent"
                        ref={on ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'center' }) : undefined}
                        onClick={() => { setRegnCd(r.code); setSignguCd(''); setNearIds(null) }}
                        style={{ flex: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: on ? 700 : 500, padding: '6px 13px', borderRadius: 99, border: `1.5px solid ${on ? '#2B2420' : '#E3DCCE'}`, background: on ? '#2B2420' : '#FFFFFF', color: on ? '#FFFFFF' : '#6E5F4D', cursor: 'pointer' }}>
                        {r.name}
                      </button>
                    )
                  })}
                </div>
                {region && region.sigungu.length > 0 && (
                  <div className="chip-row" style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap', paddingTop: 2 }}>
                    <span style={{ flex: 'none', fontSize: 12, color: '#B3A78F', marginRight: 2 }}>{region.name} 안에서</span>
                    {[{ code: '', name: '전체' }, ...region.sigungu].map((sg) => {
                      const on = sg.code === signguCd
                      return (
                        <button key={sg.code || 'all'} className="hov-accent" onClick={() => setSignguCd(sg.code)}
                          ref={on && sg.code ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'center' }) : undefined}
                          style={{ flex: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 500, padding: '4px 11px', borderRadius: 99, border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF4EF' : '#FFFFFF', color: on ? '#E85D3D' : '#8A7A65', cursor: 'pointer' }}>
                          {sg.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                <div style={{ paddingTop: 2 }}>{nearbyButton}</div>
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>어떤 곳을 찾으세요?</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {cats.map((label) => catChip(label, label === ALL ? allCount : catCounts[label]))}
                </div>
                {(catCounts[ASIDE_CAT] ?? 0) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7 }}>
                    {catChip(ASIDE_CAT, catCounts[ASIDE_CAT])}
                    <span style={{ fontSize: 11.5, color: '#B3A78F' }}>백화점·거리 상점이라 따로 두었어요</span>
                  </div>
                )}
                {subs.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 2 }}>
                    <span style={{ alignSelf: 'center', fontSize: 12, color: '#B3A78F', marginRight: 2 }}>세부</span>
                    {['전체', ...subs].map((code) => {
                      const on = code === sub
                      return (
                        <button key={code} className="hov-accent"
                          onClick={() => { setSub(code); setLimit(PAGE); setSelectedId(null) }}
                          style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 500, padding: '4px 11px', borderRadius: 99, border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF4EF' : '#FFFFFF', color: on ? '#E85D3D' : '#8A7A65', cursor: 'pointer' }}>
                          {code === '전체' ? '전체' : (catNames[code] ?? code)} <span style={{ opacity: .6, fontWeight: 500 }}>{code === '전체' ? inCatCount : subCounts[code]}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>이름으로 찾기</h2>
                <div className="hov-accent" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F6F1E7', border: '1.5px solid #EAE3D6', borderRadius: 12, padding: '9px 13px' }}>
                  <span>🔎</span>
                  <input value={q} placeholder="장소 이름으로 찾기" autoFocus={!!q}
                    onChange={(e) => { setQ(e.target.value); setNearIds(null) }}
                    style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 14.5, color: '#2B2420', outline: 'none', width: '100%' }} />
                  {q && (
                    <button onClick={() => setQ('')} aria-label="검색어 지우기"
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#A08872', fontSize: 15, lineHeight: 1, padding: 0 }}>✕</button>
                  )}
                </div>
                <span style={{ fontSize: 11.5, color: '#B3A78F' }}>이름으로 찾을 때는 지역을 넘어 전국에서 찾아요</span>
              </section>
            </div>

            {/* 결과 수를 버튼에 적어 둔다 — 닫기 전에 몇 곳이 남았는지 보인다 */}
            <div style={{ flex: 'none', padding: '10px 16px calc(14px + env(safe-area-inset-bottom))', borderTop: '1px solid #F1EBE0' }}>
              <button className="btn-primary" onClick={() => setFilterOpen(false)}
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, padding: '13px 0', borderRadius: 14, border: 'none', background: '#E85D3D', color: '#FFFFFF', cursor: 'pointer' }}>
                {loading ? '불러오는 중…' : `${total.toLocaleString()}곳 보기`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 본문 */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 좌측 결과 리스트 — 넓은 화면에서만 지도 옆에 선다 */}
        {!isMobile && (
          <aside style={{ width: 312, flex: 'none', background: '#FFFFFF', borderRight: '1px solid #EAE3D6', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {listPanel}
          </aside>
        )}

        {/* 지도 영역 */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#EFEAE0' }}>
          <KakaoMap places={visible} selectedId={selectedId} onSelect={setSelectedId} bottomInset={mapInset} narrow={isMobile} />

          {/* 범례 — 좁은 화면에서는 시트가 아래를 덮으므로 목록 머리에 옮겨 두었다 */}
          {!isMobile && (
          <div style={{ position: 'absolute', right: 16, bottom: 16, background: 'rgba(255,255,255,.94)', border: '1px solid #EAE3D6', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 5, boxShadow: '0 4px 14px rgba(43,36,32,.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#2F8F4E' }} />입장 가능 {okCount}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#C98A12' }} />조건부 가능 {condCount}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#B3A78F' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#D8D0C0' }} />불가 {hiddenCount} (숨김)</div>
            {visible.some((p) => p.state === 'loading') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#A08872' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#B3A78F' }} />조건 확인 중 {visible.filter((p) => p.state === 'loading').length}</div>
            )}
          </div>
          )}

          {!isMobile && (
          <div style={{ position: 'absolute', left: 16, top: 14, background: 'rgba(255,255,255,.94)', border: '1px solid #EAE3D6', borderRadius: 99, padding: '6px 14px', fontSize: 12.5, color: '#6E5F4D' }}>
            {pet.emoji} <b>{pet.name}</b> 기준으로 판정된 지도예요 · 출처 ⓒ한국관광공사
          </div>
          )}

          {/* 좁은 화면 — 프로필은 지도 오른쪽 위로. 상단 바를 한 줄 덜 쓰게 된다 */}
          {isMobile && (
            <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
              {petSwitch(true)}
              {nearbyButton}
            </div>
          )}

          {/* 좁은 화면 — 목록을 지도 위 시트로 덮는다. 손잡이를 끌어 높이를 바꾼다 */}
          {isMobile && (
            <div ref={sheetRef}
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
                height: sheetPx !== null ? sheetPx : SHEET_H[sheet],
                background: '#FFFFFF', borderTop: '1px solid #EAE3D6',
                borderRadius: '18px 18px 0 0', boxShadow: '0 -6px 24px rgba(43,36,32,.14)',
                display: 'flex', flexDirection: 'column', minHeight: 0,
                transition: sheetPx !== null ? 'none' : 'height .24s ease-out',
              }}>
              {/* touchAction: none — 이걸 두지 않으면 브라우저가 스크롤로 가로채 손잡이가 안 끌린다 */}
              <div onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd}
                onClick={() => setSheet(sheet === 'full' ? 'peek' : sheet === 'half' ? 'full' : 'half')}
                title="끌어서 높이 조절"
                style={{ flex: 'none', padding: '9px 0 7px', display: 'flex', justifyContent: 'center', cursor: 'grab', touchAction: 'none' }}>
                <span style={{ width: 38, height: 4, borderRadius: 99, background: '#DCD3C2' }} />
              </div>
              {listPanel}
            </div>
          )}

          {/* 상세 패널 */}
          {sel && (() => {
            const b = BADGE[sel.state]
            return (
              <div style={isMobile
                ? { position: 'absolute', inset: 0, background: '#FFFFFF', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 30 }
                : { position: 'absolute', left: 14, top: 56, bottom: 14, width: 330, background: '#FFFFFF', border: '1px solid #EAE3D6', borderRadius: 18, boxShadow: '0 10px 34px rgba(43,36,32,.16)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slidein .22s ease-out', zIndex: 30 }}>
                {(() => {
                  // 대표 사진이 없는 곳이 많다(숙박 32%·음식점 58%만 보유). detailImage2 로 메운다
                  const hero = sel.firstimage || detail?.images[0]?.url || ''
                  return (
                    <div style={{ height: 96, background: hero ? `center/cover url(${hero})` : 'linear-gradient(135deg,#FFE0D3,#FFF4EF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, position: 'relative' }}>
                      {!hero && (CAT_EMOJI[sel.cat] ?? '📍')}
                      <button onClick={() => { setSelectedId(null); if (isMobile) setSheet('half') }}
                        style={{ position: 'absolute', right: 10, top: 10, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.85)', cursor: 'pointer', fontSize: 14, color: '#6E5F4D' }}>✕</button>
                    </div>
                  )
                })()}

                {/* overflowAnchor: 상세 정보가 뒤늦게 채워질 때 브라우저가 스크롤을 밀어
                    제목·판정이 화면 밖으로 나가는 것을 막는다 */}
                <div ref={panelBody} style={{ flex: 1, overflowY: 'auto', overflowAnchor: 'none', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="jua" style={{ fontSize: 21 }}>{sel.title}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '3px 11px', borderRadius: 99, border: `1.5px solid ${b.border}`, color: b.color, background: b.bg, whiteSpace: 'nowrap' }}>{b.text}</span>
                  </div>

                  <div style={{ fontSize: 12.5, color: '#A08872' }}>{sel.cat} · {sel.addr1}</div>

                  {/* 오늘 휴무 — 동반 가능해도 문이 닫혀 있으면 똑같이 헛걸음이다.
                      '오늘 쉰다'가 확실할 때만 알리고, 규칙을 못 읽으면 원문을 그대로 보여준다 */}
                  {(() => {
                    if (!detail) return null
                    const st = restStatus(detail.restdate)
                    if (st.kind === 'closed') {
                      return (
                        <div style={{ border: '1.5px solid #E0A9A0', background: '#FBEDEA', borderRadius: 12, padding: '10px 13px', fontSize: 13, fontWeight: 700, color: '#C0392B' }}>
                          🔴 오늘({todayLabel()}) 휴무 — {st.label}
                        </div>
                      )
                    }
                    // 요일은 쉬는 날이지만 "단, 공휴일이면 개관" 같은 예외가 붙은 경우.
                    // 단정하면 열린 곳을 막게 되므로 원문을 함께 보여주고 확인을 권한다
                    if (st.kind === 'maybe') {
                      return (
                        <div style={{ border: '1.5px solid #F0D9A0', background: '#FBF3DD', borderRadius: 12, padding: '10px 13px', fontSize: 12.5, color: '#8A6208', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <b style={{ fontSize: 13 }}>🟡 오늘({todayLabel()}) 휴무일 수 있어요 — {st.label}</b>
                          <span>{st.note}</span>
                          <span style={{ color: '#A08872' }}>예외 규정이 있어 방문 전 확인을 권해요</span>
                        </div>
                      )
                    }
                    if (!detail.usetime && !detail.restdate) return null
                    return (
                      <div style={{ border: '1.5px solid #EFE8DA', background: '#FAF8F3', borderRadius: 12, padding: '10px 13px', fontSize: 12.5, color: '#6E5F4D', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {detail.usetime && <div>🕘 {detail.usetime}</div>}
                        {detail.restdate && (
                          <div style={{ color: st.kind === 'always' ? '#2F8F4E' : '#8A6208' }}>
                            📅 {detail.restdate}
                          </div>
                        )}
                        {detail.parking && <div>🅿️ 주차 {detail.parking}</div>}
                      </div>
                    )
                  })()}

                  <div style={{ border: `1.5px solid ${b.border}`, background: b.checkBg, borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>입장 조건 체크리스트 — {pet.name} 기준</span>
                    {(sel.j?.checks ?? [{ icon: '!' as const, color: '#A08872', text: b.text }]).map((ck, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700, color: ck.color }}>{ck.icon}</span>
                        <span>{ck.text}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1.5px dashed #E3D9C6', paddingTop: 7, fontSize: 11.5, color: '#A08872' }}>
                      조건 정보 충실도 {rules(sel)?.completeness ?? '—'}등급 · 출처 ⓒ한국관광공사
                    </div>
                  </div>

                  {rules(sel) && rules(sel)!.notes.length > 0 && (
                    <div style={{ border: '1.5px solid #F0D9A0', background: '#FBF3DD', borderRadius: 12, padding: '10px 13px', fontSize: 12.5, color: '#8A6208', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <b>현장 규정</b>
                      {rules(sel)!.notes.map((n, i) => <div key={i}>• {n}</div>)}
                    </div>
                  )}

                  {/* 언제 가면 좋을까 — 붐비는 곳은 리드줄이 엉키고 아이가 스트레스를 받는다.
                      숫자는 그 장소가 가장 붐빌 때를 100 으로 본 상대값이라, 다른 장소와
                      견주면 안 된다. 같은 장소의 날짜끼리만 비교할 수 있다 */}
                  {(() => {
                    if (!crowd) return null
                    const hint = crowdHint(crowd)
                    if (!hint) return null
                    const BAR = { quiet: '#2F8F4E', normal: '#C98A12', busy: '#C0392B' } as const
                    return (
                      <section style={{ border: '1.5px solid #EFE8DA', background: '#FAF8F3', borderRadius: 12, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                        <b style={{ fontSize: 13 }}>언제 가면 좋을까</b>

                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56 }}>
                          {hint.days.map((d) => {
                            const lv = crowdLevel(d.rate)
                            const on = d.ymd === hint.best.ymd
                            return (
                              <div key={d.ymd} title={`${d.ymd.slice(4, 6)}.${d.ymd.slice(6)} · 집중률 ${d.rate}`}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: '100%', height: 40, display: 'flex', alignItems: 'flex-end' }}>
                                  <div style={{
                                    width: '100%',
                                    // 상한을 100 으로 고정한다. 구간 최댓값에 맞추면
                                    // 전부 한산한 주에도 하나가 '붐빔'처럼 보인다
                                    height: `${Math.max(6, Math.min(100, d.rate))}%`,
                                    background: BAR[lv],
                                    opacity: on ? 1 : 0.42,
                                    borderRadius: 3,
                                  }} />
                                </div>
                                <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, color: on ? '#2F8F4E' : '#A08872' }}>
                                  {dowOf(d.ymd)}
                                </span>
                              </div>
                            )
                          })}
                        </div>

                        <div style={{ fontSize: 12.5, color: '#5C5347' }}>
                          <b style={{ color: '#2F8F4E' }}>{dowOf(hint.best.ymd)}요일</b>이 가장 한산해요
                          <span style={{ color: '#A08872' }}> · {dowOf(hint.worst.ymd)}요일이 가장 붐벼요</span>
                        </div>

                        <div style={{ borderTop: '1.5px dashed #E3D9C6', paddingTop: 7, fontSize: 11, color: '#A08872', lineHeight: 1.5 }}>
                          이동통신 데이터로 추정한 예측값이에요. 이 장소가 가장 붐빌 때를 100으로 본
                          상대적인 정도라, 다른 장소와 비교하는 숫자는 아니에요 · 출처 ⓒ한국관광공사
                        </div>
                      </section>
                    )
                  })()}

                  {detailLoading && (
                    <div style={{ fontSize: 12.5, color: '#B3A78F' }}>장소 정보를 불러오는 중…</div>
                  )}

                  {/* 입장료·시설 — 있는 곳만 (관광지 100%, 나머지 41~66%) */}
                  {detail && detail.extras.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 7, fontSize: 12.5, alignItems: 'baseline' }}>
                      {detail.extras.slice(0, 4).map((x, i) => (
                        <Fragment key={i}>
                          <span style={{ color: '#A08872', whiteSpace: 'nowrap' }}>{x.name}</span>
                          <span style={{ whiteSpace: 'pre-line', color: '#2B2420' }}>{x.text}</span>
                        </Fragment>
                      ))}
                    </div>
                  )}

                  {/* 소개글 — 사람이 쓴 문장이라 손대지 않고 그대로 보여준다.
                      판정·현장 규정 같은 '결정에 쓰는' 블록과 구분되게 테두리 대신
                      작은 표제와 가는 선으로 묶는다. 길면 접어 두고 펼치게 한다 */}
                  {detail?.overview && (() => {
                    const LIMIT = 200
                    const long = detail.overview.length > LIMIT
                    // 문장 중간에서 끊지 않는다 — 마지막 마침표까지만 보여준다
                    const cut = () => {
                      const head = detail.overview.slice(0, LIMIT)
                      const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('.\n'), head.lastIndexOf('다.'))
                      return (end > LIMIT * 0.5 ? head.slice(0, end + 1) : head.replace(/[\s,·]+$/, '') + '…')
                    }
                    const shown = !long || overviewOpen ? detail.overview : cut()
                    return (
                      <section style={{ borderTop: '1px solid #EFE8DA', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', color: '#B3A78F' }}>
                          이런 곳이에요
                        </span>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: '#5C5347', whiteSpace: 'pre-line', wordBreak: 'keep-all' }}>
                          {shown}
                        </p>
                        {long && (
                          <button onClick={() => setOverviewOpen((v) => !v)}
                            style={{ alignSelf: 'flex-start', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#E85D3D', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            {overviewOpen ? '접기' : '더 보기'}
                          </button>
                        )}
                      </section>
                    )
                  })()}

                  {/* 사진이 더 있으면 — Type3 은 변경 금지라 자르거나 덧씌우지 않는다 */}
                  {detail && detail.images.length > 1 && (
                    <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                      {detail.images.slice(0, 6).map((im) => (
                        <img key={im.url} src={im.url} alt="" loading="lazy"
                          style={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 8, flex: 'none' }} />
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 'auto', paddingTop: 4 }}>
                    <a className="btn-primary" href={`https://map.kakao.com/link/to/${encodeURIComponent(sel.title)},${sel.mapy},${sel.mapx}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 14.5, fontWeight: 700, padding: '12px 0', borderRadius: 12, border: 'none', background: '#E85D3D', color: '#FFFFFF', textAlign: 'center', textDecoration: 'none' }}>
                      길찾기
                    </a>

                    {detail?.homepage && (
                      <a className="hov-accent" href={detail.homepage} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', textDecoration: 'none' }}>
                        <span style={{ fontSize: 13, flex: 'none', color: '#A08872' }}>🔗</span>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#2B2420' }}>공식 홈페이지</span>
                      </a>
                    )}

                    {detailLoading ? (
                      <span style={{ fontSize: 12.5, color: '#B3A78F', textAlign: 'center' }}>연락처 확인 중…</span>
                    ) : !detail || detail.tels.length === 0 ? (
                      <span style={{ fontSize: 12.5, color: '#B3A78F', textAlign: 'center' }}>등록된 전화번호가 없어요</span>
                    ) : (
                      detail.tels.slice(0, 3).map((t) => {
                        const { label, num } = splitTel(t)
                        return (
                          <a key={t} className="hov-accent" href={`tel:${num.replace(/[^0-9+]/g, '')}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', textDecoration: 'none' }}>
                            <span style={{ fontSize: 13, flex: 'none', color: '#A08872' }}>☎</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#2B2420', whiteSpace: 'nowrap' }}>
                              {num}
                            </span>
                            {label && (
                              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#A08872', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {label}
                              </span>
                            )}
                          </a>
                        )
                      })
                    )}
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
