import type { Pet, PetRules } from './types'

/**
 * 전화 확인 도우미 — "뭘 물어봐야 하지"를 없앤다.
 *
 * 우리 아이(체중·종·준비물 보유)와 장소의 빈칸(무엇이 미등록인지)으로 질문 문장을 조립한다.
 * 등록된 것을 되묻지 않는다 — '전 구역 동반 가능'이 적혀 있으면 구역은 안 묻고,
 * 준비물이 적혀 있으면 준비물은 안 묻는다. 그래야 통화가 짧고 상대도 답하기 쉽다.
 */
export function phoneScript(pet: Pet | null, rules: PetRules | null): string {
  const who = pet
    ? `${pet.kg}kg ${pet.sizeLabel}${pet.species === 'cat' ? '(고양이)' : ''}`
    : '반려동물'
  const have: string[] = []
  if (pet) {
    have.push('목줄은 있어요')
    if (pet.hasCage) have.push('이동장도 있어요')
    if (pet.hasMuzzle) have.push('입마개도 있어요')
  }

  const asks: string[] = []
  const cpamKnown = Boolean(rules?.raw.acmpyPsblCpam?.trim()) || rules?.maxKg !== null || Boolean(rules?.allowedSizes)
  if (!cpamKnown) asks.push(`${pet ? `${pet.sizeLabel}도` : '반려동물이'} 같이 들어갈 수 있을까요?`)
  else if (pet && rules?.maxKg !== null && rules?.maxKg !== undefined) asks.push(`${pet.kg}kg인데 체중 기준에 맞는지 확인하고 싶어요.`)

  if (!rules || rules.zone !== 'all') asks.push('실내까지 같이 들어갈 수 있나요, 아니면 어디까지 되나요?')
  if (!rules || rules.needs.length === 0) asks.push('입마개나 이동장이 필요한가요?')
  asks.push('그 밖에 지켜야 할 게 있으면 알려주세요.')

  return `안녕하세요, 반려동물 동반 문의드려요. ${who}이고 ${have.length ? have.join(', ') + '. ' : ''}${asks.join(' ')}`
}
