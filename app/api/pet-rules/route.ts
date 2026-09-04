import { NextResponse } from 'next/server'
import { call } from '@/lib/kto'
import { parseRules } from '@/lib/petTour'
import type { PetRules, PetTourRaw } from '@/lib/types'
import prebuilt from '../../../data/petRules.json'

/**
 * 일 배치(`npm run collect`)가 받아둔 동반 조건.
 *
 * detailPetTour2 는 장소당 1콜이고 벌크 조회가 없어서, 화면에서 매번 부르면
 * 카드 20개마다 20콜이 나간다. 배치가 하루 한 번 전부 받아두고 화면은 여기서 읽는다.
 * 표에 없는 장소(쇼핑 등 배치 대상 밖)만 실시간으로 부른다.
 */
// 배치가 저장한 시점의 모양이라 최신 필드가 없을 수 있다 — 읽을 때 보정한다
const FILE = ((prebuilt as unknown as { rules?: Record<string, any> }).rules ?? {}) as Record<
  string,
  PetRules | null
>

export const dynamic = 'force-dynamic'

/**
 * 동반 조건은 거의 바뀌지 않는 정보라 contentid 단위로 오래 캐싱한다.
 * detailPetTour2 는 장소당 1콜이라, 이 캐시가 호출 한도를 지키는 핵심이다.
 */
// 같은 화면을 다시 그릴 때의 중복 호출만 막을 만큼 짧게 잡는다. 길게 잡으면 호출
// 이력이 남지 않고, 현장 규정이 바뀌어도 오래 굳는다.
const TTL = 30 * 60 * 1000
const cache = new Map<string, { at: number; rules: PetRules | null }>()

function cached(id: string) {
  const hit = cache.get(id)
  return hit && Date.now() - hit.at < TTL ? hit : null
}

/** 한 요청이 부를 수 있는 상한 — 화면 한 페이지(50) 분량 */
const MAX_IDS = 50

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
  const ids = (searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS)

  if (ids.length === 0) return NextResponse.json({ rules: {}, failed: [] })

  // 병렬 8 에서 전건 빈 응답, 4 로 낮추니 정상이었다. 원인을 스로틀링으로 단정하지는
  // 못했지만 4 는 실측으로 안전이 확인된 값이다. 조회 실패와 '조건 정보 미등록'은
  // 다른 상태다 — 실패를 null 로 뭉개면 화면에 "미등록 장소"로 잘못 표시된다.
  const results = await pooled(ids, 4, async (id) => {
    if (id in FILE) return { id, ok: true, rules: FILE[id], fromCache: true }

    const hit = cached(id)
    if (hit) return { id, ok: true, rules: hit.rules, fromCache: true }

    try {
      const { items } = await call<PetTourRaw>('detailPetTour2', {
        contentId: id,
        numOfRows: 10,
        pageNo: 1,
      })
      const rules = items[0] ? parseRules(items[0]) : null
      return { id, ok: true, rules, fromCache: false }
    } catch {
      return { id, ok: false, rules: null, fromCache: false }
    }
  })

  const failed = results.filter((r) => !r.ok).map((r) => r.id)

  // 상류 장애는 예외 말고 '200 + 빈 items' 로도 온다. 새로 부른 것이 전부 빈 응답이면
  // 스로틀링을 의심해 캐시에 넣지 않는다 — 넣으면 잘못된 판정이 TTL 동안 굳는다.
  const fetched = results.filter((r) => r.ok && !r.fromCache)
  const allEmpty = fetched.length > 0 && fetched.every((r) => !r.rules)

  // 장애로 판단되면 이번에 부른 것은 캐시에 넣지도, 판정 결과로 돌려주지도 않는다.
  // 캐시에서 온 값은 멀쩡하므로 그대로 내보낸다.
  if (!allEmpty) {
    fetched.forEach((r) => cache.set(r.id, { at: Date.now(), rules: r.rules }))
  }

  const rules: Record<string, PetRules | null> = {}
  results
    .filter((r) => r.ok && (r.fromCache || !allEmpty))
    .forEach((r) => (rules[r.id] = r.rules))

  return NextResponse.json({
    rules,
    failed: allEmpty ? [...failed, ...fetched.map((r) => r.id)] : failed,
  })
}
