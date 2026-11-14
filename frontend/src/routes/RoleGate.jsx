import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';

import { useSociety } from 'contexts/SocietyContext';

export default function RoleGate({ roles, children }) {
  const { currentUser } = useSociety();
  return currentUser && roles.includes(currentUser.role) ? children : <Navigate to="/dashboard/default" replace />;
}

RoleGate.propTypes = {
  roles: PropTypes.arrayOf(PropTypes.string).isRequired,
  children: PropTypes.node.isRequired
};
