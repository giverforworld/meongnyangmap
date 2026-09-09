import type { Pet } from './types'

/**
 * 캠핑장 — 고캠핑 서비스(GoCamping).
 *
 * 반려동물 동반여행 서비스의 숙박은 107곳뿐이다. 캠핑은 반려동물 동반 수요가 큰데
 * 그 목록에 거의 잡히지 않아, 별도 서비스에서 3,115곳을 따로 받는다.
 *
 * 이쪽은 자연어를 파싱할 필요가 없다 — `animalCmgCl` 한 필드에
 * '가능' · '가능(소형견)' · '불가능' 넷 중 하나로 이미 구조화돼 있다.
 *
 * **이 파일은 data/camping.json 을 import 하지 않는다.** 판정은 화면(클라이언트)에서
 * 하는데, 여기서 파일을 끌어오면 1.9MB 가 통째로 브라우저 번들에 실린다.
 * 데이터를 읽는 일은 app/api/camping 이 맡는다.
 */
export interface Camp {
  id: string
  name: string
  addr: string
  doNm: string
  sigunguNm: string
  mapx: number
  mapy: number
  image: string
  /** 해변·산·숲·강 — 어떤 곳인지 한눈에 보여주는 값 */
  lctCl: string
  /** 일반야영장·글램핑·카라반 */
  induty: string
  tel: string
  homepage: string
  resveCl: string
  intro: string
  /** 원문 그대로. 판정은 judgeCamp 가 한다 */
  animal: string
}

export type CampState = 'ok' | 'cond' | 'no'

export interface CampJudge {
  state: CampState
  /** 왜 그렇게 판정했는지 — 원문에서 나온 근거만 쓴다 */
  why: string
}

/**
 * 우리 아이가 갈 수 있는 캠핑장인지 판정한다.
 *
 * '불가'를 먼저 본다 — '가능'과 '불가능' 둘 다 '가능'을 포함하기 때문에
 * 순서를 뒤집으면 '불가능'이 초록불이 된다.
 */
export function judgeCamp(animal: string, pet: Pet): CampJudge {
  const a = (animal ?? '').trim()

  if (!a) {
    return {
      state: 'cond',
      why: '동반 가능 여부가 등록되지 않았어요 — 예약 전 확인을 권해요',
    }
  }

  if (/불가/.test(a)) {
    return { state: 'no', why: '반려동물 동반 불가' }
  }

  // '가능(소형견)' — 크기 조건이 원문에 이미 들어 있다
  if (/소형견/.test(a)) {
    return pet.size === 'small'
      ? { state: 'ok', why: `소형견만 가능 → ${pet.sizeLabel} 충족` }
      : { state: 'no', why: `소형견만 가능 (${pet.name} ${pet.sizeLabel})` }
  }

  if (/가능/.test(a)) {
    return { state: 'ok', why: '반려동물 동반 가능' }
  }

  // 위 넷 말고 새로운 표기가 생겼을 때. 모르는 값을 초록불로 두지 않는다
  return { state: 'cond', why: `${a} — 예약 전 확인을 권해요` }
}

/**
 * 시도 개편 전후 이름이 한 데이터에 섞여 있다 — 강원도 341곳과 강원특별자치도 218곳이
 * 같은 지역인데 따로 잡힌다. 그냥 두면 '강원도'를 고른 사람이 218곳을 못 본다.
 * 최신 명칭으로 모은다.
 */
const REGION_ALIAS: Record<string, string> = {
  강원도: '강원특별자치도',
  전라북도: '전북특별자치도',
}

export const normalizeRegion = (s: string) => REGION_ALIAS[(s ?? '').trim()] ?? (s ?? '').trim()

/** 시도별 개수. 데이터에 실제로 있는 것만 세어서 준다 */
export function regionsOf(camps: Camp[]) {
  const m = new Map<string, number>()
  camps.forEach((c) => {
    const r = normalizeRegion(c.doNm)
    if (r) m.set(r, (m.get(r) ?? 0) + 1)
  })
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }))
}

/**
 * 위치 유형(lctCl)은 '해변,숲'처럼 쉼표로 여럿이 온다. 칩으로 쓰려면 쪼개야 한다.
 */
export const splitTags = (s: string) =>
  (s ?? '')
    .split(/[,·]/)
    .map((x) => x.trim())
    .filter(Boolean)
