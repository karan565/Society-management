import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

// project imports
import MainLayout from 'layout/MainLayout';
import Loadable from 'ui-component/Loadable';
import { ADMIN_ROLES, USER_ROLES } from 'common/constants';

// dashboard routing
const DashboardDefault = Loadable(lazy(() => import('views/society/Dashboard')));

const Members = Loadable(lazy(() => import('views/society/Members')));
const Maintenance = Loadable(lazy(() => import('views/society/Maintenance')));
const MyMaintenance = Loadable(lazy(() => import('views/society/MyMaintenance')));
const Account = Loadable(lazy(() => import('views/society/Account')));
const Societies = Loadable(lazy(() => import('views/society/Societies')));
const Expenses = Loadable(lazy(() => import('views/society/Expenses')));
const Complaints = Loadable(lazy(() => import('views/society/Complaints')));
const RoleGate = Loadable(lazy(() => import('routes/RoleGate')));

// ==============================|| MAIN ROUTING ||============================== //

const MainRoutes = {
  path: '/',
  element: <MainLayout />,
  children: [
    {
      path: '/',
      element: <Navigate to="/dashboard/default" replace />
    },
    {
      path: 'dashboard',
      children: [
        {
          path: 'default',
          element: <DashboardDefault />
        }
      ]
    },
    {
      path: 'societies',
      element: (
        <RoleGate roles={[USER_ROLES.SUPER_ADMIN]}>
          <Societies />
        </RoleGate>
      )
    },
    {
      path: 'people',
      element: (
        <RoleGate roles={ADMIN_ROLES}>
          <Members />
        </RoleGate>
      )
    },
    {
      path: 'maintenance',
      element: (
        <RoleGate roles={ADMIN_ROLES}>
          <Maintenance />
        </RoleGate>
      )
    },
    {
      path: 'my-maintenance',
      element: (
        <RoleGate roles={[USER_ROLES.RESIDENT]}>
          <MyMaintenance />
        </RoleGate>
      )
    },
    {
      path: 'expenses',
      element: (
        <RoleGate roles={[...ADMIN_ROLES, USER_ROLES.RESIDENT]}>
          <Expenses />
        </RoleGate>
      )
    },
    {
      path: 'complaints',
      element: (
        <RoleGate roles={[...ADMIN_ROLES, USER_ROLES.RESIDENT]}>
          <Complaints />
        </RoleGate>
      )
    },
    {
      path: 'account',
      element: <Account />
    }
  ]
};

export default MainRoutes;
