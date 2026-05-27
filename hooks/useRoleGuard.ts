import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/hooks/useAuthStore'

type Role = 'admin' | 'supervisor' | 'operator'

export function useRoleGuard(allowedRoles: Role[]) {
  const router = useRouter()
  const { role, loading } = useAuthStore()

  useEffect(() => {
    if (loading) return

    if (role && !allowedRoles.includes(role)) {
      router.replace('/(tabs)/')
    }
  }, [role, loading, allowedRoles])

  return { isAuthorized: role ? allowedRoles.includes(role) : false }
}
