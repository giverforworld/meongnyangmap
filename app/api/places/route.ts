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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const regnCd = searchParams.get('regnCd') ?? ''
  const signguCd = searchParams.get('signguCd') ?? ''
  const q = (searchParams.get('q') ?? '').trim()
  const ids = (searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  try {
    const all = await catalog()
    let places: Place[]

    if (ids.length > 0) {
      // 브라우저가 거리로 골라 온 순서를 그대로 지킨다
      const byId = new Map(all.map((p) => [p.contentid, p]))
      places = ids.map((id) => byId.get(id)).filter((p): p is Place => Boolean(p))
      return NextResponse.json({ places, total: places.length })
    }

    places = all
    if (q) {
      // 이름 검색은 전국에서 한다. 지역까지 겹쳐 걸면 "해수욕장"을 서울에서 찾다가
      // 0건이 나오는 식이라, 검색하는 사람의 기대와 어긋난다.
      const k = q.toLowerCase()
      places = places.filter(
        (p) => p.title.toLowerCase().includes(k) || p.addr1.toLowerCase().includes(k)
      )
    } else {
      if (regnCd) places = places.filter((p) => p.regnCd === regnCd)
      if (signguCd) places = places.filter((p) => p.signguCd === signguCd)
    }
    places = [...places].sort(sortForDisplay)

    return NextResponse.json({ places, total: places.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, places: [] }, { status: 500 })
  }
}
