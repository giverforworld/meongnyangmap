'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Pet } from './types'
import {
  DEFAULT_PET, SAMPLE_PETS, isSample, loadPets, nextKey, savePets, toPet,
  type PetInput,
} from './pets'

/**
 * 등록한 아이들과 지금 기준이 되는 아이.
 *
 * 서버 렌더 때는 저장소를 읽을 수 없으므로 예시로 시작하고, 마운트 후 실제 값으로
 * 정정한다(useIsMobile 과 같은 방식). 그 사이 화면이 깜빡이지 않도록 예시도
 * 정상적인 프로필이라 판정이 곧바로 돈다.
 */
export function usePets() {
  const [list, setList] = useState<PetInput[]>(SAMPLE_PETS)
  const [activeKey, setActiveKey] = useState(DEFAULT_PET)
  /** 저장소를 읽기 전인지. 등록 안내를 성급히 띄우지 않으려고 본다 */
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const v = loadPets()
    if (v) {
      setList(v.pets)
      setActiveKey(v.pets.some((p) => p.key === v.activeKey) ? v.activeKey : v.pets[0].key)
    }
    setReady(true)
  }, [])

  /** 저장은 실제 등록이 있을 때만 한다 — 예시만 있는 상태를 굳힐 이유가 없다 */
  const persist = useCallback((pets: PetInput[], key: string) => {
    setList(pets)
    setActiveKey(key)
    if (pets.some((p) => !isSample(p.key))) savePets({ pets, activeKey: key })
  }, [])

  const add = useCallback(
    (input: Omit<PetInput, 'key'>) => {
      // 첫 등록이면 예시를 걷어낸다. 남겨 두면 내 아이와 남의 아이가 섞인다
      const base = list.filter((p) => !isSample(p.key))
      const key = nextKey(base)
      persist([...base, { ...input, key }], key)
      return key
    },
    [list, persist]
  )

  const update = useCallback(
    (key: string, input: Omit<PetInput, 'key'>) => {
      persist(
        list.map((p) => (p.key === key ? { ...input, key } : p)),
        activeKey
      )
    },
    [list, activeKey, persist]
  )

  const remove = useCallback(
    (key: string) => {
      const rest = list.filter((p) => p.key !== key)
      // 마지막 하나를 지우면 예시로 되돌린다. 빈 목록은 판정할 기준이 없다
      if (rest.length === 0) {
        setList(SAMPLE_PETS)
        setActiveKey(DEFAULT_PET)
        savePets({ pets: SAMPLE_PETS, activeKey: DEFAULT_PET })
        return
      }
      persist(rest, key === activeKey ? rest[0].key : activeKey)
    },
    [list, activeKey, persist]
  )

  const select = useCallback(
    (key: string) => persist(list, key),
    [list, persist]
  )

  /** 판정에 쓰는 모양. 크기·맹견 여부는 여기서 계산된다 */
  const pets = useMemo(() => list.map(toPet), [list])
  const pet: Pet = useMemo(
    () => pets.find((p) => p.key === activeKey) ?? pets[0],
    [pets, activeKey]
  )

  /** 예시만 있는지 — "내 아이를 등록해 보세요"를 띄울지 판단한다 */
  const onlySamples = useMemo(() => list.every((p) => isSample(p.key)), [list])

  return { list, pets, pet, activeKey, ready, onlySamples, add, update, remove, select }
}
