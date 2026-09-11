import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import detectraLogo from '../assets/detectra.png'

export default function Welcome({ onEnter }: { onEnter: () => void }) {
  const { user, updateProfile } = useAuth()
  const { isDark } = useTheme()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [photoDataUrl, setPhotoDataUrl] = useState(user?.photoDataUrl)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!user) return null

  function handlePhoto(f: File) {
    const r = new FileReader()
    r.onload = e => setPhotoDataUrl(e.target?.result as string)
    r.readAsDataURL(f)
  }

  function saveProfile() {
    updateProfile({ name, phone, photoDataUrl })
    setEditing(false)
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 shadow-xl bg-white p-8 text-center">
        <img src={detectraLogo} alt="Detectra" className="w-16 h-16 rounded-xl object-contain shadow mx-auto mb-4" />

        {!editing ? (
          <>
            <div className="mb-2">
              {photoDataUrl
                ? <img src={photoDataUrl} alt={user.name} className="w-20 h-20 rounded-full object-cover border border-slate-200 mx-auto" />
                : <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center text-2xl font-bold text-slate-400">
                    {user.name.charAt(0)}
                  </div>
              }
            </div>
            <h1 className="font-black text-xl text-slate-900">Welcome, {user.name}</h1>
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mt-1">
              {user.role}{user.rank ? ` · ${user.rank}` : ''} · {user.department}
            </p>
            <p className="text-xs text-slate-500 mt-1">{user.organization} · {user.region}</p>

            <button onClick={onEnter}
              className="w-full mt-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-colors">
              Enter Platform
            </button>
            <button onClick={() => setEditing(true)}
              className="w-full mt-2 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium text-xs transition-colors">
              Edit Profile
            </button>
          </>
        ) : (
          <div className="text-left">
            <div className="flex flex-col items-center mb-4">
              {photoDataUrl
                ? <img src={photoDataUrl} alt={name} className="w-20 h-20 rounded-full object-cover border border-slate-200" />
                : <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl font-bold text-slate-400">
                    {name.charAt(0) || '?'}
                  </div>
              }
              <button onClick={() => fileRef.current?.click()}
                className="mt-2 text-xs font-medium text-amber-500 hover:underline">
                Change photo
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
            </div>

            <label className="block text-xs font-medium text-slate-500 mb-1">Full name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none mb-3 focus:border-amber-500" />

            <label className="block text-xs font-medium text-slate-500 mb-1">Phone number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 98765 43210"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none mb-4 focus:border-amber-500" />

            <div className="flex items-center gap-2">
              <button onClick={saveProfile}
                className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-colors">
                Save
              </button>
              <button onClick={() => setEditing(false)}
                className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
