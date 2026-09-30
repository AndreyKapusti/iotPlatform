import { Skeleton } from '@mui/material';

/** Shown while the 3D chunk downloads (not while telemetry polls). */
export function HouseGardenSceneSkeleton() {
  return (
    <Skeleton
      variant="rounded"
      animation="wave"
      sx={{
        borderRadius: '12px',
        width: '100%',
        height: '100%',
        minHeight: { xs: 280, sm: 340, md: 400 },
        transform: 'none',
      }}
    />
  );
}
