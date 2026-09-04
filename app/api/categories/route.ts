import { NextResponse } from 'next/server'
import { ALL, call } from '@/lib/kto'

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

export async function GET() {
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

    cache = { at: Date.now(), names }
    return NextResponse.json({ names, cached: false })
  } catch (e) {
    // 이름표는 없어도 화면이 동작해야 한다 — 코드를 그대로 보여주면 된다.
    return NextResponse.json({ names: {}, error: (e as Error).message })
  }
}
