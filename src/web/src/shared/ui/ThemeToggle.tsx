import { useState } from 'react';
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  SettingsBrightness as SystemIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectThemePreference, setThemePreference } from '../../features/ui/uiSlice';
import type { ThemePreference } from '../../shared/lib/constants';

interface ThemeToggleProps {
  size?: 'small' | 'medium';
}

const OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

export function ThemeToggle({ size = 'medium' }: ThemeToggleProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const preference = useAppSelector(selectThemePreference);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const icons = {
    system: <SystemIcon fontSize="small" />,
    light: <LightModeIcon fontSize="small" />,
    dark: <DarkModeIcon fontSize="small" />,
  };

  const labels = {
    system: t('theme.system'),
    light: t('theme.light'),
    dark: t('theme.dark'),
  };

  return (
    <>
      <Tooltip title={labels[preference]}>
        <IconButton
          size={size}
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label={labels[preference]}
          aria-haspopup="menu"
          aria-expanded={Boolean(anchor)}
        sx={{
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          width: 40,
          height: 40,
        }}
        >
          {icons[preference]}
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {OPTIONS.map((option) => (
          <MenuItem
            key={option}
            selected={preference === option}
            onClick={() => {
              dispatch(setThemePreference(option));
              setAnchor(null);
            }}
          >
            <ListItemIcon>{icons[option]}</ListItemIcon>
            <ListItemText>{labels[option]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
