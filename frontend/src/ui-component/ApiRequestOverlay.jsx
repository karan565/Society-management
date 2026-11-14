import { useSyncExternalStore } from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Modal from '@mui/material/Modal';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { getApiActivitySnapshot, subscribeToApiActivity } from 'api/client';

export default function ApiRequestOverlay() {
  const { activeRequestCount, loadingMessage } = useSyncExternalStore(
    subscribeToApiActivity,
    getApiActivitySnapshot,
    getApiActivitySnapshot
  );

  return (
    <Modal open={activeRequestCount > 0} onClose={() => {}} disableEscapeKeyDown>
      <Box
        role="status"
        aria-live="polite"
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          outline: 0
        }}
      >
        <Stack
          spacing={2}
          sx={{
            alignItems: 'center',
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 24,
            p: 4
          }}
        >
          <CircularProgress aria-label="Processing API request" />
          <Typography>
            {loadingMessage || 'Processing your request…'}
          </Typography>
        </Stack>
      </Box>
    </Modal>
  );
}
