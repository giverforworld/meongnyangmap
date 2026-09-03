import { NextResponse } from 'next/server'
import { ALL, call } from '@/lib/kto'

export const dynamic = 'force-dynamic'

let memo: { at: number; data: unknown } | null = null
const TTL = 60 * 60 * 1000

/**
 * 법정동 코드 — lDongListYn=Y 로 시도·시군구 전체 조합(269건)을 1콜에 받는다.
 * 시도 목록은 개편되므로(시도 12 = 전남광주통합특별시) 하드코딩하지 않는다.
 */
export async function GET() {
  if (memo && Date.now() - memo.at < TTL) {
    return NextResponse.json(memo.data)
  }

  try {
    const { items } = await call<any>('ldongCode2', {
      numOfRows: ALL,
      pageNo: 1,
      lDongListYn: 'Y',
    })

    const map = new Map<string, { code: string; name: string; sigungu: { code: string; name: string }[] }>()
    for (const it of items) {
      const rc = String(it.lDongRegnCd)
      if (!map.has(rc)) map.set(rc, { code: rc, name: it.lDongRegnNm, sigungu: [] })
      map.get(rc)!.sigungu.push({ code: String(it.lDongSignguCd), name: it.lDongSignguNm })
    }

    const data = { regions: [...map.values()] }
    memo = { at: Date.now(), data }
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, regions: [] }, { status: 500 })
  }
}
