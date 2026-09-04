import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError, getProfile, updateProfile } from '../api/client';
import { useToast } from '../hooks/useToast';
import type { UserProfile, UserProfileUpdate } from '../types';

const TIMEZONE_OPTIONS = [
  { value: '', label: '— не выбран —' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (МСК)' },
  { value: 'Europe/Kaliningrad', label: 'Europe/Kaliningrad' },
  { value: 'Europe/Samara', label: 'Europe/Samara' },
  { value: 'Asia/Yekaterinburg', label: 'Asia/Yekaterinburg' },
  { value: 'Asia/Omsk', label: 'Asia/Omsk' },
  { value: 'Asia/Krasnoyarsk', label: 'Asia/Krasnoyarsk' },
  { value: 'Asia/Irkutsk', label: 'Asia/Irkutsk' },
  { value: 'Asia/Yakutsk', label: 'Asia/Yakutsk' },
  { value: 'Asia/Vladivostok', label: 'Asia/Vladivostok' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai' },
];

interface ProfileForm {
  email: string;
  username: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  birth_date: string;
  phone: string;
  organization: string;
  job_title: string;
  timezone: string;
}

function profileToForm(profile: UserProfile): ProfileForm {
  return {
    email: profile.email,
    username: profile.username,
    last_name: profile.last_name ?? '',
    first_name: profile.first_name ?? '',
    middle_name: profile.middle_name ?? '',
    birth_date: profile.birth_date ?? '',
    phone: profile.phone ?? '',
    organization: profile.organization ?? '',
    job_title: profile.job_title ?? '',
    timezone: profile.timezone ?? '',
  };
}

function optionalString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function buildPatch(form: ProfileForm): UserProfileUpdate {
  return {
    email: form.email.trim(),
    last_name: optionalString(form.last_name),
    first_name: optionalString(form.first_name),
    middle_name: optionalString(form.middle_name),
    birth_date: form.birth_date === '' ? null : form.birth_date,
    phone: optionalString(form.phone),
    organization: optionalString(form.organization),
    job_title: optionalString(form.job_title),
    timezone: form.timezone === '' ? null : form.timezone,
  };
}

function profileInitials(form: Pick<ProfileForm, 'first_name' | 'last_name' | 'username'>): string {
  const first = form.first_name.trim();
  const last = form.last_name.trim();
  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  if (first) return first.slice(0, 2).toUpperCase();
  if (last) return last.slice(0, 2).toUpperCase();
  return form.username.slice(0, 2).toUpperCase();
}

function isBirthDateInFuture(value: string): boolean {
  if (!value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const birth = new Date(`${value}T00:00:00`);
  return birth > today;
}

export function ProfilePage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const profile = await getProfile();
        if (!cancelled) {
          setForm(profileToForm(profile));
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : 'Не удалось загрузить профиль');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const initials = useMemo(
    () => (form ? profileInitials(form) : ''),
    [form?.first_name, form?.last_name, form?.username],
  );

  const updateField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setFieldError(null);
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;

    const email = form.email.trim();
    if (!email) {
      setFieldError('Email обязателен');
      return;
    }
    if (isBirthDateInFuture(form.birth_date)) {
      setFieldError('Дата рождения не может быть в будущем');
      return;
    }

    setFieldError(null);
    setSaving(true);
    try {
      const updated = await updateProfile(buildPatch(form));
      setForm(profileToForm(updated));
      toast.success('Профиль сохранён');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Не удалось сохранить профиль';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Профиль</h1>
        </div>
        <p className="muted">Загрузка…</p>
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Профиль</h1>
        </div>
        <div className="alert alert-error">{loadError ?? 'Профиль недоступен'}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Профиль</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Личные данные и контактная информация
          </p>
        </div>
      </div>

      <section className="card settings-section profile-section">
        <div className="profile-header">
          <div className="profile-avatar" aria-hidden>
            {initials}
          </div>
          <div>
            <h2 className="settings-section-title">Личные данные</h2>
            <p className="muted settings-section-desc profile-section-desc">
              ФИО, дата рождения и контакты сохраняются в вашем аккаунте.
            </p>
          </div>
        </div>

        <form className="profile-form" onSubmit={submit}>
          <div className="profile-form-grid">
            <label className="field">
              <span className="field-label">Фамилия</span>
              <input
                className="input"
                type="text"
                value={form.last_name}
                onChange={(e) => updateField('last_name', e.target.value)}
                maxLength={100}
                autoComplete="family-name"
              />
            </label>

            <label className="field">
              <span className="field-label">Имя</span>
              <input
                className="input"
                type="text"
                value={form.first_name}
                onChange={(e) => updateField('first_name', e.target.value)}
                maxLength={100}
                autoComplete="given-name"
              />
            </label>

            <label className="field">
              <span className="field-label">Отчество</span>
              <input
                className="input"
                type="text"
                value={form.middle_name}
                onChange={(e) => updateField('middle_name', e.target.value)}
                maxLength={100}
                autoComplete="additional-name"
              />
            </label>

            <label className="field">
              <span className="field-label">Дата рождения</span>
              <input
                className="input"
                type="date"
                value={form.birth_date}
                onChange={(e) => updateField('birth_date', e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field-label">Email</span>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
                autoComplete="email"
              />
            </label>

            <label className="field">
              <span className="field-label">Логин</span>
              <input
                className="input"
                type="text"
                value={form.username}
                disabled
                readOnly
                aria-readonly="true"
              />
            </label>

            <label className="field">
              <span className="field-label">Телефон</span>
              <input
                className="input"
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                maxLength={32}
                autoComplete="tel"
              />
            </label>

            <label className="field">
              <span className="field-label">Организация</span>
              <input
                className="input"
                type="text"
                value={form.organization}
                onChange={(e) => updateField('organization', e.target.value)}
                maxLength={200}
                autoComplete="organization"
              />
            </label>

            <label className="field">
              <span className="field-label">Должность</span>
              <input
                className="input"
                type="text"
                value={form.job_title}
                onChange={(e) => updateField('job_title', e.target.value)}
                maxLength={120}
                autoComplete="organization-title"
              />
            </label>

            <label className="field">
              <span className="field-label">Часовой пояс</span>
              <select
                className="select"
                value={form.timezone}
                onChange={(e) => updateField('timezone', e.target.value)}
              >
                {TIMEZONE_OPTIONS.map((option) => (
                  <option key={option.value || 'empty'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {fieldError && <p className="field-error">{fieldError}</p>}

          <div className="profile-form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
