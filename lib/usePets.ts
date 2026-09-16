'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Pet } from './types'
import { clearPets, loadPets, nextKey, savePets, toPet, type PetInput } from './pets'
import { supabaseBrowser } from './supabaseBrowser'
import { deleteRemotePet, fetchRemotePets, upsertRemotePets } from './petsRemote'

/**
 * 등록한 아이들과 지금 기준이 되는 아이.
 *
 * **등록 전에는 아이가 없다(pet = null).** 그때는 판정을 하지 않고 조건만 보여준다.
 * 예시 아이를 깔아 두지 않는 이유 — 처음 온 사람에게 남의 개 이름이 떠 있으면
 * 그게 내 개인 것처럼 읽히고, "왜 루비 기준이지?"에서 신뢰가 깎인다.
 *
 * 서버 렌더 때는 저장소를 읽을 수 없으므로 빈 채로 시작하고, 마운트 후 실제 값으로
 * 정정한다(useIsMobile 과 같은 방식). 등록 전 화면과 같은 모양이라 깜빡임이 없다.
 *
 * 로그인은 선택이다. 안 하면 브라우저 저장만 쓴다. 하면 계정에 올린 것을 읽고,
 * 고칠 때마다 양쪽에 쓴다.
 */
export function usePets() {
  const [list, setList] = useState<PetInput[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  /** 저장소를 읽기 전인지 */
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  /** 계정에서 프로필을 내려받는 중 */
  const [syncing, setSyncing] = useState(false)

  const listRef = useRef(list)
  listRef.current = list

  // ── 브라우저 저장소
  useEffect(() => {
    const v = loadPets()
    if (v && v.pets.length > 0) {
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
      const mine = listRef.current

      if (remote.length > 0) {
        // 계정에 있는 것이 기준이다 — 다른 기기에서 고친 게 있으면 그게 최신이다
        setList(remote)
        setActiveKey((k) => (k && remote.some((p) => p.key === k) ? k : remote[0].key))
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
    (
      pets: PetInput[],
      key: string | null,
      remoteWrite?: (sb: NonNullable<ReturnType<typeof supabaseBrowser>>) => Promise<void>
    ) => {
      setList(pets)
      setActiveKey(key)
      if (pets.length > 0 && key) savePets({ pets, activeKey: key })
      else clearPets()
      const sb = supabaseBrowser()
      if (sb && session && remoteWrite) remoteWrite(sb).catch(() => {})
    },
    [session]
  )

  const add = useCallback(
    (input: Omit<PetInput, 'key'>) => {
      const key = nextKey(list)
      const pet = { ...input, key }
      persist([...list, pet], key, (sb) => upsertRemotePets(sb, session!.user.id, [pet]))
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
      // 마지막 하나를 지우면 등록 전 상태로 돌아간다 — 판정 없이 조건만 보는 화면
      const nextKeySel = rest.length === 0 ? null : key === activeKey ? rest[0].key : activeKey
      persist(rest, nextKeySel, (sb) => deleteRemotePet(sb, key))
    },
    [list, activeKey, persist, session]
  )

  const select = useCallback((key: string) => persist(list, key), [list, persist])

  // ── 로그인 · 로그아웃
  const signIn = useCallback((provider: 'kakao' | 'google') => {
    const sb = supabaseBrowser()
    if (!sb) return
    const next = window.location.pathname + window.location.search
    sb.auth.signInWithOAuth({
      /**
       * 카카오는 Supabase 내장 provider 를 쓰지 않는다. 내장은 이메일(account_email)을
       * 반드시 요청하는데, 카카오는 비즈 앱(사업자 심사)이 아니면 이메일 동의항목을
       * 못 켠다 → KOE205. 그래서 Supabase 에 'custom:kakao' 라는 OIDC provider 를
       * 따로 만들어 이메일 없이(profile_nickname · profile_image 만) 받는다.
       * 만드는 법은 supabase/kakao-oidc.md.
       */
      provider: provider === 'kakao' ? 'custom:kakao' : provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        // 카카오는 브라우저에 카카오 세션이 남아 있으면 묻지 않고 바로 통과시킨다.
        // 로그아웃했다가 다시 누른 사람은 다시 물어봐 주기를 기대하므로 매번 로그인 화면을 띄운다.
        // 구글도 같은 이유로 매번 계정 선택창 — 계정이 여럿인 사람이 다른 계정으로 들어갈 길이 그것뿐이다.
        // 구글 쪽 설정(콘솔·Supabase)은 supabase/google.md
        queryParams: provider === 'kakao' ? { prompt: 'login' } : { prompt: 'select_account' },
      },
    })
  }, [])

  const signOut = useCallback(async () => {
    const sb = supabaseBrowser()
    if (!sb) return
    await sb.auth.signOut()
    // 계정 것을 이 기기에 남기지 않는다 — 공용 기기일 수 있다
    setList([])
    setActiveKey(null)
    clearPets()
  }, [])

  /** 판정에 쓰는 모양. 크기·맹견 여부는 여기서 계산된다 */
  const pets = useMemo(() => list.map(toPet), [list])
  /** 등록 전이면 null — 화면은 이걸 보고 판정을 건너뛴다 */
  const pet: Pet | null = useMemo(
    () => (activeKey ? pets.find((p) => p.key === activeKey) ?? pets[0] ?? null : null),
    [pets, activeKey]
  )

  return {
    list, pets, pet, activeKey, ready,
    add, update, remove, select,
    session, syncing, signIn, signOut,
  }
}
