import { Box, Card, CardContent, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  children: ReactNode;
  icon?: ReactNode;
  iconColor?: string;
}

export function StatCard({ label, children, icon, iconColor }: StatCardProps) {
  return (
    <Card sx={{ height: '100%', width: '100%' }}>
      <CardContent
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          py: 2.5,
          px: 2.5,
          '&:last-child': { pb: 2.5 },
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}
        >
          {label}
        </Typography>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            minHeight: 64,
            mt: 1,
            gap: 1.5,
          }}
        >
          {icon && (
            <Box
              sx={{
                color: iconColor ?? 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
        </Box>
      </CardContent>
    </Card>
  );
}
