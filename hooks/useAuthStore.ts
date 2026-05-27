import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type Role = 'admin' | 'supervisor' | 'operator'

interface AuthState {
  user: User | null
  role: Role | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  fetchProfile: (userId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  loading: false,

  fetchProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (!error && data) {
      set({ role: data.role })
    }
  },

  signIn: async (email, password) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.user) {
        set({ user: data.user })
        await useAuthStore.getState().fetchProfile(data.user.id)
      }
    } finally {
      set({ loading: false })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, role: null })
  },
}))
