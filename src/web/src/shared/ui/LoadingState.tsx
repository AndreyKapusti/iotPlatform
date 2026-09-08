import { Box, CircularProgress, Stack, Typography } from '@mui/material';

interface LoadingStateProps {
  label?: string;
  minHeight?: number | string;
}

export function LoadingState({ label = 'Загрузка…', minHeight = 240 }: LoadingStateProps) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={2}
      sx={{ minHeight, py: 4 }}
    >
      <CircularProgress size={32} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Box sx={{ p: 2 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Box
          key={i}
          sx={{
            height: 48,
            mb: 1,
            borderRadius: 1,
            bgcolor: 'action.hover',
            opacity: 0.5,
          }}
        />
      ))}
    </Box>
  );
}
