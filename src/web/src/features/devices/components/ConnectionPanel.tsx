import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { ContentCopy as CopyIcon, VpnKey as KeyIcon } from '@mui/icons-material';
import { useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useRegenerateApiKeyMutation } from '../api/devicesApi';
import { extractErrorMessage } from '../../../shared/api/baseApi';
import { buildConnectionSnippets } from '../../../shared/lib/connectionSnippets';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import type { Device } from '../../../types';

interface ConnectionPanelProps {
  device: Device;
}

function SnippetBlock({ label, code }: { label: string; code: string }) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      enqueueSnackbar(t('common.copied'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('device.keyCopyFailed'), { variant: 'error' });
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="body2" fontWeight={600}>
          {label}
        </Typography>
        <Tooltip title={t('common.copy')}>
          <IconButton size="small" onClick={() => void copy()}>
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          borderRadius: 1,
          bgcolor: 'action.hover',
          fontFamily: 'monospace',
          fontSize: 12,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {code}
      </Box>
    </Box>
  );
}

export function ConnectionPanel({ device }: ConnectionPanelProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [snippetTab, setSnippetTab] = useState(0);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateKey, { isLoading: regenerating }] = useRegenerateApiKeyMutation();

  const snippets = buildConnectionSnippets(device.id, device.api_key);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(device.api_key);
      enqueueSnackbar(t('device.keyCopied'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('device.keyCopyFailed'), { variant: 'error' });
    }
  };

  const onRegenerate = async () => {
    try {
      await regenerateKey(device.id).unwrap();
      enqueueSnackbar(t('device.keyRegenerated'), { variant: 'success' });
      setRegenerateOpen(false);
    } catch (err) {
      enqueueSnackbar(extractErrorMessage(err as Parameters<typeof extractErrorMessage>[0]), {
        variant: 'error',
      });
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="body2" color="text.secondary">
        {t('device.connectionHint')}
      </Typography>

      <Box>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          {t('device.apiKey')}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Box
            component="code"
            sx={{
              flex: 1,
              minWidth: 200,
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'action.hover',
              fontFamily: 'monospace',
              fontSize: 13,
              wordBreak: 'break-all',
            }}
          >
            {device.api_key}
          </Box>
          <Tooltip title={t('common.copy')}>
            <IconButton onClick={() => void copyKey()}>
              <CopyIcon />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            color="warning"
            startIcon={<KeyIcon />}
            onClick={() => setRegenerateOpen(true)}
          >
            {t('device.regenerateKey')}
          </Button>
        </Stack>
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {t('device.regenerateKeyHint')}
        </Alert>
      </Box>

      <Box>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          {t('device.quickStart')}
        </Typography>
        <Tabs value={snippetTab} onChange={(_, v) => setSnippetTab(v)} sx={{ mb: 2 }}>
          <Tab label={t('device.snippetAnnounce')} />
          <Tab label={t('device.snippetTelemetry')} />
        </Tabs>
        {snippetTab === 0 && (
          <SnippetBlock label={t('device.snippetAnnounce')} code={snippets.curlAnnounce} />
        )}
        {snippetTab === 1 && (
          <SnippetBlock label={t('device.snippetTelemetry')} code={snippets.curlTelemetry} />
        )}
      </Box>

      <ConfirmDialog
        open={regenerateOpen}
        title={t('device.regenerateKeyTitle')}
        description={t('device.regenerateKeyDesc')}
        confirmLabel={t('device.regenerateKey')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={regenerating}
        onClose={() => setRegenerateOpen(false)}
        onConfirm={() => void onRegenerate()}
      />
    </Stack>
  );
}
