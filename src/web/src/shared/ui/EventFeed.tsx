import { useState, type ReactNode } from 'react';
import {
  Box,
  Card,
  CardContent,
  Collapse,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  AddCircleOutline as CreatedIcon,
  Campaign as AnnounceIcon,
  ChevronRight as ChevronRightIcon,
  CloudOff as OfflineIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  PriorityHigh as SpikeIcon,
  Sensors as ActivityIcon,
  SignalCellularAlt as OnlineIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { FleetEvent, FleetEventKind } from '../lib/fleetEvents';
import { formatRelativeTime } from '../lib/format';
import { SectionHeader } from './SectionHeader';

const EVENT_ICON_COLORS: Record<FleetEventKind, string> = {
  'device.online': 'success.main',
  'device.offline': 'warning.main',
  'device.announced': 'primary.main',
  'device.activity': 'info.main',
  'telemetry.spike': 'error.main',
  'device.created': 'text.secondary',
};

const EVENT_ICONS: Record<FleetEventKind, ReactNode> = {
  'device.online': <OnlineIcon fontSize="small" />,
  'device.offline': <OfflineIcon fontSize="small" />,
  'device.announced': <AnnounceIcon fontSize="small" />,
  'device.activity': <ActivityIcon fontSize="small" />,
  'telemetry.spike': <SpikeIcon fontSize="small" />,
  'device.created': <CreatedIcon fontSize="small" />,
};

interface EventFeedProps {
  events: FleetEvent[];
  title?: string;
  emptyLabel?: string;
  limit?: number;
  compact?: boolean;
}

function EventIcon({ kind }: { kind: FleetEventKind }) {
  return (
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: EVENT_ICON_COLORS[kind],
        bgcolor: 'action.hover',
      }}
    >
      {EVENT_ICONS[kind]}
    </Box>
  );
}

function ReadingsGrid({ readings }: { readings: FleetEvent['readings'] }) {
  if (!readings?.length) return null;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
        gap: 1,
      }}
    >
      {readings.map((reading) => (
        <Box
          key={reading.metric}
          sx={{
            px: 1.5,
            py: 1.25,
            borderRadius: 1.5,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary" display="block" noWrap>
            {reading.metric}
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }}>
            {reading.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function EventFeedItem({
  event,
  compact,
  onNavigate,
}: {
  event: FleetEvent;
  compact: boolean;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const expandable = event.kind === 'device.activity';

  const title = t(`events.${event.kind}`, {
    name: event.deviceName,
    metric: event.metric ?? '',
    value: event.value ?? '',
    count: event.value ?? '',
  });

  const rowPadding = compact ? 1.25 : 1.5;

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: 1,
        borderColor: expanded ? 'primary.main' : 'divider',
        bgcolor: expanded ? 'action.selected' : 'background.paper',
        overflow: 'hidden',
        transition: (theme) =>
          theme.transitions.create(['border-color', 'background-color'], { duration: 180 }),
      }}
    >
      <Box
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        onClick={() => {
          if (expandable) setExpanded((v) => !v);
          else onNavigate();
        }}
        onKeyDown={(e) => {
          if (!expandable) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: rowPadding,
          py: rowPadding,
          cursor: 'pointer',
          '&:hover': { bgcolor: expanded ? 'action.selected' : 'action.hover' },
        }}
      >
        <EventIcon kind={event.kind} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.35 }}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
            {formatRelativeTime(event.timestamp)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.25} alignItems="center" sx={{ flexShrink: 0 }}>
          {expandable &&
            (expanded ? (
              <ExpandLessIcon fontSize="small" color="action" />
            ) : (
              <ExpandMoreIcon fontSize="small" color="action" />
            ))}
          <IconButton
            size="small"
            aria-label={t('common.open')}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate();
            }}
            sx={{
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {expandable && (
        <Collapse in={expanded}>
          <Box
            sx={{
              px: rowPadding,
              pt: 0,
              pb: rowPadding,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Box sx={{ pt: 1.5 }}>
              {event.readings && event.readings.length > 0 ? (
                <ReadingsGrid readings={event.readings} />
              ) : (
                <Typography variant="caption" color="text.secondary">
                  {t('events.noReadings')}
                </Typography>
              )}
            </Box>
          </Box>
        </Collapse>
      )}
    </Box>
  );
}

export function EventFeed({ events, title, emptyLabel, limit = 12, compact = false }: EventFeedProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const visible = events.slice(0, limit);

  return (
    <Box>
      {title && <SectionHeader title={title} />}
      <Card>
        <CardContent sx={{ p: compact ? 1.5 : 2, '&:last-child': { pb: compact ? 1.5 : 2 } }}>
          {visible.length === 0 ? (
            <Box sx={{ py: compact ? 1 : 2, px: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                {emptyLabel ?? t('events.empty')}
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.25}>
              {visible.map((event) => (
                <EventFeedItem
                  key={event.id}
                  event={event}
                  compact={compact}
                  onNavigate={() => navigate(`/devices/${event.deviceId}`)}
                />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
