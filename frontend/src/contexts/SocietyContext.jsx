import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { ADMIN_ROLES, USER_ROLES } from 'common/constants';
import { apiRequest, refreshSession, setAccessToken, withApiActivity } from 'api/client';

const SocietyContext = createContext(null);

function emptyWorkspace() {
  return {
    societies: [],
    currentSociety: null,
    users: [],
    allUsers: [],
    bills: [],
    expenses: [],
    availableFund: 0,
    complaints: [],
    currentYear: new Date().getFullYear()
  };
}

function societyRequestOptions(societyId) {
  return societyId ? { societyId } : {};
}

export function SocietyProvider({ children }) {
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeSocietyId, setActiveSocietyId] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [initializationError, setInitializationError] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setCurrentUser(null);
    setActiveSocietyId(null);
    setWorkspace(emptyWorkspace());
    setWorkspaceError('');
  }, []);

  const request = useCallback(
    async (path, options = {}) => {
      try {
        return await apiRequest(path, options);
      } catch (error) {
        if (error.status === 401 && options.auth !== false) clearSession();
        throw error;
      }
    },
    [clearSession]
  );

  const loadWorkspace = useCallback(
    async (user, preferredSocietyId = null, loadingMessage = 'Loading your society workspace…') => {
      if (!user) return;
      setIsWorkspaceLoading(true);
      setWorkspaceError('');

      try {
        const workspaceRequest = (path, options = {}) => request(path, { ...options, loadingMessage });
        let societies = [];
        let allUsers = [];
        let currentSociety = null;
        let selectedSocietyId = null;

        if (user.role === USER_ROLES.SUPER_ADMIN) {
          const [societiesResult, usersResult] = await Promise.all([
            workspaceRequest('/societies'),
            workspaceRequest('/users')
          ]);
          societies = societiesResult.societies;
          allUsers = usersResult.users;
          const activeSocieties = societies.filter((society) => society.isActive !== false);
          selectedSocietyId =
            activeSocieties.find((society) => society.id === preferredSocietyId)?.id ||
            activeSocieties[0]?.id ||
            null;

          if (selectedSocietyId) {
            const result = await workspaceRequest(
              '/societies/current',
              societyRequestOptions(selectedSocietyId)
            );
            currentSociety = result.society;
          }
        } else {
          const result = await workspaceRequest('/societies/current');
          currentSociety = result.society;
          selectedSocietyId = currentSociety.id;
          societies = [currentSociety];
        }

        if (!currentSociety) {
          setWorkspace({
            ...emptyWorkspace(),
            societies,
            allUsers,
            currentYear: new Date().getFullYear()
          });
          setActiveSocietyId(null);
          return;
        }

        const scope = societyRequestOptions(selectedSocietyId);
        const usersPromise =
          user.role === USER_ROLES.RESIDENT
            ? Promise.resolve({ users: [user] })
            : workspaceRequest('/users', scope);
        const transactionsPromise =
          user.role === USER_ROLES.RESIDENT && !currentSociety.expensesVisibleToResidents
            ? Promise.resolve({ transactions: [] })
            : workspaceRequest('/finances/transactions', scope);

        const [usersResult, billsResult, complaintsResult, balanceResult, transactionsResult] =
          await Promise.all([
            usersPromise,
            workspaceRequest(`/maintenance/bills?year=${new Date().getFullYear()}`, scope),
            workspaceRequest('/complaints', scope),
            workspaceRequest('/finances/balance', scope),
            transactionsPromise
          ]);

        const users = usersResult.users;
        setWorkspace({
          societies,
          currentSociety,
          users,
          allUsers: user.role === USER_ROLES.SUPER_ADMIN ? allUsers : users,
          bills: billsResult.bills,
          expenses: transactionsResult.transactions,
          availableFund: balanceResult.availableFund,
          complaints: complaintsResult.complaints,
          currentYear: billsResult.currentYear
        });
        setActiveSocietyId(selectedSocietyId);
      } catch (error) {
        if (error.status !== 401) setWorkspaceError(error.message);
        throw error;
      } finally {
        setIsWorkspaceLoading(false);
      }
    },
    [request]
  );

  const initialize = useCallback(async () => {
    setIsInitializing(true);
    setInitializationError('');
    try {
      const session = await refreshSession('Checking your session…');
      await loadWorkspace(session.user);
      setCurrentUser(session.user);
    } catch (error) {
      clearSession();
      if (error.status !== 401) setInitializationError(error.message);
    } finally {
      setIsInitializing(false);
    }
  }, [clearSession, loadWorkspace]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const refreshWorkspace = useCallback(async () => {
    try {
      if (!currentUser) return await initialize();
      await loadWorkspace(currentUser, activeSocietyId, 'Refreshing your society data…');
    } catch {
      return;
    }
  }, [activeSocietyId, currentUser, initialize, loadWorkspace]);

  const value = useMemo(
    () => ({
      ...workspace,
      currentUser,
      activeSocietyId,
      isInitializing,
      isWorkspaceLoading,
      initializationError,
      workspaceError,
      refreshWorkspace,
      retryInitialization: initialize,
      async login(email, password) {
        setInitializationError('');
        await withApiActivity('Signing you in…', async () => {
          const result = await apiRequest('/auth/login', {
            method: 'POST',
            body: { email: email.trim().toLowerCase(), password },
            auth: false,
            loadingMessage: 'Signing you in…'
          });
          setAccessToken(result.accessToken);
          try {
            await loadWorkspace(result.user, null, 'Signing you in…');
            setCurrentUser(result.user);
          } catch (error) {
            setAccessToken(null);
            throw error;
          }
        });
      },
      async logout() {
        let logoutError;
        try {
          await apiRequest('/auth/logout', {
            method: 'POST',
            auth: false,
            loadingMessage: 'Signing you out…'
          });
        } catch (error) {
          logoutError = error;
        } finally {
          clearSession();
        }
        if (logoutError) throw logoutError;
      },
      async selectSociety(societyId, actor) {
        if (actor?.role !== USER_ROLES.SUPER_ADMIN) throw new Error('Only the Super Admin can switch societies.');
        const society = workspace.societies.find((item) => item.id === societyId);
        if (!society || society.isActive === false) throw new Error('The selected society is not available.');
        await loadWorkspace(currentUser, societyId, 'Switching society workspace…');
      },
      async createSociety({ name, address, chairmanName, chairmanEmail, chairmanPassword }) {
        const result = await request('/societies', {
          method: 'POST',
          body: { name, address, chairmanName, chairmanEmail, chairmanPassword },
          loadingMessage: 'Creating society…'
        });
        await loadWorkspace(currentUser, result.society.id, 'Creating society…');
        return result.society;
      },
      async createUser({ name, email, role, title, apartment, phone, password }) {
        const result = await request('/users', {
          ...societyRequestOptions(activeSocietyId),
          method: 'POST',
          body: { name, email, role, title, apartment, phone, password },
          loadingMessage: 'Adding member…'
        });
        await loadWorkspace(currentUser, activeSocietyId, 'Adding member…');
        return result.user;
      },
      async setUserActive(userId, isActive) {
        await request(`/users/${userId}/access`, {
          ...societyRequestOptions(activeSocietyId),
          method: 'PATCH',
          body: { isActive: Boolean(isActive) },
          loadingMessage: 'Updating member access…'
        });
        await loadWorkspace(currentUser, activeSocietyId, 'Updating member access…');
      },
      async resetUserPassword(userId, password) {
        await request(`/users/${userId}/password`, {
          ...societyRequestOptions(activeSocietyId),
          method: 'PUT',
          body: { password },
          loadingMessage: 'Resetting member password…'
        });
      },
      async changePassword(currentPassword, newPassword) {
        const result = await request('/auth/change-password', {
          method: 'POST',
          body: { currentPassword, newPassword },
          loadingMessage: 'Updating your password…'
        });
        clearSession();
        return result;
      },
      async setMaintenance(month, amount, _actor, applyPermanently = false) {
        const result = await request('/maintenance/schedule', {
          ...societyRequestOptions(activeSocietyId),
          method: 'POST',
          body: { month, amount, applyPermanently },
          loadingMessage: 'Updating maintenance schedule…'
        });
        await loadWorkspace(currentUser, activeSocietyId, 'Updating maintenance schedule…');
        return result;
      },
      async submitPaymentRequest(billId, paymentDetails) {
        const result = await request(`/maintenance/bills/${billId}/payment-request`, {
          ...societyRequestOptions(activeSocietyId),
          method: 'POST',
          body: paymentDetails,
          loadingMessage: 'Submitting payment request…'
        });
        await loadWorkspace(currentUser, activeSocietyId, 'Submitting payment request…');
        return result.paymentRequest;
      },
      async acceptPaymentRequest(billId) {
        await request(`/maintenance/bills/${billId}/accept-payment-request`, {
          ...societyRequestOptions(activeSocietyId),
          method: 'POST',
          loadingMessage: 'Approving payment request…'
        });
        await loadWorkspace(currentUser, activeSocietyId, 'Approving payment request…');
      },
      async markBillPaid(billId, paymentDetails) {
        await request(`/maintenance/bills/${billId}/mark-paid`, {
          ...societyRequestOptions(activeSocietyId),
          method: 'POST',
          body: paymentDetails,
          loadingMessage: 'Recording bill payment…'
        });
        await loadWorkspace(currentUser, activeSocietyId, 'Recording bill payment…');
      },
      async revertBillPayment(billId) {
        await request(`/maintenance/bills/${billId}/revert-payment`, {
          ...societyRequestOptions(activeSocietyId),
          method: 'POST',
          loadingMessage: 'Reverting bill payment…'
        });
        await loadWorkspace(currentUser, activeSocietyId, 'Reverting bill payment…');
      },
      async addExpense(transaction) {
        const result = await request('/finances/transactions', {
          ...societyRequestOptions(activeSocietyId),
          method: 'POST',
          body: transaction,
          loadingMessage: 'Adding expense…'
        });
        await loadWorkspace(currentUser, activeSocietyId, 'Adding expense…');
        return result.transaction;
      },
      async updateExpense(transactionId, transaction) {
        const result = await request(`/finances/transactions/${transactionId}`, {
          ...societyRequestOptions(activeSocietyId),
          method: 'PATCH',
          body: transaction,
          loadingMessage: 'Updating expense…'
        });
        await loadWorkspace(currentUser, activeSocietyId, 'Updating expense…');
        return result.transaction;
      },
      async setExpensesVisibleToResidents(visible) {
        await request('/societies/current/finance-visibility', {
          ...societyRequestOptions(activeSocietyId),
          method: 'PATCH',
          body: { visible: Boolean(visible) },
          loadingMessage: 'Updating expense visibility…'
        });
        await loadWorkspace(currentUser, activeSocietyId, 'Updating expense visibility…');
      },
      async createComplaint(complaint) {
        const result = await request('/complaints', {
          ...societyRequestOptions(activeSocietyId),
          method: 'POST',
          body: complaint,
          loadingMessage: 'Submitting complaint…'
        });
        await loadWorkspace(currentUser, activeSocietyId, 'Submitting complaint…');
        return result.complaint;
      },
      async updateComplaintStatus(complaintId, status) {
        await request(`/complaints/${complaintId}/status`, {
          ...societyRequestOptions(activeSocietyId),
          method: 'PATCH',
          body: { status },
          loadingMessage: 'Updating complaint status…'
        });
        await loadWorkspace(currentUser, activeSocietyId, 'Updating complaint status…');
      },
      async closeOwnComplaint(complaintId) {
        await request(`/complaints/${complaintId}/status`, {
          ...societyRequestOptions(activeSocietyId),
          method: 'PATCH',
          body: { status: 'closed' },
          loadingMessage: 'Closing your complaint…'
        });
        await loadWorkspace(currentUser, activeSocietyId, 'Closing your complaint…');
      },
      isAdmin: Boolean(currentUser && ADMIN_ROLES.includes(currentUser.role))
    }),
    [
      activeSocietyId,
      clearSession,
      currentUser,
      initialize,
      isInitializing,
      isWorkspaceLoading,
      loadWorkspace,
      refreshWorkspace,
      request,
      workspace,
      workspaceError,
      initializationError
    ]
  );

  return <SocietyContext.Provider value={value}>{children}</SocietyContext.Provider>;
}

SocietyProvider.propTypes = { children: PropTypes.node };

export function useSociety() {
  const context = useContext(SocietyContext);
  if (!context) throw new Error('useSociety must be used within SocietyProvider.');
  return context;
}
