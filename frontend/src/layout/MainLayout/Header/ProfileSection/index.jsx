import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { IconLogout } from '@tabler/icons-react';
import { USER_ROLES } from 'common/constants';
import { useSociety } from 'contexts/SocietyContext';

export default function ProfileSection() {
  const { currentUser, logout } = useSociety();
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();

  const roleLabel =
    currentUser.role === USER_ROLES.SUPER_ADMIN
      ? 'Super Admin'
      : currentUser.role === USER_ROLES.ADMIN
        ? currentUser.title || 'Admin'
        : 'Resident';

  const handleLogout = async () => {
    setAnchorEl(null);
    try {
      await logout();
      navigate('/pages/login', { replace: true });
    } catch (error) {
      navigate('/pages/login', { replace: true, state: { error: error.message } });
    }
  };

  return (
    <>
      <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} aria-label="Open account menu">
        <Avatar sx={{ bgcolor: 'primary.main', color: 'common.white' }}>{currentUser.name.charAt(0).toUpperCase()}</Avatar>
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <Stack sx={{ px: 2, py: 1, minWidth: 200 }}>
          <Typography variant="subtitle1">{currentUser.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {roleLabel}
          </Typography>
        </Stack>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            navigate('/account');
          }}
        >
          My account
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <IconLogout size={18} style={{ marginRight: 10 }} />
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
