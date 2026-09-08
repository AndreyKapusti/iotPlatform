import { Box, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

interface QuickCardProps {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  to?: string;
}

export function QuickCard({ title, subtitle, meta, icon, trailing, onClick, to }: QuickCardProps) {
  const inner = (
    <CardContent sx={{ py: 2, px: 2.5, height: '100%' }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ height: '100%' }}>
        {icon && (
          <Box
            sx={{
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 1,
              bgcolor: 'action.hover',
              flexShrink: 0,
              '& .MuiSvgIcon-root': { fontSize: 20 },
            }}
          >
            {icon}
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography fontWeight={600} noWrap title={title}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary" display="block" noWrap title={subtitle}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            {trailing && <Box sx={{ flexShrink: 0 }}>{trailing}</Box>}
          </Stack>
          {meta && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.25, display: 'block' }}>
              {meta}
            </Typography>
          )}
        </Box>
      </Stack>
    </CardContent>
  );

  return (
    <Card sx={{ height: '100%' }}>
      {to ? (
        <CardActionArea component={RouterLink} to={to} sx={{ height: '100%' }}>
          {inner}
        </CardActionArea>
      ) : (
        <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
          {inner}
        </CardActionArea>
      )}
    </Card>
  );
}
