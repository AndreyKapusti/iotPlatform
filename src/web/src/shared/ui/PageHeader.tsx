import { Box, Breadcrumbs, Link as MuiLink, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', sm: 'center' }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs sx={{ mb: 1, fontSize: 13 }} aria-label="Навигация">
            {breadcrumbs.map((item) =>
              item.to ? (
                <MuiLink
                  key={item.label}
                  component={Link}
                  to={item.to}
                  underline="hover"
                  color="inherit"
                >
                  {item.label}
                </MuiLink>
              ) : (
                <Typography key={item.label} color="text.secondary" fontSize={13}>
                  {item.label}
                </Typography>
              ),
            )}
          </Breadcrumbs>
        )}
        <Typography variant="h1" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{
            alignItems: 'center',
            flexShrink: 0,
            width: { xs: '100%', sm: 'auto' },
            '& > .MuiButton-root': { flex: { xs: 1, sm: 'none' } },
          }}
        >
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
