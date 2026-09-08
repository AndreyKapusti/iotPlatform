import { Box, Button, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <Box
      sx={{
        py: 8,
        px: 3,
        textAlign: 'center',
        maxWidth: 420,
        mx: 'auto',
      }}
    >
      {icon && (
        <Box sx={{ mb: 2, color: 'text.secondary', '& svg': { fontSize: 48 } }}>{icon}</Box>
      )}
      <Typography variant="h3" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: actionLabel ? 3 : 0 }}>
        {description}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}

export function EmptyStateCard(props: EmptyStateProps) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        minHeight: 240,
      }}
    >
      <EmptyState {...props} />
    </Stack>
  );
}
