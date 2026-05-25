import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';

export function useRoleGuard(allowedRoles: UserRole[]) {
  const { profile, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && profile && !allowedRoles.includes(profile.role)) {
      router.replace('/(tabs)/');
    }
  }, [profile, isAuthenticated, allowedRoles]);
}
