import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';

export function useRoleGuard(allowedRoles: UserRole[]) {
  const { user } = useAuthStore();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // If auth state is still loading, wait
    if (user === null) {
      // Assuming store might initialize null. We should check if we know they are definitively not logged in, but let's just wait until they are defined or we have a more robust initialized state check.
      // But typically, user is undefined if not loaded from async storage, or null if definitely logged out. Let's assume the auth layer handles logging out by redirecting to /auth.
      // We'll proceed assuming user is populated if they are logged in.
    }
    
    if (user && user.role) {
      if (allowedRoles.includes(user.role)) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        // Kick them back to dashboard
        router.replace('/(tabs)/');
      }
    }
  }, [user, allowedRoles]);

  return { isAuthorized, user };
}
