import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', sm: 'center' }}
      spacing={1}
      sx={{ mb: 1.5 }}
    >
      <Typography variant="h3" component="h2">
        {title}
      </Typography>
      {action && (
        <Box sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}>{action}</Box>
      )}
    </Stack>
  );
}
