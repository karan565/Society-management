import PropTypes from 'prop-types';

import TableContainer from '@mui/material/TableContainer';

export default function ResponsiveTable({ children, minWidth = 640 }) {
  return (
    <TableContainer
      sx={{
        width: '100%',
        minWidth: 0,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        '& .MuiTable-root': { minWidth }
      }}
    >
      {children}
    </TableContainer>
  );
}

ResponsiveTable.propTypes = {
  children: PropTypes.node,
  minWidth: PropTypes.number
};
