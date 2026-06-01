import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { UserRole } from '@/types'

export function useRoleGuard(allowedRoles: UserRole[]) {
  const router = useRouter()
  const { profile, isLoading, isAuthenticated } = useAuthStore()
  const role = profile?.role ?? null

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      router.replace('/auth')
      return
    }

    if (role && !allowedRoles.includes(role)) {
      router.replace('/(tabs)/')
    }
  }, [role, isLoading, isAuthenticated, allowedRoles])

  return { isAuthorized: role ? allowedRoles.includes(role) : false }
}
