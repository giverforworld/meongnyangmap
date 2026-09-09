import type { Pet, PetSize } from './types'
import { isDangerousBreed, sizeOf } from './petTour'

/**
 * 판정 기준이 되는 반려동물 프로필.
 *
 * 지도(app/page.tsx)와 캠핑·핫플레이스(app/hotplace)가 같은 기준으로 판정해야 하므로
 * 여기 둔다. 화면마다 따로 들고 있으면 한쪽만 고쳐져 같은 장소가 다르게 뜬다.
 *
 * **프로필은 이 기기 안에만 둔다.** 서버로 보내지 않는다 — 위치와 같은 원칙이다.
 * 로그인 없이 바로 쓸 수 있어야 하고(공모전 제출 시 '로그인 불필요'), 아이 정보를
 * 남의 서버에 맡길 이유도 없다. 기기를 옮기면 다시 등록해야 하는 것이 이 선택의 대가다.
 */

const SIZE_LABEL: Record<PetSize, string> = {
  small: '소형견',
  medium: '중형견',
  large: '대형견',
}

/** 사람이 채우는 것만 받는다. 크기·맹견 여부는 무게와 견종에서 나온다 */
export interface PetInput {
  key: string
  name: string
  breed: string
  kg: number
  emoji: string
  photo?: string
  hasCage: boolean
  hasMuzzle: boolean
}

/**
 * 입력을 판정에 쓰는 프로필로 바꾼다.
 * 크기는 무게로, 맹견 여부는 견종으로 정한다 — 사람에게 묻지 않는다.
 * "우리 애가 중형견인가?"는 헷갈리는 질문이고, 틀리면 판정이 통째로 어긋난다.
 */
export function toPet(p: PetInput): Pet {
  const kg = Number.isFinite(p.kg) && p.kg > 0 ? p.kg : 1
  const size = sizeOf(kg)
  return {
    key: p.key,
    name: p.name.trim() || '우리 아이',
    breed: p.breed.trim(),
    kg,
    emoji: p.emoji || '🐶',
    photo: p.photo,
    size,
    sizeLabel: SIZE_LABEL[size],
    hasCage: p.hasCage,
    hasMuzzle: p.hasMuzzle,
    isDangerous: isDangerousBreed(p.breed),
  }
}

/**
 * 처음 온 사람에게 보여줄 예시.
 *
 * 빈 화면으로 시작하면 이 서비스가 무엇을 해주는지 알 수 없다. 크기가 크게 다른
 * 둘을 두어, 전환해 보면 판정이 달라진다는 것 자체가 드러나게 한다.
 * 자기 아이를 등록하면 예시는 목록에서 사라진다.
 */
export const SAMPLE_PETS: PetInput[] = [
  { key: 'ruby', name: '루비', breed: '요크셔테리어', kg: 4, emoji: '🐶', photo: '/pets/ruby.jpg', hasCage: true, hasMuzzle: false },
  { key: 'bori', name: '보리', breed: '리트리버', kg: 28, emoji: '🦮', hasCage: false, hasMuzzle: true },
]

export const DEFAULT_PET = 'ruby'

/** 예시로 깔아둔 아이인지 — 내 아이를 등록하면 이들은 목록에서 빠진다 */
export const isSample = (key: string) => SAMPLE_PETS.some((s) => s.key === key)

/** 화면이 고를 수 있게 몇 개만 준다. 아이 사진을 아직 안 넣은 사람을 위한 것 */
export const EMOJIS = ['🐶', '🦮', '🐕', '🐩', '🐾', '🐱', '🐰']

// ── 저장 ──────────────────────────────────────────────

const KEY = 'meongnyang.pets.v1'

export interface Stored {
  pets: PetInput[]
  activeKey: string
}

/**
 * 브라우저 저장은 언제든 실패할 수 있다 — 시크릿 창, 사이트 데이터 차단,
 * 용량 초과. 실패하면 예시로 되돌아가되 화면은 그대로 돌아야 한다.
 */
export function loadPets(): Stored | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Stored
    if (!Array.isArray(v.pets) || v.pets.length === 0) return null
    return v
  } catch {
    return null
  }
}

/** 저장에 실패해도 알리지 않는다 — 이번 세션에서는 계속 쓸 수 있기 때문이다 */
export function savePets(v: Stored) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    // 저장만 못 할 뿐, 화면의 프로필은 살아 있다
  }
}

/** 새 아이의 키. 시각이 아니라 순번을 쓴다 — 서버 렌더와 어긋나지 않게 */
export function nextKey(pets: PetInput[]) {
  let n = 1
  while (pets.some((p) => p.key === `pet${n}`)) n++
  return `pet${n}`
}
