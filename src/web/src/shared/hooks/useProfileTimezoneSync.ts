import { useEffect } from 'react';
import { useGetProfileQuery } from '../../features/profile/api/profileApi';
import { setCachedTimezone } from '../lib/format';

export function ProfileTimezoneSync() {
  const { data: profile } = useGetProfileQuery();

  useEffect(() => {
    if (profile) {
      setCachedTimezone(profile.timezone);
    }
  }, [profile?.timezone]);

  return null;
}
