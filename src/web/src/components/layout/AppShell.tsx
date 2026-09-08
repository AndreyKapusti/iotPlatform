import { useEffect, useMemo } from 'react';
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Dashboard as DashboardIcon,
  History as EventsIcon,
  Home as HomeIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Person as PersonIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { clearCredentials } from '../../features/auth/authSlice';
import {
  selectMobileNavOpen,
  selectSidebarCollapsed,
  setMobileNavOpen,
  toggleSidebarCollapsed,
} from '../../features/ui/uiSlice';
import { ThemeToggle } from '../../shared/ui/ThemeToggle';
import { CommandPalette, useCommandPalette } from '../../shared/ui/CommandPalette';
import { FleetEventsWatcher } from '../../shared/hooks/FleetEventsWatcher';
import { OfflineAlertsWatcher } from '../../shared/hooks/useOfflineAlerts';
import { ProfileTimezoneSync } from '../../shared/hooks/useProfileTimezoneSync';

const DRAWER_WIDTH = 260;
const DRAWER_WIDTH_COLLAPSED = 72;

interface AppShellProps {
  wide?: boolean;
}

export function AppShell({ wide = false }: AppShellProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const mobileOpen = useAppSelector(selectMobileNavOpen);
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();

  const navItems = useMemo(
    () => [
      { to: '/', label: t('nav.overview'), icon: <HomeIcon /> },
      { to: '/events', label: t('nav.events'), icon: <EventsIcon /> },
      { to: '/devices', label: t('nav.devices'), icon: <DashboardIcon /> },
      { to: '/profile', label: t('nav.profile'), icon: <PersonIcon /> },
      { to: '/settings', label: t('nav.settings'), icon: <SettingsIcon /> },
    ],
    [t],
  );

  const drawerWidth = collapsed && !isMobile ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  useEffect(() => {
    dispatch(setMobileNavOpen(false));
  }, [location.pathname, dispatch]);

  const logout = () => {
    dispatch(clearCredentials());
    navigate('/login');
  };

  const drawerContent = useMemo(
    () => (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Toolbar
          sx={{
            px: collapsed && !isMobile ? 1 : 2,
            justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
            minHeight: { xs: 56, sm: 64 },
            gap: 1,
          }}
        >
          {(!collapsed || isMobile) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Box
                component="img"
                src="/favicon.svg"
                alt=""
                sx={{ width: 32, height: 32, borderRadius: 1, flexShrink: 0 }}
              />
              <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
                {t('app.name')}
              </Typography>
            </Box>
          )}
          {!isMobile && (
            <Tooltip title={collapsed ? t('nav.expandMenu') : t('nav.collapseMenu')}>
              <IconButton size="small" onClick={() => dispatch(toggleSidebarCollapsed())}>
                {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              </IconButton>
            </Tooltip>
          )}
        </Toolbar>

        <Divider />

        <List sx={{ flex: 1, px: 1, py: 1 }}>
          {navItems.map((item) => {
            const active =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to);
            const button = (
              <ListItemButton
                key={item.to}
                component={NavLink}
                to={item.to}
                selected={active}
                onClick={() => isMobile && dispatch(setMobileNavOpen(false))}
                sx={{
                  borderRadius: 1.5,
                  mb: 0.5,
                  justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                  px: collapsed && !isMobile ? 1 : 2,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: collapsed && !isMobile ? 0 : 40,
                    justifyContent: 'center',
                    color: active ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {(!collapsed || isMobile) && <ListItemText primary={item.label} />}
              </ListItemButton>
            );
            return collapsed && !isMobile ? (
              <Tooltip key={item.to} title={item.label} placement="right">
                {button}
              </Tooltip>
            ) : (
              button
            );
          })}
        </List>

        <Divider />
        <List sx={{ px: 1, py: 1 }}>
          <ListItemButton
            onClick={logout}
            sx={{
              borderRadius: 1.5,
              justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
              px: collapsed && !isMobile ? 1 : 2,
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: collapsed && !isMobile ? 0 : 40,
                justifyContent: 'center',
                color: 'text.secondary',
              }}
            >
              <LogoutIcon />
            </ListItemIcon>
            {(!collapsed || isMobile) && <ListItemText primary={t('nav.logout')} />}
          </ListItemButton>
        </List>
      </Box>
    ),
    [collapsed, isMobile, location.pathname, dispatch, logout, navItems, t],
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <OfflineAlertsWatcher />
      <FleetEventsWatcher />
      <ProfileTimezoneSync />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {isMobile && (
        <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
            <IconButton edge="start" onClick={() => dispatch(setMobileNavOpen(true))} aria-label={t('nav.openMenu')}>
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
              <Box component="img" src="/favicon.svg" alt="" sx={{ width: 28, height: 28, borderRadius: 1 }} />
              <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
                {t('app.name')}
              </Typography>
            </Box>
            <ThemeToggle size="small" />
          </Toolbar>
        </AppBar>
      )}

      {!isMobile && (
        <Box
          sx={{
            position: 'fixed',
            top: 12,
            right: 16,
            zIndex: theme.zIndex.appBar - 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Tooltip title={t('search.open')}>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<SearchIcon fontSize="small" />}
              onClick={() => setPaletteOpen(true)}
              sx={{
                bgcolor: 'background.paper',
                borderColor: 'divider',
                textTransform: 'none',
                color: 'text.secondary',
              }}
            >
              {t('search.shortcut')}
            </Button>
          </Tooltip>
          <ThemeToggle size="small" />
        </Box>
      )}

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={() => dispatch(setMobileNavOpen(false))}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
              overflowX: 'hidden',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          pt: { xs: '56px', sm: isMobile ? '64px' : 0 },
        }}
      >
        <Box
          sx={{
            maxWidth: wide ? 1440 : 1200,
            mx: 'auto',
            px: { xs: 2, sm: 3 },
            py: { xs: 2, sm: 3 },
          }}
        >
          {!isMobile && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1, minHeight: 40 }} />
          )}
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export function AppLayout() {
  return <AppShell />;
}

export function WideLayout() {
  return <AppShell wide />;
}
