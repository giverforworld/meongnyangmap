'use client'

import { createContext, useContext } from 'react'
import { usePets } from '@/lib/usePets'

/**
 * 프로필 상태를 화면 전체가 하나로 본다.
 *
 * 프로필 버튼이 상단 메뉴(Nav)로 올라가면서, 등록은 Nav 에서 하고 판정은 지도·캠핑
 * 화면이 한다. 각자 usePets() 를 부르면 저장소는 같아도 메모리 상태가 따로 놀아
 * Nav 에서 등록한 아이가 지도에는 새로고침 전까지 안 보인다. 그래서 layout 에서
 * 한 번만 만들고 아래로 내려준다.
 */
type Store = ReturnType<typeof usePets>

const Ctx = createContext<Store | null>(null)

export function PetsProvider({ children }: { children: React.ReactNode }) {
  const store = usePets()
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function usePetsContext(): Store {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePetsContext 는 PetsProvider 안에서만 쓴다')
  return v
}
