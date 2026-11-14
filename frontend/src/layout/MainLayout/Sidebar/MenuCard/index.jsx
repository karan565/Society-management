import { memo } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { USER_ROLES } from 'common/constants';
import { useSociety } from 'contexts/SocietyContext';

function MenuCard() {
  const { users } = useSociety();
  const residentCount = users.filter((user) => user.role === USER_ROLES.RESIDENT).length;

  return (
    <Card
      sx={{
        bgcolor: 'primary.light',
        mb: 2.75
      }}
    >
      <Stack spacing={0.75} sx={{ p: 2 }}>
        <Typography variant="subtitle1" color="primary.800">
          Society directory
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {residentCount} registered homes
        </Typography>
      </Stack>
    </Card>
  );
}

export default memo(MenuCard);
