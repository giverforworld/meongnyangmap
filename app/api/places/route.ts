import { NextResponse } from 'next/server'
import { ALL, CONTENT_TYPES, call, type ContentTypeId } from '@/lib/kto'
import { parseRules } from '@/lib/petTour'
import type { Place, PetTourRaw } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * 서버 메모리 캐시 — 개발 중 호출 한도(오퍼레이션당 일 1,000건)를 아끼기 위한 것.
 * TTL 을 짧게 두어 실시간 호출 원칙을 유지한다.
 */
const TTL = 5 * 60 * 1000
const cache = new Map<string, { at: number; data: unknown }>()

function cached<T>(key: string): T | null {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.data as T
  return null
}

function put(key: string, data: unknown) {
  cache.set(key, { at: Date.now(), data })
}

/** 동시 호출 수를 제한한 map */
async function pooled<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>) {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  }
  return out
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const regnCd = searchParams.get('regnCd') ?? '11'
  const signguCd = searchParams.get('signguCd') ?? ''

  const key = `places:${regnCd}:${signguCd}`
  const hit = cached<Place[]>(key)
  if (hit) return NextResponse.json({ places: hit, failed: 0, degraded: false, cached: true })

  try {
    // ① 타입별 목록 — numOfRows 에 상한이 없어 타입당 1콜이면 전부 받는다
    const lists = await Promise.all(
      (Object.keys(CONTENT_TYPES) as unknown as ContentTypeId[]).map(async (t) => {
        const { items } = await call<any>('areaBasedList2', {
          numOfRows: ALL,
          pageNo: 1,
          contentTypeId: t,
          lDongRegnCd: regnCd,
          ...(signguCd ? { lDongSignguCd: signguCd } : {}),
          arrange: 'A',
        })
        return items.map((x) => ({ ...x, __cat: CONTENT_TYPES[t] }))
      })
    )

    const rows = lists.flat().filter((x) => x.contenttypeid !== '38')

    // ② 각 장소의 동반 조건
    //    병렬 8 로 부르면 data.go.kr 이 스로틀링하는데, 오류가 아니라 '200 + 빈 items' 로
    //    응답한다. 서울 78건 기준 전건이 빈 응답이었고 4 로 낮추니 78/78 정상이었다.
    //    조회 실패와 '조건 정보 미등록'도 다른 상태다. 실패를 null 로 뭉개면
    //    화면에는 "정보가 등록되지 않은 장소"로 잘못 표시된다.
    const details = await pooled(rows, 4, async (r) => {
      try {
        const { items } = await call<PetTourRaw>('detailPetTour2', {
          contentId: r.contentid,
          numOfRows: 10,
          pageNo: 1,
        })
        return { ok: true, raw: items[0] ?? null }
      } catch {
        return { ok: false, raw: null }
      }
    })

    const failed = details.filter((d) => !d.ok).length

    const places: Place[] = rows.map((r, i) => ({
      contentid: String(r.contentid),
      contenttypeid: String(r.contenttypeid),
      title: r.title ?? '',
      addr1: r.addr1 ?? '',
      mapx: Number(r.mapx) || 0,
      mapy: Number(r.mapy) || 0,
      firstimage: r.firstimage ?? '',
      cat: r.__cat,
      rules: details[i].raw ? parseRules(details[i].raw!) : null,
    }))

    // 상류 장애는 예외 말고 '200 + 빈 items' 로도 온다. 조건 정보가 한 건도 없다면
    // 반려동물 목록에서 온 데이터인 이상 정상이 아니라고 본다.
    const degraded = failed > 0 || (places.length > 0 && places.every((p) => !p.rules))

    // 이런 결과를 캐시하면 잘못된 판정이 TTL 동안 굳어버린다
    if (!degraded) put(key, places)

    return NextResponse.json({ places, failed, degraded, cached: false })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, places: [] }, { status: 500 })
  }
}
