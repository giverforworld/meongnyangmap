import { NextResponse } from 'next/server'
import { ALL, call } from '@/lib/kto'
import prebuilt from '../../../data/categories.json'

export const dynamic = 'force-dynamic'

/**
 * 분류체계 코드의 이름표.
 *
 * areaBasedList2 는 lclsSystm1/2/3 을 코드로만 준다. 화면에 "백화점"이라고 쓰려면
 * lclsSystmCode2 로 이름을 따로 받아야 한다. 1depth 1콜 + 그 수만큼의 2depth 콜이라
 * 하루 캐싱한다 — 분류체계는 사실상 바뀌지 않는다.
 */
const TTL = 24 * 60 * 60 * 1000
let cache: { at: number; names: Record<string, string> } | null = null

/**
 * 화면에 쓰는 이름을 바꾸는 것. 코드는 그대로 두고 이름표만 덮는다.
 * SH04 '면세점'은 실제로는 사후면세점(택스리펀 가맹 일반 상점)이 대부분이라
 * 공항 면세점을 떠올리게 하는 이름이 오해를 부른다.
 */
const DISPLAY: Record<string, string> = { SH04: '스토어' }

/**
 * 일 배치가 받아둔 이름표. 서버가 새로 뜰 때마다 공사 API 를 1+N 콜 부르고 그동안 화면엔
 * 코드(AC01…)가 보이던 것을 없앤다 — 파일이 있으면 그것부터, 비어 있을 때만 실시간
 */
const FILE = (prebuilt as { names?: Record<string, string> }).names ?? {}

export async function GET() {
  if (Object.keys(FILE).length > 0) {
    return NextResponse.json({ names: { ...FILE, ...DISPLAY }, cached: true, source: 'file' })
  }
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json({ names: cache.names, cached: true })
  }

  try {
    const names: Record<string, string> = {}

    const { items: depth1 } = await call<any>('lclsSystmCode2', { numOfRows: ALL, pageNo: 1 })
    depth1.forEach((d) => (names[d.code] = d.name))

    const depth2 = await Promise.all(
      depth1.map((d) =>
        call<any>('lclsSystmCode2', { lclsSystm1: d.code, numOfRows: ALL, pageNo: 1 })
      )
    )
    depth2.flatMap((r) => r.items).forEach((d) => (names[d.code] = d.name))
    Object.assign(names, DISPLAY)

    cache = { at: Date.now(), names }
    return NextResponse.json({ names, cached: false })
  } catch (e) {
    // 이름표는 없어도 화면이 동작해야 한다 — 코드를 그대로 보여주면 된다.
    return NextResponse.json({ names: {}, error: (e as Error).message })
  }
}
