import { IconBuildingCommunity, IconCash, IconHome, IconMessageReport, IconReceipt, IconUser, IconUsers } from '@tabler/icons-react';
import { ADMIN_ROLES, USER_ROLES } from 'common/constants';

const society = {
  id: 'society',
  title: 'Society',
  type: 'group',
  children: [
    {
      id: 'societies',
      title: 'Manage societies',
      type: 'item',
      url: '/societies',
      icon: IconBuildingCommunity,
      roles: [USER_ROLES.SUPER_ADMIN]
    },
    {
      id: 'people',
      title: 'People & access',
      type: 'item',
      url: '/people',
      icon: IconUsers,
      roles: ADMIN_ROLES
    },
    {
      id: 'maintenance',
      title: 'Maintenance',
      type: 'item',
      url: '/maintenance',
      icon: IconCash,
      roles: ADMIN_ROLES
    },
    {
      id: 'my-maintenance',
      title: 'My Maintenance',
      type: 'item',
      url: '/my-maintenance',
      icon: IconHome,
      roles: [USER_ROLES.RESIDENT]
    },
    {
      id: 'expenses',
      title: 'Society Finances',
      type: 'item',
      url: '/expenses',
      icon: IconReceipt
    },
    {
      id: 'complaints',
      title: 'Complaints & suggestions',
      type: 'item',
      url: '/complaints',
      icon: IconMessageReport
    },
    {
      id: 'account',
      title: 'My account',
      type: 'item',
      url: '/account',
      icon: IconUser
    }
  ]
};

export default society;
