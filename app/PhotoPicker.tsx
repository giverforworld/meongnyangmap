'use client'

import { useRef, useState } from 'react'
import { uploadPhoto } from '@/lib/photo'

/**
 * 사진 붙이기 — 게시글과 리뷰가 같이 쓴다.
 * 고르는 즉시 올리고 URL 만 부모에게 준다. 글을 올릴 때 사진까지 같이 기다리게 하지 않는다.
 */
export default function PhotoPicker({
  photos, onChange, max = 4,
}: {
  photos: string[]
  onChange: (next: string[]) => void
  max?: number
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState('')

  async function pick(files: FileList | null) {
    if (!files || files.length === 0) return
    setError('')
    const room = max - photos.length
    const list = Array.from(files).slice(0, room)
    if (list.length < files.length) setError(`사진은 ${max}장까지 붙일 수 있어요`)
    setBusy((n) => n + list.length)
    // 순서대로 올린다 — 고른 순서가 보이는 순서다
    let next = photos
    for (const f of list) {
      try {
        const url = await uploadPhoto(f)
        next = [...next, url]
        onChange(next)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy((n) => n - 1)
      }
    }
    if (input.current) input.current.value = ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {photos.map((u, i) => (
          <div key={u} style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', border: '1px solid #EAE3D6', flex: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`사진 ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <button type="button" onClick={() => onChange(photos.filter((x) => x !== u))} aria-label="사진 빼기"
              style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(43,36,32,.72)', color: '#FFFFFF', fontSize: 11, lineHeight: 1, cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <div key={`b${i}`} style={{ width: 72, height: 72, borderRadius: 10, border: '1px dashed #E3DCCE', background: '#FAF8F3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#B3A78F', flex: 'none' }}>
            올리는 중…
          </div>
        ))}
        {photos.length + busy < max && (
          <button type="button" onClick={() => input.current?.click()}
            style={{ width: 72, height: 72, borderRadius: 10, border: '1.5px dashed #D8CFBE', background: '#FFFFFF', color: '#8A7A65', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, lineHeight: 1.3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, flex: 'none' }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>＋</span>
            사진 {photos.length}/{max}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
      {error && <span style={{ fontSize: 12, color: '#C0392B' }}>{error}</span>}
    </div>
  )
}
