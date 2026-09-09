'use client'

import { useEffect, useState } from 'react'
import type { Pet } from '@/lib/types'
import { EMOJIS, isSample, type PetInput } from '@/lib/pets'
import { isDangerousBreed, sizeOf } from '@/lib/petTour'

/**
 * 프로필 칩과 등록 화면.
 *
 * 지도와 핫플레이스가 같은 것을 쓴다 — 한쪽에서 등록한 아이가 다른 쪽에서 안 보이면
 * "우리 아이 기준"이라는 말이 무너진다.
 *
 * 크기와 맹견 여부는 묻지 않고 무게·견종에서 계산한다. "우리 애가 중형견인가?"는
 * 사람마다 답이 갈리는 질문이고, 틀리면 판정이 통째로 어긋난다.
 */

const SIZE_LABEL = { small: '소형견', medium: '중형견', large: '대형견' } as const

const field: React.CSSProperties = {
  font: 'inherit',
  fontSize: 14.5,
  padding: '10px 12px',
  borderRadius: 12,
  border: '1.5px solid #EAE3D6',
  background: '#FFFFFF',
  color: '#2B2420',
  outline: 'none',
  width: '100%',
}

interface Props {
  pet: Pet
  pets: Pet[]
  list: PetInput[]
  activeKey: string
  onlySamples: boolean
  onSelect: (key: string) => void
  onAdd: (input: Omit<PetInput, 'key'>) => void
  onUpdate: (key: string, input: Omit<PetInput, 'key'>) => void
  onRemove: (key: string) => void
  /** 지도 위에 얹을 때는 작게 */
  compact?: boolean
}

export default function PetSwitch({
  pet, pets, list, activeKey, onlySamples,
  onSelect, onAdd, onUpdate, onRemove, compact = false,
}: Props) {
  const [open, setOpen] = useState(false)
  /** 편집 중인 아이의 key. 'new' 면 새로 등록 */
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <>
      <button
        className="hov-accent"
        onClick={() => setOpen(true)}
        title="우리 아이 기준으로 판정해요 — 눌러서 등록하거나 바꾸기"
        style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 10, background: compact ? 'rgba(255,255,255,.96)' : '#FFF4EF', border: '1.5px solid #F3C9BB', borderRadius: 99, padding: compact ? '6px 14px 6px 6px' : '7px 16px 7px 9px', cursor: 'pointer', fontFamily: 'inherit', fontSize: compact ? 14 : 15, color: '#2B2420', boxShadow: compact ? '0 3px 12px rgba(43,36,32,.16)' : 'none' }}
      >
        <Avatar pet={pet} size={compact ? 30 : 34} />
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
          <span style={{ fontWeight: 700 }}>
            {pet.name}{compact ? '' : pet.breed ? ` · ${pet.breed}` : ''}
          </span>
          <span style={{ fontSize: compact ? 11.5 : 12.5, color: '#A08872' }}>
            {pet.kg}kg · {pet.sizeLabel}{compact ? ' ▾' : ' · 우리 아이 등록 ▾'}
          </span>
        </span>
      </button>

      {open && (
        <div
          onClick={() => { setOpen(false); setEditing(null) }}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(43,36,32,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="반려동물 프로필"
            style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 420, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 16px 48px rgba(43,36,32,.24)' }}
          >
            <header style={{ flex: 'none', padding: '18px 20px 12px', borderBottom: '1px solid #F1EBE0', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <span className="jua" style={{ fontSize: 20 }}>
                {editing ? (editing === 'new' ? '우리 아이 등록' : '프로필 고치기') : '누구랑 갈까요?'}
              </span>
              <button
                onClick={() => (editing ? setEditing(null) : setOpen(false))}
                aria-label={editing ? '뒤로' : '닫기'}
                style={{ border: 'none', background: 'none', fontSize: 15, color: '#A08872', cursor: 'pointer', padding: 4 }}
              >
                {editing ? '← 뒤로' : '✕'}
              </button>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 20px' }}>
              {editing ? (
                <PetForm
                  initial={editing === 'new' ? null : list.find((p) => p.key === editing) ?? null}
                  onCancel={() => setEditing(null)}
                  onSave={(input) => {
                    if (editing === 'new') onAdd(input)
                    else onUpdate(editing, input)
                    setEditing(null)
                  }}
                />
              ) : (
                <>
                  {onlySamples && (
                    <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.6, color: '#8A6208', background: '#FBF3DD', border: '1.5px solid #F0D9A0', borderRadius: 12, padding: '10px 13px' }}>
                      지금은 <b>예시 프로필</b>로 판정하고 있어요.
                      우리 아이를 등록하면 그 아이 기준으로 다시 판정해요.
                    </p>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pets.map((p) => {
                      const on = p.key === activeKey
                      return (
                        <div
                          key={p.key}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF6F2' : '#FFFFFF', borderRadius: 14, padding: '10px 12px' }}
                        >
                          <button
                            onClick={() => { onSelect(p.key); setOpen(false) }}
                            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                          >
                            <Avatar pet={p} size={38} />
                            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: '#2B2420' }}>
                                {p.name}
                                {isSample(p.key) && (
                                  <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: '#A08872' }}>예시</span>
                                )}
                              </span>
                              <span style={{ fontSize: 12.5, color: '#A08872', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.kg}kg · {p.sizeLabel}
                                {p.breed && ` · ${p.breed}`}
                                {p.isDangerous && <b style={{ color: '#C0392B' }}> · 맹견</b>}
                              </span>
                            </span>
                          </button>

                          {!isSample(p.key) && (
                            <>
                              <button
                                onClick={() => setEditing(p.key)}
                                style={{ flex: 'none', fontFamily: 'inherit', fontSize: 12.5, color: '#6E5F4D', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                              >
                                고치기
                              </button>
                              <button
                                onClick={() => onRemove(p.key)}
                                aria-label={`${p.name} 지우기`}
                                style={{ flex: 'none', fontFamily: 'inherit', fontSize: 13, color: '#C4B8A4', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <button
                    className="btn-primary"
                    onClick={() => setEditing('new')}
                    style={{ width: '100%', marginTop: 12, fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, padding: '12px 0', borderRadius: 14, border: 'none', background: '#E85D3D', color: '#FFFFFF', cursor: 'pointer' }}
                  >
                    + 우리 아이 등록
                  </button>

                  <p style={{ margin: '12px 2px 0', fontSize: 11.5, lineHeight: 1.6, color: '#B3A78F' }}>
                    프로필은 이 기기에만 저장돼요. 서버로 보내지 않아요.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Avatar({ pet, size }: { pet: Pet; size: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, background: '#FFE0D3', borderRadius: '50%', fontSize: size * 0.52, overflow: 'hidden', flex: 'none' }}>
      {pet.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pet.photo} alt="" width={size} height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          // 사진이 없거나 깨졌으면 이모지로 되돌린다
          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.textContent = pet.emoji }}
        />
      ) : pet.emoji}
    </span>
  )
}

/** 등록·수정 폼. 크기와 맹견 여부는 입력받지 않고 보여주기만 한다 */
function PetForm({
  initial, onSave, onCancel,
}: {
  initial: PetInput | null
  onSave: (input: Omit<PetInput, 'key'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [breed, setBreed] = useState(initial?.breed ?? '')
  const [kg, setKg] = useState(initial ? String(initial.kg) : '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🐶')
  const [hasCage, setHasCage] = useState(initial?.hasCage ?? false)
  const [hasMuzzle, setHasMuzzle] = useState(initial?.hasMuzzle ?? false)
  const [error, setError] = useState('')

  // 무게를 고치면 크기가 바로 따라 움직이는 것을 보여준다
  const weight = Number(kg)
  const valid = name.trim().length > 0 && Number.isFinite(weight) && weight > 0 && weight <= 120
  const size = valid ? sizeOf(weight) : null
  const dangerous = isDangerousBreed(breed)

  useEffect(() => setError(''), [name, kg])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return setError('이름을 적어주세요')
        if (!Number.isFinite(weight) || weight <= 0) return setError('몸무게를 숫자로 적어주세요')
        if (weight > 120) return setError('몸무게를 다시 확인해주세요')
        onSave({ name, breed, kg: weight, emoji, hasCage, hasMuzzle })
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>이름</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoFocus
          placeholder="우리 아이 이름" style={field} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>견종 <span style={{ fontWeight: 500, color: '#B3A78F' }}>· 몰라도 괜찮아요</span></span>
        <input value={breed} onChange={(e) => setBreed(e.target.value)} maxLength={30}
          placeholder="예: 요크셔테리어, 믹스" style={field} />
        {dangerous && (
          <span style={{ fontSize: 12, color: '#C0392B', lineHeight: 1.5 }}>
            법정 맹견으로 읽혔어요. 맹견 동반을 막는 곳은 불가로 판정하고,
            입마개가 필요한 곳은 그렇게 알려드려요.
          </span>
        )}
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>몸무게</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input value={kg} onChange={(e) => setKg(e.target.value.replace(/[^0-9.]/g, ''))}
            inputMode="decimal" placeholder="4" style={{ ...field, width: 110 }} />
          <span style={{ fontSize: 14.5, color: '#6E5F4D' }}>kg</span>
          {size && (
            <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: '#E85D3D', background: '#FFF4EF', border: '1.5px solid #F3C9BB', borderRadius: 99, padding: '4px 12px' }}>
              {SIZE_LABEL[size]}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11.5, color: '#B3A78F' }}>
          몸무게로 크기를 정해요 — 10kg 미만 소형견 · 25kg 미만 중형견 · 그 이상 대형견
        </span>
      </label>

      <fieldset style={{ border: '1.5px solid #EFE8DA', borderRadius: 12, padding: '10px 13px 12px', margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend style={{ fontSize: 13, fontWeight: 700, padding: '0 6px' }}>챙길 수 있는 것</legend>
        {([
          ['이동장(켄넬)', hasCage, setHasCage, '이동장이 있어야 들어갈 수 있는 곳이 있어요'],
          ['입마개', hasMuzzle, setHasMuzzle, '대형견·맹견에게 요구하는 곳이 있어요'],
        ] as const).map(([label, on, set, hint]) => (
          <label key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
            <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)}
              style={{ marginTop: 3, width: 17, height: 17, accentColor: '#E85D3D', flex: 'none' }} />
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 14 }}>{label}</span>
              <span style={{ fontSize: 11.5, color: '#B3A78F' }}>{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>아이콘</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => setEmoji(e)}
              aria-label={`아이콘 ${e}`}
              style={{ width: 40, height: 40, fontSize: 19, borderRadius: 12, cursor: 'pointer', background: emoji === e ? '#FFF4EF' : '#FFFFFF', border: `1.5px solid ${emoji === e ? '#E85D3D' : '#EFE8DA'}` }}>
              {e}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ margin: 0, fontSize: 13, color: '#C0392B' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
        <button type="button" onClick={onCancel}
          style={{ flex: 'none', fontFamily: 'inherit', fontSize: 14, padding: '12px 18px', borderRadius: 14, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
          취소
        </button>
        <button type="submit" className="btn-primary" disabled={!valid}
          style={{ flex: 1, fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, padding: '12px 0', borderRadius: 14, border: 'none', background: valid ? '#E85D3D' : '#E3DCCE', color: '#FFFFFF', cursor: valid ? 'pointer' : 'default' }}>
          {initial ? '저장' : '등록하고 이 아이 기준으로 보기'}
        </button>
      </div>
    </form>
  )
}
