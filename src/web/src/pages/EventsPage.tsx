import { useMemo, useState } from 'react';
import { Box, Button, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useFleetEvents } from '../shared/hooks/useFleetEvents';
import { clearFleetEvents, isCriticalFleetEvent } from '../shared/lib/fleetEvents';
import { EventFeed } from '../shared/ui/EventFeed';
import { FilterPanel } from '../shared/ui/FilterPanel';
import { PageHeader } from '../shared/ui/PageHeader';

type EventFilter = 'all' | 'critical';

export function EventsPage() {
  const { t } = useTranslation();
  const events = useFleetEvents();
  const [filter, setFilter] = useState<EventFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'critical') {
      return events.filter((e) => isCriticalFleetEvent(e.kind));
    }
    return events;
  }, [events, filter]);

  return (
    <>
      <PageHeader
        title={t('events.title')}
        subtitle={t('events.subtitle')}
        breadcrumbs={[
          { label: t('nav.overview'), to: '/' },
          { label: t('events.title') },
        ]}
        actions={
          events.length > 0 ? (
            <Button size="small" color="inherit" onClick={() => clearFleetEvents()}>
              {t('events.clear')}
            </Button>
          ) : undefined
        }
      />

      <FilterPanel>
        <Box>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filter}
            onChange={(_, value: EventFilter | null) => value && setFilter(value)}
          >
            <ToggleButton value="all">{t('events.filterAll')}</ToggleButton>
            <ToggleButton value="critical">{t('events.filterCritical')}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </FilterPanel>

      <EventFeed
        events={filtered}
        limit={100}
        emptyLabel={filter === 'critical' ? t('events.emptyCritical') : t('events.empty')}
      />
    </>
  );
}
