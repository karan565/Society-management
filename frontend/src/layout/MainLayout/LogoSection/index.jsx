import { Link as RouterLink } from 'react-router-dom';

import Avatar from '@mui/material/Avatar';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconBuildingCommunity } from '@tabler/icons-react';
import { DASHBOARD_PATH } from 'config';
import { APP_NAME } from 'appName';

export default function LogoSection() {
  return (
    <Link component={RouterLink} to={DASHBOARD_PATH} underline="none" aria-label={`${APP_NAME} home`}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <Avatar variant="rounded" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <IconBuildingCommunity size={22} />
        </Avatar>
        <Typography variant="h3" color="text.primary" noWrap>
          {APP_NAME}
        </Typography>
      </Stack>
    </Link>
  );
}
