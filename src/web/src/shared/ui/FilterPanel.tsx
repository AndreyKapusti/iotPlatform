import { Card, CardContent, Stack } from '@mui/material';
import type { ReactNode } from 'react';

interface FilterPanelProps {
  children: ReactNode;
}

export function FilterPanel({ children }: FilterPanelProps) {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={2}>{children}</Stack>
      </CardContent>
    </Card>
  );
}
