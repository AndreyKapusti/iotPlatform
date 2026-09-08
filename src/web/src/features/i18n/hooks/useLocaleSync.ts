import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { selectLocale, setLocale } from '../../ui/uiSlice';
import { changeAppLocale } from '../config';
import type { Locale } from '../../../shared/lib/constants';

export function useLocaleSync() {
  const locale = useAppSelector(selectLocale);
  const dispatch = useAppDispatch();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== locale) {
      changeAppLocale(locale);
    }
  }, [locale, i18n]);

  const updateLocale = (next: Locale) => {
    dispatch(setLocale(next));
    changeAppLocale(next);
  };

  return { locale, setLocale: updateLocale };
}
