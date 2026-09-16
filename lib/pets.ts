import type { Pet, PetSize, Species } from './types'
import { isDangerousBreed, sizeOf } from './petTour'

/**
 * 판정 기준이 되는 반려동물 프로필.
 *
 * 지도(app/page.tsx)와 캠핑·핫플레이스(app/hotplace)가 같은 기준으로 판정해야 하므로
 * 여기 둔다. 화면마다 따로 들고 있으면 한쪽만 고쳐져 같은 장소가 다르게 뜬다.
 *
 * **등록 전에는 프로필이 없다.** 예시 아이를 깔아 두지 않는다 — 처음 온 사람에게
 * "루비 · 요크셔테리어" 가 떠 있으면 남의 개가 내 개인 것처럼 읽힌다. 프로필이 없으면
 * 판정을 하지 않고 조건만 보여준다. 등록하는 순간부터 그 아이 기준으로 거른다.
 *
 * 프로필은 브라우저에 저장한다. 로그인하면 계정에도 올라가 다른 기기에서 같이 쓴다.
 */

const SIZE_LABEL: Record<Species, Record<PetSize, string>> = {
  dog: { small: '소형견', medium: '중형견', large: '대형견' },
  cat: { small: '소형묘', medium: '중형묘', large: '대형묘' },
}

export const sizeLabelOf = (species: Species, size: PetSize) => SIZE_LABEL[species][size]

/**
 * 사람이 채우는 것만 받는다. 크기는 무게에서 나온다.
 *
 * 견종은 묻지 않는다 — 개일 수도 고양이일 수도 있고, 견종에서 얻던 것은 맹견 여부
 * 하나뿐이었다. 그건 체크 하나로 직접 받는다(dangerous).
 */
export interface PetInput {
  key: string
  name: string
  /** 없으면 강아지 — 이 항목이 생기기 전 저장본 */
  species?: Species
  kg: number
  emoji: string
  photo?: string
  hasCage: boolean
  hasMuzzle: boolean
  /** 동물보호법 맹견 5종(과 그 잡종)인지. 맹견을 막는 곳은 불가로 판정한다 */
  dangerous: boolean
}

/**
 * 입력을 판정에 쓰는 프로필로 바꾼다.
 * 크기는 무게로 정한다 — 사람에게 묻지 않는다.
 * "우리 애가 중형견인가?"는 헷갈리는 질문이고, 틀리면 판정이 통째로 어긋난다.
 */
export function toPet(p: PetInput): Pet {
  const kg = Number.isFinite(p.kg) && p.kg > 0 ? p.kg : 1
  const size = sizeOf(kg)
  const species: Species = p.species === 'cat' ? 'cat' : 'dog'
  return {
    key: p.key,
    name: p.name.trim() || '우리 아이',
    species,
    kg,
    emoji: p.emoji || (species === 'cat' ? '🐱' : '🐶'),
    photo: p.photo,
    size,
    sizeLabel: sizeLabelOf(species, size),
    hasCage: p.hasCage,
    hasMuzzle: p.hasMuzzle,
    // 맹견은 개 이야기다
    isDangerous: species === 'dog' && Boolean(p.dangerous),
  }
}

/**
 * 고를 수 있는 아이콘. 저장은 이모지 한 글자만 하고(pets 표 emoji 컬럼, 4자 제한),
 * 배경색은 여기서 다시 찾는다 — 그래서 색을 바꿔도 저장된 데이터는 손댈 게 없다.
 * 화면에는 이모지 글자가 아니라 직접 그린 얼굴(app/PetFace.tsx)이 뜬다.
 */
export const AVATARS: { emoji: string; label: string; bg: string }[] = [
  { emoji: '🐶', label: '강아지', bg: '#FFE0D3' },
  { emoji: '🐱', label: '고양이', bg: '#FFF1C2' },
  { emoji: '🐰', label: '토끼', bg: '#FADDE6' },
  { emoji: '🐹', label: '햄스터', bg: '#FCE9C8' },
  { emoji: '🐼', label: '판다', bg: '#E3ECF7' },
]

/** 목록에 없는 이모지(예전 저장값)도 기본 색으로는 그려진다 */
export const avatarBg = (emoji: string) =>
  AVATARS.find((a) => a.emoji === emoji)?.bg ?? AVATARS[0].bg

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
    if (!Array.isArray(v.pets)) return null
    // 견종을 받던 때 저장본에는 dangerous 가 없다. 그때 견종으로 판단하던 것을 한 번 옮긴다
    v.pets = v.pets.map((p) => {
      const legacy = (p as PetInput & { breed?: string }).breed ?? ''
      return { ...p, dangerous: Boolean(p.dangerous) || isDangerousBreed(legacy) }
    })
    return v
  } catch {
    return null
  }
}

export function clearPets() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {}
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
