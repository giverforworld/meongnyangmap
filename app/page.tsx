'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { judge, sizeOf } from '@/lib/petTour'
import type { CardState, Judgement, Place, RulesEntry } from '@/lib/types'
import { usePetsContext } from './PetsProvider'
import { useIsMobile } from '@/lib/useIsMobile'
import { distance } from '@/lib/geo'
import KakaoMap from './KakaoMap'
import PetFace from './PetFace'
import { PawPinIcon, SearchIcon } from './icons'
import { BADGE, CAT_EMOJI, describeRules } from './placeUi'
import RuleChips from './RuleChips'
import { recentChange, shortDate } from '@/lib/ruleText'
import PlaceDetail from './PlaceDetail'

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
const ALL = '추천 장소'

/** 한 번에 그리는 카드 수. 서버가 이만큼만 보내고, 이 수만큼만 동반 조건을 조회한다 */
const PAGE = 100

interface Region {
  code: string
  name: string
  sigungu: { code: string; name: string }[]
}

type Judged = Place & { j: Judgement | null; state: CardState }

/** 좁은 화면 목록 시트의 단계 — 아래에서 위 순서 */
type SheetStage = 'peek' | 'half' | 'tall' | 'full'
const STAGES: SheetStage[] = ['peek', 'half', 'tall', 'full']

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
  /** 이 장소의 향후 30일 혼잡 예측. 매칭된 곳에만 있다 */
  /** 소개글은 길어서 접어 둔다 — 판정과 현장 규정이 먼저 보여야 한다 */
  /** 검색어와 '내 주변' — 셋 다 같은 전국 목록 위에서 걸러낸다 */
  const [q, setQ] = useState('')
  /** 현재 위치로 고른 contentid 목록. 좌표 자체는 서버로 보내지 않는다 */
  const [nearIds, setNearIds] = useState<string[] | null>(null)
  /** contentid → 내 위치에서의 거리(m). 브라우저가 계산한 값이다 */
  const [nearDist, setNearDist] = useState<Record<string, number>>({})
  const [nearBusy, setNearBusy] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const petStore = usePetsContext()
  const [cat, setCat] = useState(ALL)
  const [sub, setSub] = useState('전체')
  const [limit, setLimit] = useState(PAGE)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  /** 동반 조건 — 화면에 그려진 장소만 채워진다 */
  const [rulesById, setRulesById] = useState<Record<string, RulesEntry>>({})
  /** 이미 조회를 건 contentid. 같은 장소를 두 번 부르지 않기 위한 것 */
  const requested = useRef(new Set<string>())
  /** 분류체계 코드 → 이름 */
  const [catNames, setCatNames] = useState<Record<string, string>>({})

  const isMobile = useIsMobile()
  /**
   * 좁은 화면 — 지도를 깔고 그 위를 목록 시트가 덮는다.
   * 목록과 지도를 탭으로 갈라 두면 "이게 어디쯤이지"를 확인할 때마다 화면을 갈아타야 한다.
   * 지도앱들이 시트를 쓰는 이유가 그것이라, 높이를 세 단계로 끊어 같은 방식을 따른다.
   */
  const [sheet, setSheet] = useState<SheetStage>('half')
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
  /** 로그인돼 있으면 리뷰 닉네임을 미리 채운다 */
  const sessionNick = ((petStore.session?.user.user_metadata?.nickname as string) || (petStore.session?.user.user_metadata?.name as string) || '').slice(0, 20)

  /**
   * ?focus=contentid — 커뮤니티 글의 "지도에서 보기"로 들어올 때.
   * 그 장소의 지역을 고르고 이름으로 검색해 목록에 올린 뒤, 목록이 도착하면 연다.
   * 지역 목록 첫 페이지(100곳)에 없을 수 있어서 검색으로 확실히 올린다.
   */
  const pendingFocus = useRef<{ id: string; cat: string } | null>(null)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('focus') ?? ''
    if (!/^\d{1,12}$/.test(id)) return
    fetch(`/api/places?ids=${id}&limit=1`)
      .then((r) => r.json())
      .then((d) => {
        const p: Place | undefined = d.places?.[0]
        if (!p) return
        // 쇼핑은 기본 목록에서 빠지므로 그 종류 칩까지 같이 켠다
        pendingFocus.current = { id: p.contentid, cat: p.cat === ASIDE_CAT ? ASIDE_CAT : ALL }
        setRegnCd(p.regnCd)
        setSignguCd(p.signguCd)
        setQ(p.title)
      })
      .catch(() => {})
  }, [])

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
    setCat(pendingFocus.current?.cat ?? ALL)
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
  const listSeq = useRef(0)
  useEffect(() => {
    const my = ++listSeq.current
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
        if (my !== listSeq.current) return
        if (d.error) setError(d.error)
        setPlaces(d.places ?? [])
        setTotal(d.total ?? 0)
        setCounts(d.counts ?? { all: 0, byCat: {}, bySub: {} })
        // 커뮤니티에서 넘어온 장소가 목록에 실렸으면 연다
        const want = pendingFocus.current
        if (want && (d.places ?? []).some((p: Place) => p.contentid === want.id)) {
          pendingFocus.current = null
          setSelectedId(want.id)
          if (isMobile) setSheet('half')
        }
      })
      .catch((e) => { if (my === listSeq.current) setError(String(e)) })
      .finally(() => { if (my === listSeq.current) setLoading(false) })
  }, [regnCd, signguCd, q, nearIds, cat, sub, limit])

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
        // 등록 전에는 거르지 않는다. 조건이 등록된 곳이라는 사실만 표시한다
        if (!pet) return { ...p, j: null, state: 'info' as const }
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

  /**
   * 시트 단계별 높이 — 넷. peek 은 손잡이와 머리글만, half 는 지도와 반반,
   * tall 은 지도를 한 뼘 남기고, full 은 검색창 바로 아래까지 올라가 지도를 다 덮는다.
   * tall 없이 half 에서 바로 full 로 튀면 한 번에 너무 많이 움직인다.
   */
  const SHEET_H: Record<SheetStage, string> = { peek: '86px', half: '46%', tall: '88%', full: '100%' }
  /** 놓은 높이(부모 대비 비율)와 빠르기로 다음 단계를 고른다. 휙 올리면 한 단계 위, 휙 내리면 한 단계 아래, 느리면 가장 가까운 단계 */
  const snapStage = (r: number, vy: number, parentH: number): SheetStage => {
    const ratio: Record<SheetStage, number> = { peek: 86 / Math.max(1, parentH), half: 0.46, tall: 0.88, full: 1 }
    if (vy < -0.45) return STAGES.find((k) => ratio[k] > r + 0.02) ?? 'full'
    if (vy > 0.45) return [...STAGES].reverse().find((k) => ratio[k] < r - 0.02) ?? 'peek'
    return STAGES.reduce((best, k) => (Math.abs(ratio[k] - r) < Math.abs(ratio[best] - r) ? k : best), 'half' as SheetStage)
  }
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
    const max = el.parentElement?.clientHeight ?? 0
    setSheetPx(Math.max(72, Math.min(max, d.h - (e.clientY - d.y))))
  }
  const dragEnd = () => {
    const el = sheetRef.current
    if (!dragRef.current || !el || sheetPx === null) return
    dragRef.current = null
    // 놓은 높이에서 가장 가까운 단계로 붙인다
    const parentH = el.parentElement?.clientHeight || 1
    setSheet(snapStage(sheetPx / parentH, 0, parentH))
    setSheetPx(null)
  }

  /**
   * 손가락 — 시트 **아무 데나** 잡고 끌 수 있다. 손잡이만 잡히면 아무도 못 찾는다.
   *
   * 규칙은 지도앱들과 같다: 시트가 다 올라오기 전엔 위·아래로 끌면 시트가 움직이고,
   * 다 올라온 뒤엔 목록이 스크롤된다. 목록 맨 위에서 아래로 끌면 다시 시트가 내려온다.
   * 가로로 끄는 건(칩 줄) 건드리지 않는다. 놓을 때는 빠르기를 본다 — 휙 올리면 끝까지,
   * 휙 내리면 내려간다. 느리게 놓으면 가장 가까운 단계.
   *
   * React 의 onTouchMove 는 passive 라 preventDefault 가 안 먹는다. 직접 단다.
   */
  const sheetState = useRef(sheet)
  sheetState.current = sheet
  useEffect(() => {
    const el = sheetRef.current
    if (!el || !isMobile) return
    let startX = 0, startY = 0, startH = 0, lastY = 0, lastT = 0, vy = 0
    let active = false, decided = false, curH = 0
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      startX = t.clientX; startY = lastY = t.clientY
      startH = curH = el.clientHeight; lastT = e.timeStamp; vy = 0
      active = true; decided = false
    }
    const onMove = (e: TouchEvent) => {
      if (!active) return
      const t = e.touches[0]
      const dy = t.clientY - startY
      const dx = t.clientX - startX
      if (!decided) {
        if (Math.abs(dy) < 5 && Math.abs(dx) < 5) return
        if (Math.abs(dx) > Math.abs(dy)) { active = false; return } // 가로 — 칩 줄 스크롤
        const list = el.querySelector('[data-sheet-scroll]') as HTMLElement | null
        const inList = Boolean(list && list.contains(e.target as Node))
        // 다 올라온 시트에서 목록 안을 끌면: 맨 위에서 아래로 끌 때만 시트가 내려온다
        if (sheetState.current === 'full' && inList && !(dy > 0 && (list?.scrollTop ?? 0) <= 0)) { active = false; return }
        decided = true
      }
      e.preventDefault()
      const dt = Math.max(1, e.timeStamp - lastT)
      vy = (t.clientY - lastY) / dt // px/ms, 아래가 +
      lastY = t.clientY; lastT = e.timeStamp
      const max = el.parentElement?.clientHeight ?? 0
      curH = Math.max(72, Math.min(max, startH - dy))
      setSheetPx(curH)
    }
    const onEnd = () => {
      if (!active) return
      active = false
      if (!decided) return
      const parentH = el.parentElement?.clientHeight || 1
      setSheet(snapStage(curH / parentH, vy, parentH))
      setSheetPx(null)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [isMobile])

  /** 상세 패널에서 원본 조건이 필요할 때 — 조회가 끝난 경우에만 있다 */
  const rules = (p: Judged) => {
    const e = rulesById[p.contentid]
    return e && e.state === 'done' ? e.rules : null
  }
  const region = regions.find((r) => r.code === regnCd)

  /**
   * 프로필 버튼은 상단 메뉴(Nav)에 있다. 아이가 바뀌면 판정이 전부 달라지므로
   * 보고 있던 상세는 닫는다 — 이전 아이 기준 판정이 그대로 떠 있으면 안 된다.
   * 판정에 쓰는 값으로만 본다. 로그인 동기화가 같은 아이를 새 객체로 내려줘도 닫지 않게.
   */
  const petSig = pet ? `${pet.key}|${pet.size}|${pet.isDangerous}|${pet.hasCage}|${pet.hasMuzzle}` : ''
  useEffect(() => setSelectedId(null), [petSig])

  /** 종류 칩 하나. 필터 바(넓은 화면)와 필터 시트(좁은 화면)가 같이 쓴다 */
  const catChip = (label: string, count: number) => {
    const on = label === cat
    return (
      <button key={label} className="hov-accent"
        onClick={() => { setCat(label); setSub('전체'); setLimit(PAGE); setSelectedId(null) }}
        style={{ flex: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 700 : 500, padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${on ? '#2B2420' : '#E3DCCE'}`, background: on ? '#2B2420' : '#FFFFFF', color: on ? '#FFFFFF' : '#6E5F4D', cursor: 'pointer' }}>
        {label} <span style={{ opacity: .65, fontWeight: 500 }}>{count.toLocaleString()}</span>
      </button>
    )
  }

  /** 좁은 화면에서 '내 주변'은 지도 위에 둔다 — 지도앱들이 현위치 버튼을 두는 자리다 */
  const nearbyButton = (
    <button className="hov-accent" disabled={nearBusy}
      onClick={() => (nearIds ? setNearIds(null) : findNearby())}
      title={nearIds ? '지역으로 돌아가기' : '현재 위치 20km 안에서 찾기'}
      style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '7px 12px', borderRadius: 99, border: `1.5px solid ${nearIds ? '#E85D3D' : '#F3C9BB'}`, background: nearIds ? '#E85D3D' : 'rgba(255,244,239,.97)', color: nearIds ? '#FFFFFF' : '#E85D3D', cursor: nearBusy ? 'default' : 'pointer', boxShadow: '0 3px 12px rgba(43,36,32,.16)', whiteSpace: 'nowrap', opacity: nearBusy ? .7 : 1 }}>
      <LocateIcon size={15} /> {nearBusy ? '확인 중…' : nearIds ? '해제' : '내 주변 탐색'}
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
        {pet ? `${pet.name}와 함께 갈 수 있는 곳` : '반려동물 동반 가능 장소'} <span style={{ color: '#E85D3D' }}>{visible.length}</span>
      </span>
      <span style={{ fontSize: 12, color: '#B3A78F' }}>
        {isMobile ? `${total.toLocaleString()}곳 중` : '이름 순'}
      </span>
    </div>

    {/* 좁은 화면에서는 지도 위에 범례를 놓을 자리가 없다 — 목록 머리에 붙인다 */}
    {isMobile && (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 11, padding: '0 16px 8px', fontSize: 11.5, color: '#6E5F4D' }}>
        {pet ? (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#2F8F4E' }} />입장 가능 {okCount}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#FFC93C' }} />조건부 {condCount}</span>
          </>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#E85D3D', fontWeight: 700 }}><PetFace emoji="🐶" size={15} />프로필을 등록하면 동반 가능 여부를 필터링해요</span>
        )}
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

    <div data-sheet-scroll style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '4px 12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              <span style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span>
                {/* 조건이 최근 바뀐 곳 — "지난달엔 됐는데"를 막는 표시. 상세에 전후가 있다 */}
                {(() => { const c = recentChange(rules(p)); return c ? <span title={`조건 변경 감지 ${c.at}`} style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: '#FFF4EF', color: '#E85D3D', border: '1px solid #F3C9BB', whiteSpace: 'nowrap' }}>조건 변경 {shortDate(c.at)}</span> : null })()}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 99, border: `1.5px solid ${b.border}`, color: b.color, background: b.bg, whiteSpace: 'nowrap', flex: 'none' }}>{b.text}</span>
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
            <div style={{ fontSize: 12.5, color: p.j ? (condCheck ? '#9A7300' : '#2F8F4E') : '#A08872' }}>
              {p.j ? (condCheck ? condCheck.text : p.j.checks[0]?.text) : p.state === 'info' ? describeRules(rules(p)) : b.text}
            </div>
            {/* 조건 칩 — 구역·체중·준비물을 글 대신 한 단어씩. 판정과 별개로 원문 요약 */}
            <RuleChips rules={rules(p)} />
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
        <p style={{ margin: '14px 4px 0', fontSize: 11.5, color: '#B3A78F' }}>데이터 출처: ⓒ한국관광공사</p>
      )}
    </div>
    </>
  )

  // minWidth 를 두지 않는다 — 예전엔 넓은 화면에 1100 을 걸어 821~1099px(태블릿 가로·작은 창)에서 가로 스크롤이 생겼다
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
      {/* ── 상단 바 */}
      {/* 좁은 화면에서는 지역·종류·검색을 요약한 바 한 줄. 누르면 시트에서 고른다 */}
      {isMobile ? (
        <div style={{ padding: '8px 12px', background: '#FFFFFF', borderBottom: '1px solid #EAE3D6', flex: 'none', display: 'flex', gap: 8 }}>
          <button className="hov-accent" onClick={() => setFilterOpen(true)}
            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: '#F6F1E7', border: '1.5px solid #EAE3D6', borderRadius: 14, padding: '13px 15px', fontFamily: 'inherit', fontSize: 15.5, color: '#2B2420', cursor: 'pointer', textAlign: 'left' }}>
            <SearchIcon size={19} />
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
        {/* 아이콘은 글자 높이(15.5px)에 맞춘 22px, 간격은 글자와 같은 8px — 크면 셀렉트 박스가 아니라 배지처럼 보인다 */}
        <div className="hov-accent" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F6F1E7', border: '1.5px solid #EAE3D6', borderRadius: 13, padding: '9px 12px 9px 12px' }}>
          {/* 발자국 핀 — 꼬리가 아래라 1px 올려야 글자와 나란해 보인다 */}
          <span style={{ display: 'flex', marginTop: -1 }}><PawPinIcon size={26} /></span>
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
          <SearchIcon size={18} />
          <input value={q} placeholder="장소 이름으로 검색"
            onChange={(e) => { setQ(e.target.value); setNearIds(null) }}
            style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 15.5, color: '#2B2420', outline: 'none', width: '100%' }} />
          {q && (
            <button onClick={() => setQ('')} title="검색어 지우기"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#A08872', fontSize: 15, lineHeight: 1, padding: 0 }}>✕</button>
          )}
        </div>

        <button className="hov-accent" disabled={nearBusy}
          onClick={() => (nearIds ? setNearIds(null) : findNearby())}
          title={nearIds ? '지역으로 돌아가기' : '현재 위치 20km 안에서 찾기'}
          // 상단 바에서 유일하게 색이 있는 버튼 — 지역·검색과 같은 베이지면 묻힌다
          style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, padding: '10px 16px', borderRadius: 13, border: `1.5px solid ${nearIds ? '#E85D3D' : '#F3C9BB'}`, background: nearIds ? '#E85D3D' : '#FFF4EF', color: nearIds ? '#FFFFFF' : '#E85D3D', cursor: nearBusy ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: nearBusy ? .7 : 1 }}>
          <LocateIcon size={17} /> {nearBusy ? '위치 확인 중…' : nearIds ? '내 주변 해제' : '내 주변 탐색'}
        </button>

        {geoError && (
          <span style={{ fontSize: 12, color: '#C0392B', maxWidth: 220, lineHeight: 1.35 }}>{geoError}</span>
        )}
      </header>
      )}

      {/* ── 필터 바 (넓은 화면 전용) */}
      {!isMobile && (
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #EAE3D6', flex: 'none' }}>
        <div className="chip-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '7px 12px 0' : '8px 20px 0', overflowX: 'auto', whiteSpace: 'nowrap' }}>
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
        <div className="chip-row" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '5px 12px 7px' : '7px 20px 8px', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: 'nowrap' }}>
          {subs.length > 0 && (
            <>
              <span style={{ fontSize: 12, color: '#B3A78F', marginRight: 2 }}>세부</span>
              {['전체', ...subs].map((code) => {
                const on = code === sub
                // 이름표가 아직 안 왔으면 코드(AC01)를 보이지 않고 자리만 둔다
                const label = code === '전체' ? '전체' : (catNames[code] ?? '···')
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
          {/* 몇 곳 확인했는지는 목록 제목의 숫자와 범례가 이미 말한다 — 여기선 검색·내 주변 상태만 */}
          {(q || nearIds) && (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#E85D3D', flex: 'none', paddingLeft: isMobile ? 4 : 0 }}>
            {q ? '전국 검색' : '내 주변 20km'}
          </span>
          )}
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
                          {code === '전체' ? '전체' : (catNames[code] ?? '···')} <span style={{ opacity: .6, fontWeight: 500 }}>{code === '전체' ? inCatCount : subCounts[code]}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>이름으로 찾기</h2>
                <div className="hov-accent" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F6F1E7', border: '1.5px solid #EAE3D6', borderRadius: 12, padding: '9px 13px' }}>
                  <SearchIcon size={18} />
                  <input value={q} placeholder="장소 이름으로 검색" autoFocus={!!q}
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
            {pet ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#2F8F4E' }} />입장 가능 {okCount}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FFC93C' }} />조건부 가능 {condCount}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#B3A78F' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#D8D0C0' }} />불가 {hiddenCount} (숨김)</div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#2F8F4E' }} />동반 조건 있음 {visible.filter((p) => p.state === 'info').length}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#E85D3D', fontWeight: 700, marginTop: 2 }}><PetFace emoji="🐶" size={15} />프로필을 등록하면 판정해요</div>
              </>
            )}
            {visible.some((p) => p.state === 'loading') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#A08872' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#B3A78F' }} />조건 확인 중 {visible.filter((p) => p.state === 'loading').length}</div>
            )}
          </div>
          )}

          {!isMobile && (
          <div style={{ position: 'absolute', left: 16, top: 14, background: 'rgba(255,255,255,.94)', border: '1px solid #EAE3D6', borderRadius: 99, padding: '6px 14px', fontSize: 12.5, color: '#6E5F4D' }}>
            {pet
              ? <><span style={{ display: 'inline-block', verticalAlign: '-4px', marginRight: 3 }}><PetFace emoji={pet.emoji} size={16} /></span><b>{pet.name}</b> 기준으로 판정된 지도예요</>
              : <><span style={{ display: 'inline-block', verticalAlign: '-4px', marginRight: 4 }}><PetFace emoji="🐶" size={16} /></span><b>프로필을 등록</b>하면 등록한 아이 기준으로 동반 가능 여부를 필터링해요</>}
          </div>
          )}

          {/* 좁은 화면 — 내 주변 버튼은 지도 오른쪽 위. 프로필은 상단 메뉴에 있다 */}
          {isMobile && (
            <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 10 }}>
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
                // 다 올라오면 검색창 아래에 딱 붙으므로 모서리를 편다
                borderRadius: sheet === 'full' && sheetPx === null ? 0 : '18px 18px 0 0',
                boxShadow: '0 -6px 24px rgba(43,36,32,.14)',
                display: 'flex', flexDirection: 'column', minHeight: 0,
                // 놓으면 가장 가까운 단계로 '샤샤샥' — 끄는 동안엔 손가락을 그대로 따른다
                transition: sheetPx !== null ? 'none' : 'height .3s cubic-bezier(.2,.8,.2,1), border-radius .3s',
                // 시트 자체는 브라우저 제스처를 안 받는다(손가락 끌기는 위 터치 핸들러가). 목록만 세로 스크롤
                touchAction: sheet === 'full' ? 'pan-y' : 'none',
              }}>
              {/* 손잡이 — 마우스로도 끌 수 있게 포인터 끌기는 여기만. 손가락은 시트 어디든 된다 */}
              <div onPointerDown={(e) => { if (e.pointerType === 'mouse') dragStart(e) }} onPointerMove={(e) => { if (e.pointerType === 'mouse') dragMove(e) }} onPointerUp={dragEnd} onPointerCancel={dragEnd}
                onClick={() => setSheet(STAGES[(STAGES.indexOf(sheet) + 1) % STAGES.length])}
                title="끌어서 높이 조절"
                style={{ flex: 'none', padding: '10px 0 8px', display: 'flex', justifyContent: 'center', cursor: 'grab' }}>
                <span style={{ width: 40, height: 5, borderRadius: 99, background: '#DCD3C2' }} />
              </div>
              {listPanel}
            </div>
          )}

          {/* 상세 패널 — 지도·핫플레이스가 같은 PlaceDetail 을 쓴다. 여기서는 자리만 잡는다 */}
          {sel && (
            <div style={isMobile
              ? { position: 'absolute', inset: 0, background: '#FFFFFF', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 30 }
              : { position: 'absolute', left: 14, top: 56, bottom: 14, width: 330, background: '#FFFFFF', border: '1px solid #EAE3D6', borderRadius: 18, boxShadow: '0 10px 34px rgba(43,36,32,.16)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slidein .22s ease-out', zIndex: 30 }}>
              <PlaceDetail
                place={sel}
                pet={pet}
                rulesEntry={rulesById[sel.contentid]}
                onClose={() => { setSelectedId(null); if (isMobile) setSheet('half') }}
                mobile={isMobile}
                nickname={sessionNick}
                loggedIn={Boolean(petStore.session)}
                provider={petStore.session?.user.app_metadata?.provider as string | undefined}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 내 주변 탐색 — 지도앱들이 현위치 버튼에 쓰는 과녁 모양.
 * 나침반(🧭)은 '방향'이지 '내 위치'가 아니라 바꿨다. currentColor 라 켜지면 주황이 된다.
 */
function LocateIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" style={{ flex: 'none', display: 'block' }}>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2" />
    </svg>
  )
}
