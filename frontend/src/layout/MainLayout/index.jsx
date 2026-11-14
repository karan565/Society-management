import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AppBar from '@mui/material/AppBar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';

// project imports
import Footer from './Footer';
import Header from './Header';
import Sidebar from './Sidebar';
import MainContentStyled from './MainContentStyled';
import Customization from '../Customization';
import Loader from 'ui-component/Loader';
import Breadcrumbs from 'ui-component/extended/Breadcrumbs';

import useConfig from 'hooks/useConfig';
import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { useSociety } from 'contexts/SocietyContext';
import { USER_ROLES } from 'common/constants';
import { APP_NAME } from 'appName';

// ==============================|| MAIN LAYOUT ||============================== //

export default function MainLayout() {
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));

  const {
    state: { borderRadius, miniDrawer }
  } = useConfig();
  const { menuMaster, menuMasterLoading } = useGetMenuMaster();
  const {
    currentUser,
    currentSociety,
    isInitializing,
    initializationError,
    workspaceError,
    retryInitialization,
    refreshWorkspace
  } = useSociety();
  const { pathname } = useLocation();
  const drawerOpen = menuMaster?.isDashboardDrawerOpened;

  useEffect(() => {
    handlerDrawerOpen(!miniDrawer);
  }, [miniDrawer]);

  useEffect(() => {
    downMD && handlerDrawerOpen(false);
  }, [downMD]);

  useEffect(() => {
    const pageTitle = {
      '/dashboard/default': 'Overview',
      '/societies': 'Society management',
      '/people': 'People & access',
      '/maintenance': 'Maintenance',
      '/my-maintenance': 'My maintenance',
      '/expenses': 'Society Finances',
      '/complaints': 'Complaints & suggestions',
      '/account': 'My account'
    }[pathname] || APP_NAME;
    document.title = `${pageTitle} · ${APP_NAME}`;
  }, [pathname]);

  // horizontal menu-list bar : drawer

  if (menuMasterLoading) return <Loader />;
  if (isInitializing) return <Loader />;
  if (!currentUser) return <Navigate to="/pages/login" replace />;
  if (
    currentUser.role === USER_ROLES.SUPER_ADMIN &&
    !currentSociety &&
    pathname !== '/societies' &&
    pathname !== '/dashboard/default'
  ) {
    return <Navigate to="/societies" replace />;
  }

  return (
    <Box sx={{ display: 'flex' }}>
      {/* header */}
      <AppBar enableColorOnDark position="fixed" color="inherit" elevation={0} sx={{ bgcolor: 'background.default' }}>
        <Toolbar disableGutters sx={{ py: 2, pl: { xs: 2, md: 2 }, pr: 2 }}>
          <Header />
        </Toolbar>
      </AppBar>

      {/* menu / drawer */}
      <Sidebar />

      {/* main content */}
      <MainContentStyled {...{ borderRadius, open: drawerOpen }}>
        <Box sx={{ ...{ px: { xs: 0 } }, minHeight: 'calc(100vh - 128px)', display: 'flex', flexDirection: 'column' }}>
          {initializationError && (
            <Alert severity="error" action={<Button color="inherit" size="small" onClick={retryInitialization}>Retry</Button>}>
              {initializationError}
            </Alert>
          )}
          {workspaceError && (
            <Alert severity="error" action={<Button color="inherit" size="small" onClick={refreshWorkspace}>Retry</Button>}>
              {workspaceError}
            </Alert>
          )}
          {/* breadcrumb */}
          <Breadcrumbs />
          <Outlet />
          <Footer />
        </Box>
      </MainContentStyled>
      <Customization />
    </Box>
  );
}
