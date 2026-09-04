import { useEffect, useState } from 'react';
import { Navigate, Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { clearToken, getToken } from '../api/client';

const SIDEBAR_KEY = 'signaldeck_sidebar_collapsed';
const SIDEBAR_OVERLAY_MQ = '(max-width: 900px)';

export function ProtectedRoute() {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return { collapsed, setCollapsed, toggle: () => setCollapsed((v) => !v) };
}

function useSidebarOverlay() {
  const [overlay, setOverlay] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(SIDEBAR_OVERLAY_MQ).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(SIDEBAR_OVERLAY_MQ);
    const onChange = (event: MediaQueryListEvent) => setOverlay(event.matches);
    setOverlay(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return overlay;
}

function Shell({ wide = false }: { wide?: boolean }) {
  const navigate = useNavigate();
  const { collapsed, toggle } = useSidebarCollapsed();
  const sidebarOverlay = useSidebarOverlay();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOverlay) {
      setMobileOpen(false);
    }
  }, [sidebarOverlay]);

  const closeMobileSidebar = () => {
    if (sidebarOverlay) setMobileOpen(false);
  };

  const logout = () => {
    clearToken();
    navigate('/login');
  };

  const shellClass = [
    'app-shell',
    !sidebarOverlay && collapsed ? 'app-shell--sidebar-collapsed' : '',
    sidebarOverlay ? 'app-shell--sidebar-overlay' : '',
    sidebarOverlay && mobileOpen ? 'app-shell--sidebar-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClass}>
      {sidebarOverlay && mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Закрыть меню"
          onClick={closeMobileSidebar}
        />
      )}

      <aside className="app-sidebar" aria-label="Основное меню" aria-hidden={sidebarOverlay && !mobileOpen}>
        <div className="app-sidebar-top">
          <Link to="/devices" className="app-brand" title="SignalDeck">
            <span className="app-brand-mark" aria-hidden>
              SD
            </span>
            <span className="app-brand-text">SignalDeck</span>
          </Link>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => {
              if (sidebarOverlay) {
                closeMobileSidebar();
              } else {
                toggle();
              }
            }}
            aria-expanded={sidebarOverlay ? mobileOpen : !collapsed}
            aria-label={
              sidebarOverlay
                ? 'Закрыть меню'
                : collapsed
                  ? 'Развернуть меню'
                  : 'Свернуть меню'
            }
            title={sidebarOverlay ? 'Закрыть' : collapsed ? 'Развернуть' : 'Свернуть'}
          >
            {sidebarOverlay ? '×' : collapsed ? '»' : '«'}
          </button>
        </div>

        <nav id="app-sidebar-nav" className="app-sidebar-nav">
          <NavLink
            to="/devices"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
            }
            title="Устройства"
            onClick={closeMobileSidebar}
          >
            <span className="sidebar-link-icon" aria-hidden>
              ▦
            </span>
            <span className="sidebar-link-label">Устройства</span>
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
            }
            title="Профиль"
            onClick={closeMobileSidebar}
          >
            <span className="sidebar-link-icon" aria-hidden>
              👤
            </span>
            <span className="sidebar-link-label">Профиль</span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
            }
            title="Настройки"
            onClick={closeMobileSidebar}
          >
            <span className="sidebar-link-icon" aria-hidden>
              ⚙
            </span>
            <span className="sidebar-link-label">Настройки</span>
          </NavLink>
        </nav>

        <div className="app-sidebar-footer">
          <button
            type="button"
            className="sidebar-link sidebar-link--button"
            onClick={logout}
            title="Выйти"
          >
            <span className="sidebar-link-icon" aria-hidden>
              ⎋
            </span>
            <span className="sidebar-link-label">Выйти</span>
          </button>
        </div>
      </aside>

      <div className="app-content">
        {sidebarOverlay && (
          <div className="app-mobile-bar">
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-controls="app-sidebar-nav"
              aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'}
            >
              ☰
            </button>
            <span className="app-mobile-bar-title">SignalDeck</span>
          </div>
        )}
        <main className={`app-main ${wide ? 'app-main--wide' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AppLayout() {
  return <Shell />;
}

export function WideLayout() {
  return <Shell wide />;
}
