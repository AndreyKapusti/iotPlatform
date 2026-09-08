import { useEffect } from 'react';
import { useMediaQuery } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { resolveTheme, type ResolvedTheme } from '../../shared/lib/constants';
import { selectThemePreference, syncSystemTheme } from '../../features/ui/uiSlice';

export function useEffectiveTheme(): ResolvedTheme {
  const preference = useAppSelector(selectThemePreference);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (preference !== 'system') return;
    dispatch(syncSystemTheme());
  }, [preference, systemDark, dispatch]);

  if (preference === 'system') {
    return systemDark ? 'dark' : 'light';
  }
  return resolveTheme(preference);
}
