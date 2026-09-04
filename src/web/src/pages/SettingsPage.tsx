import { useTheme } from '../hooks/useTheme';
import type { ThemeMode } from '../theme';

const OPTIONS: Array<{ value: ThemeMode; title: string; hint: string }> = [
  {
    value: 'light',
    title: 'Светлая',
    hint: 'Светлый фон, industrial-стиль по умолчанию',
  },
  {
    value: 'dark',
    title: 'Тёмная',
    hint: 'Тёмный фон для работы при слабом освещении',
  },
];

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Настройки</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Внешний вид и предпочтения интерфейса
          </p>
        </div>
      </div>

      <section className="card settings-section">
        <h2 className="settings-section-title">Тема</h2>
        <p className="muted settings-section-desc">
          Выбор сохраняется в этом браузере и применяется ко всему приложению.
        </p>

        <div className="theme-options" role="radiogroup" aria-label="Тема оформления">
          {OPTIONS.map((option) => {
            const selected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`theme-option ${selected ? 'theme-option--active' : ''}`}
                onClick={() => setTheme(option.value)}
              >
                <span className={`theme-preview theme-preview--${option.value}`} aria-hidden />
                <span className="theme-option-text">
                  <strong>{option.title}</strong>
                  <span className="muted">{option.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
