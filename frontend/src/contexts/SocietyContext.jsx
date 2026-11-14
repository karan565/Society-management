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

  const runWorkspaceMutation = useCallback(
    (loadingMessage, mutation) =>
      withApiActivity(loadingMessage, async () => {
        const result = await mutation();
        await loadWorkspace(currentUser, activeSocietyId, loadingMessage);
        return result;
      }),
    [activeSocietyId, currentUser, loadWorkspace]
  );

  const initialize = useCallback(async () => {
    setIsInitializing(true);
    setInitializationError('');
    try {
      await withApiActivity('Checking your Session…', async () => {
        const session = await refreshSession('Checking your session…');
        await loadWorkspace(session.user, null, 'Checking your session…');
        setCurrentUser(session.user);
      });
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
      await withApiActivity('Refreshing your Society Data…', () =>
        loadWorkspace(currentUser, activeSocietyId, 'Refreshing your Society Data…')
      );
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
          await withApiActivity('Signing you out…', () =>
            apiRequest('/auth/logout', {
              method: 'POST',
              auth: false,
              loadingMessage: 'Signing you out…'
            })
          );
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
        await withApiActivity('Switching Society Workspace…', () =>
          loadWorkspace(currentUser, societyId, 'Switching Society Workspace…')
        );
      },
      async createSociety({ name, address, chairmanName, chairmanEmail, chairmanPassword }) {
        return withApiActivity('Creating Society…', async () => {
          const result = await request('/societies', {
            method: 'POST',
            body: { name, address, chairmanName, chairmanEmail, chairmanPassword },
            loadingMessage: 'Creating Society…'
          });
          await loadWorkspace(currentUser, result.society.id, 'Creating Society…');
          return result.society;
        });
      },
      async createUser({ name, email, role, title, apartment, phone, password }) {
        const result = await runWorkspaceMutation('Adding member…', () =>
          request('/users', {
            ...societyRequestOptions(activeSocietyId),
            method: 'POST',
            body: { name, email, role, title, apartment, phone, password },
            loadingMessage: 'Adding member…'
          })
        );
        return result.user;
      },
      async setUserActive(userId, isActive) {
        await runWorkspaceMutation('Updating member access…', () =>
          request(`/users/${userId}/access`, {
            ...societyRequestOptions(activeSocietyId),
            method: 'PATCH',
            body: { isActive: Boolean(isActive) },
            loadingMessage: 'Updating member access…'
          })
        );
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
        return runWorkspaceMutation('Updating maintenance schedule…', () =>
          request('/maintenance/schedule', {
            ...societyRequestOptions(activeSocietyId),
            method: 'POST',
            body: { month, amount, applyPermanently },
            loadingMessage: 'Updating maintenance schedule…'
          })
        );
      },
      async submitPaymentRequest(billId, paymentDetails) {
        const result = await runWorkspaceMutation('Submitting payment request…', () =>
          request(`/maintenance/bills/${billId}/payment-request`, {
            ...societyRequestOptions(activeSocietyId),
            method: 'POST',
            body: paymentDetails,
            loadingMessage: 'Submitting payment request…'
          })
        );
        return result.paymentRequest;
      },
      async acceptPaymentRequest(billId) {
        await runWorkspaceMutation('Approving payment request…', () =>
          request(`/maintenance/bills/${billId}/accept-payment-request`, {
            ...societyRequestOptions(activeSocietyId),
            method: 'POST',
            loadingMessage: 'Approving payment request…'
          })
        );
      },
      async markBillPaid(billId, paymentDetails) {
        await runWorkspaceMutation('Recording bill payment…', () =>
          request(`/maintenance/bills/${billId}/mark-paid`, {
            ...societyRequestOptions(activeSocietyId),
            method: 'POST',
            body: paymentDetails,
            loadingMessage: 'Recording bill payment…'
          })
        );
      },
      async revertBillPayment(billId) {
        await runWorkspaceMutation('Reverting bill payment…', () =>
          request(`/maintenance/bills/${billId}/revert-payment`, {
            ...societyRequestOptions(activeSocietyId),
            method: 'POST',
            loadingMessage: 'Reverting bill payment…'
          })
        );
      },
      async addExpense(transaction) {
        const result = await runWorkspaceMutation('Adding expense…', () =>
          request('/finances/transactions', {
            ...societyRequestOptions(activeSocietyId),
            method: 'POST',
            body: transaction,
            loadingMessage: 'Adding expense…'
          })
        );
        return result.transaction;
      },
      async updateExpense(transactionId, transaction) {
        const result = await runWorkspaceMutation('Updating expense…', () =>
          request(`/finances/transactions/${transactionId}`, {
            ...societyRequestOptions(activeSocietyId),
            method: 'PATCH',
            body: transaction,
            loadingMessage: 'Updating expense…'
          })
        );
        return result.transaction;
      },
      async setExpensesVisibleToResidents(visible) {
        await runWorkspaceMutation('Updating expense visibility…', () =>
          request('/societies/current/finance-visibility', {
            ...societyRequestOptions(activeSocietyId),
            method: 'PATCH',
            body: { visible: Boolean(visible) },
            loadingMessage: 'Updating expense visibility…'
          })
        );
      },
      async createComplaint(complaint) {
        const result = await runWorkspaceMutation('Submitting complaint…', () =>
          request('/complaints', {
            ...societyRequestOptions(activeSocietyId),
            method: 'POST',
            body: complaint,
            loadingMessage: 'Submitting complaint…'
          })
        );
        return result.complaint;
      },
      async updateComplaintStatus(complaintId, status) {
        await runWorkspaceMutation('Updating complaint status…', () =>
          request(`/complaints/${complaintId}/status`, {
            ...societyRequestOptions(activeSocietyId),
            method: 'PATCH',
            body: { status },
            loadingMessage: 'Updating complaint status…'
          })
        );
      },
      async closeOwnComplaint(complaintId) {
        await runWorkspaceMutation('Closing your complaint…', () =>
          request(`/complaints/${complaintId}/status`, {
            ...societyRequestOptions(activeSocietyId),
            method: 'PATCH',
            body: { status: 'closed' },
            loadingMessage: 'Closing your complaint…'
          })
        );
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
      runWorkspaceMutation,
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
