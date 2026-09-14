'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Pet } from './types'
import {
  DEFAULT_PET, SAMPLE_PETS, isSample, loadPets, nextKey, savePets, toPet,
  type PetInput,
} from './pets'
import { supabaseBrowser } from './supabaseBrowser'
import { deleteRemotePet, fetchRemotePets, upsertRemotePets } from './petsRemote'

/**
 * 등록한 아이들과 지금 기준이 되는 아이.
 *
 * 서버 렌더 때는 저장소를 읽을 수 없으므로 예시로 시작하고, 마운트 후 실제 값으로
 * 정정한다(useIsMobile 과 같은 방식). 그 사이 화면이 깜빡이지 않도록 예시도
 * 정상적인 프로필이라 판정이 곧바로 돈다.
 *
 * 로그인은 선택이다. 안 하면 브라우저 저장만 쓴다. 하면 계정에 올린 것을 읽고,
 * 고칠 때마다 양쪽에 쓴다. 브라우저 저장은 로그인해도 계속 유지한다 —
 * 네트워크가 끊겨도 마지막 상태로 판정할 수 있어야 한다.
 */
export function usePets() {
  const [list, setList] = useState<PetInput[]>(SAMPLE_PETS)
  const [activeKey, setActiveKey] = useState(DEFAULT_PET)
  /** 저장소를 읽기 전인지. 등록 안내를 성급히 띄우지 않으려고 본다 */
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  /** 계정에서 프로필을 내려받는 중 — 그동안 화면은 브라우저 저장본으로 돈다 */
  const [syncing, setSyncing] = useState(false)

  // 콜백 안에서 최신 목록을 보려고 ref 로도 든다
  const listRef = useRef(list)
  listRef.current = list

  // ── 브라우저 저장소
  useEffect(() => {
    const v = loadPets()
    if (v) {
      setList(v.pets)
      setActiveKey(v.pets.some((p) => p.key === v.activeKey) ? v.activeKey : v.pets[0].key)
    }
    setReady(true)
  }, [])

  // ── 로그인 상태
  useEffect(() => {
    const sb = supabaseBrowser()
    if (!sb) return
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // ── 로그인하면 계정과 맞춘다
  useEffect(() => {
    const sb = supabaseBrowser()
    if (!sb || !session) return
    let alive = true
    setSyncing(true)
    ;(async () => {
      const remote = await fetchRemotePets(sb)
      if (!alive || remote === null) return
      const mine = listRef.current.filter((p) => !isSample(p.key))

      if (remote.length > 0) {
        // 계정에 있는 것이 기준이다. 이 기기 것은 덮어쓴다 —
        // 다른 기기에서 고친 게 있으면 그게 최신이기 때문이다
        setList(remote)
        setActiveKey((k) => (remote.some((p) => p.key === k) ? k : remote[0].key))
        savePets({ pets: remote, activeKey: remote[0].key })
      } else if (mine.length > 0) {
        // 첫 로그인 — 이 기기에서 등록해 둔 아이를 계정으로 올린다
        await upsertRemotePets(sb, session.user.id, mine)
      }
    })().finally(() => alive && setSyncing(false))
    return () => { alive = false }
  }, [session])

  /** 브라우저에 저장하고, 로그인돼 있으면 계정에도 쓴다 */
  const persist = useCallback(
    (pets: PetInput[], key: string, remoteWrite?: (sb: NonNullable<ReturnType<typeof supabaseBrowser>>) => Promise<void>) => {
      setList(pets)
      setActiveKey(key)
      // 예시만 있는 상태는 굳히지 않는다
      if (pets.some((p) => !isSample(p.key))) savePets({ pets, activeKey: key })
      const sb = supabaseBrowser()
      if (sb && session && remoteWrite) remoteWrite(sb).catch(() => {})
    },
    [session]
  )

  const add = useCallback(
    (input: Omit<PetInput, 'key'>) => {
      // 첫 등록이면 예시를 걷어낸다. 남겨 두면 내 아이와 남의 아이가 섞인다
      const base = list.filter((p) => !isSample(p.key))
      const key = nextKey(base)
      const pet = { ...input, key }
      persist([...base, pet], key, (sb) => upsertRemotePets(sb, session!.user.id, [pet]))
      return key
    },
    [list, persist, session]
  )

  const update = useCallback(
    (key: string, input: Omit<PetInput, 'key'>) => {
      const pet = { ...input, key }
      persist(
        list.map((p) => (p.key === key ? pet : p)),
        activeKey,
        (sb) => upsertRemotePets(sb, session!.user.id, [pet])
      )
    },
    [list, activeKey, persist, session]
  )

  const remove = useCallback(
    (key: string) => {
      const rest = list.filter((p) => p.key !== key)
      // 마지막 하나를 지우면 예시로 되돌린다. 빈 목록은 판정할 기준이 없다
      if (rest.length === 0) {
        setList(SAMPLE_PETS)
        setActiveKey(DEFAULT_PET)
        savePets({ pets: SAMPLE_PETS, activeKey: DEFAULT_PET })
        const sb = supabaseBrowser()
        if (sb && session) deleteRemotePet(sb, key).catch(() => {})
        return
      }
      persist(rest, key === activeKey ? rest[0].key : activeKey, (sb) => deleteRemotePet(sb, key))
    },
    [list, activeKey, persist, session]
  )

  const select = useCallback((key: string) => persist(list, key), [list, persist])

  // ── 로그인 · 로그아웃
  const signIn = useCallback((provider: 'kakao' | 'google') => {
    const sb = supabaseBrowser()
    if (!sb) return
    // 로그인 끝나면 지금 보던 화면으로 돌아온다
    const next = window.location.pathname + window.location.search
    sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
  }, [])

  const signOut = useCallback(async () => {
    const sb = supabaseBrowser()
    if (!sb) return
    await sb.auth.signOut()
    // 계정 것을 이 기기에 남기지 않는다 — 공용 기기일 수 있다
    setList(SAMPLE_PETS)
    setActiveKey(DEFAULT_PET)
    savePets({ pets: SAMPLE_PETS, activeKey: DEFAULT_PET })
  }, [])

  /** 판정에 쓰는 모양. 크기·맹견 여부는 여기서 계산된다 */
  const pets = useMemo(() => list.map(toPet), [list])
  const pet: Pet = useMemo(
    () => pets.find((p) => p.key === activeKey) ?? pets[0],
    [pets, activeKey]
  )

  /** 예시만 있는지 — "내 아이를 등록해 보세요"를 띄울지 판단한다 */
  const onlySamples = useMemo(() => list.every((p) => isSample(p.key)), [list])

  return {
    list, pets, pet, activeKey, ready, onlySamples,
    add, update, remove, select,
    session, syncing, signIn, signOut,
  }
}
