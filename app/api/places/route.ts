import { NextResponse } from 'next/server'
import { catalog } from '@/lib/catalog'
import type { Place } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * 목록 조회 — 지역 / 이름 검색 / contentid 지정.
 *
 * 좌표는 받지 않는다. 사용자 위치를 서버로 전송하면 저장 여부와 무관하게
 * 위치기반서비스사업자 신고 대상이 되기 때문이다(공모전 공지 FAQ). '내 주변'은
 * 브라우저가 /api/places/coords 로 거리 계산을 하고, 고른 contentid 만 ids 로 넘긴다.
 *
 * 동반 조건은 여기서 받지 않는다 — 장소당 1콜이라 /api/pet-rules 가 화면에 그려질
 * 것만 따로 받는다.
 *
 * **거르는 일은 서버가 한다.** 예전에는 지역 전체를 내려보내고 브라우저가 걸렀다.
 * 서울은 3,170곳이라 한 번에 1,008KB 가 나갔고, 화면은 그중 50곳만 그렸다.
 * 밖에서 신호가 약할 때 그 1MB 가 몇 초씩 흰 화면으로 남았다.
 * 지금은 화면에 그릴 만큼만 보낸다 — 100건이면 32KB 다.
 */
/**
 * 표시 순서 — 타입 먼저, 그다음 이름.
 *
 * 이름순만 쓰면 숫자·기호로 시작하는 쇼핑(약국·안경원 8,647곳)이 앞을 통째로 덮어
 * 첫 화면에 관광지가 한 곳도 안 보인다. 쇼핑은 사후면세점이라 여행지로서 값이 낮고
 * 동반 조건도 수집 대상 밖이라, 목록에는 남기되 맨 뒤로 보낸다.
 */
const TYPE_ORDER = ['12', '39', '32', '14', '28', '15', '38']
const rank = (t: string) => {
  const i = TYPE_ORDER.indexOf(t)
  return i === -1 ? TYPE_ORDER.length : i
}
const sortForDisplay = (a: Place, b: Place) =>
  rank(a.contenttypeid) - rank(b.contenttypeid) || a.title.localeCompare(b.title, 'ko')

/**
 * 쇼핑을 뺀 나머지가 '갈 만한 곳'이다. 화면의 ALL 칩과 같은 뜻이라 이름을 맞춰 둔다 —
 * 한쪽만 바뀌면 칩의 숫자와 실제 목록이 어긋난다.
 */
const ASIDE_CAT = '쇼핑'

/** 한 번에 보내는 최대치. 화면이 요청한 값이 이보다 크면 여기서 자른다 */
const MAX_LIMIT = 500

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const regnCd = searchParams.get('regnCd') ?? ''
  const signguCd = searchParams.get('signguCd') ?? ''
  const q = (searchParams.get('q') ?? '').trim()
  const ids = (searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const cat = searchParams.get('cat') ?? ''
  const sub = searchParams.get('sub') ?? ''
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), MAX_LIMIT)

  try {
    const all = await catalog()

    // ── ① 후보 고르기 — 내 주변 / 이름 검색 / 지역
    let base: Place[]
    let keepOrder = false

    if (ids.length > 0) {
      // 브라우저가 거리로 골라 온 순서를 그대로 지킨다
      const byId = new Map(all.map((p) => [p.contentid, p]))
      base = ids.map((id) => byId.get(id)).filter((p): p is Place => Boolean(p))
      keepOrder = true
    } else if (q) {
      // 이름 검색은 전국에서 한다. 지역까지 겹쳐 걸면 "해수욕장"을 서울에서 찾다가
      // 0건이 나오는 식이라, 검색하는 사람의 기대와 어긋난다.
      const k = q.toLowerCase()
      base = all.filter(
        (p) => p.title.toLowerCase().includes(k) || p.addr1.toLowerCase().includes(k)
      )
    } else {
      base = all
      if (regnCd) base = base.filter((p) => p.regnCd === regnCd)
      if (signguCd) base = base.filter((p) => p.signguCd === signguCd)
    }

    // ── ② 칩에 붙는 숫자. 카테고리를 고르기 **전** 기준이어야 고를 수 있다
    const byCat: Record<string, number> = {}
    let allCount = 0
    for (const p of base) {
      byCat[p.cat] = (byCat[p.cat] ?? 0) + 1
      if (p.cat !== ASIDE_CAT) allCount++
    }

    // ── ③ 카테고리. 지정이 없으면 '갈 만한 곳'(쇼핑 제외)이다
    const inCat = cat
      ? base.filter((p) => p.cat === cat)
      : base.filter((p) => p.cat !== ASIDE_CAT)

    // ── ④ 세부분류 숫자도 마찬가지로 고르기 전 기준
    const bySub: Record<string, number> = {}
    for (const p of inCat) {
      if (p.lclsSystm2) bySub[p.lclsSystm2] = (bySub[p.lclsSystm2] ?? 0) + 1
    }

    const filtered = sub ? inCat.filter((p) => p.lclsSystm2 === sub) : inCat
    const ordered = keepOrder ? filtered : [...filtered].sort(sortForDisplay)

    return NextResponse.json({
      places: ordered.slice(0, limit),
      total: ordered.length,
      counts: { all: allCount, byCat, bySub },
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, places: [], total: 0, counts: { all: 0, byCat: {}, bySub: {} } },
      { status: 500 }
    )
  }
}
