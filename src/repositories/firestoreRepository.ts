import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  Account,
  AuditLog,
  BalanceSnapshot,
  Broker,
  CashTransaction,
  FXRateSnapshot,
  InstrumentSpecification,
  Portfolio,
  PropFirm,
  Trade,
  TradingPlatform,
  User,
  UserProfile,
  Workspace,
  WorkspaceStatus,
} from '../domain/models';
import {
  accountInputSchema,
  balanceSnapshotInputSchema,
  brokerInputSchema,
  cashTransactionInputSchema,
  fxRateInputSchema,
  portfolioInputSchema,
  propFirmInputSchema,
  tradingPlatformInputSchema,
  workspaceInputSchema,
  type AccountInput,
  type BalanceSnapshotInput,
  type BrokerInput,
  type CashTransactionInput,
  type FXRateInput,
  type PortfolioInput,
  type PropFirmInput,
  type TradingPlatformInput,
  type WorkspaceInput,
} from '../domain/validation/accountValidation';
import {
  instrumentSpecInputSchema,
  tradeInputSchema,
  type InstrumentSpecInput,
  type TradeInput,
} from '../domain/validation/tradeValidation';
import {
  db,
  handleFirestoreError,
  OperationType,
} from '../integrations/firebase/client';
import type { IDataRepository } from './interfaces';

function generateId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

export class FirestoreRepository implements IDataRepository {
  readonly mode = 'firebase_cloud' as const;

  async ensureUserProfile(user: User): Promise<UserProfile> {
    const path = `users/${user.uid}`;
    try {
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data();
        return {
          uid: d.uid,
          email: d.email ?? null,
          displayName: d.displayName,
          photoUrl: d.photoUrl ?? null,
          theme: d.theme,
          defaultCurrency: d.defaultCurrency,
          timezone: d.timezone,
          activeWorkspaceId: d.activeWorkspaceId ?? null,
          createdAt: timestampToIso(d.createdAt),
          updatedAt: timestampToIso(d.updatedAt),
        };
      }

      const displayName = (
        user.displayName?.trim() ||
        user.email?.split('@')[0]?.trim() ||
        'Trader'
      ).slice(0, 100);
      const browserTz =
        typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC';
      const timezone = browserTz.slice(0, 64);

      const payload = {
        uid: user.uid,
        email: user.email ? user.email.slice(0, 320) : null,
        displayName,
        photoUrl: user.photoUrl ? user.photoUrl.slice(0, 500) : null,
        theme: 'dark' as const,
        defaultCurrency: 'USD',
        timezone,
        activeWorkspaceId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(ref, payload);
      const created = await getDoc(ref);
      const c = created.data() ?? payload;
      return {
        uid: c.uid,
        email: c.email ?? null,
        displayName: c.displayName,
        photoUrl: c.photoUrl ?? null,
        theme: c.theme,
        defaultCurrency: c.defaultCurrency,
        timezone: c.timezone,
        activeWorkspaceId: c.activeWorkspaceId ?? null,
        createdAt: timestampToIso(c.createdAt),
        updatedAt: timestampToIso(c.updatedAt),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async updateUserPreferences(
    uid: string,
    patch: Partial<Pick<UserProfile, 'theme' | 'defaultCurrency' | 'timezone' | 'activeWorkspaceId' | 'displayName'>>
  ): Promise<UserProfile> {
    const path = `users/${uid}`;
    try {
      const ref = doc(db, 'users', uid);
      const updatePayload: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (patch.theme !== undefined) updatePayload.theme = patch.theme;
      if (patch.defaultCurrency !== undefined) updatePayload.defaultCurrency = patch.defaultCurrency;
      if (patch.timezone !== undefined) updatePayload.timezone = patch.timezone.slice(0, 64);
      if (patch.activeWorkspaceId !== undefined) updatePayload.activeWorkspaceId = patch.activeWorkspaceId;
      if (patch.displayName !== undefined) {
        const trimmedName = patch.displayName.trim().slice(0, 100);
        if (trimmedName.length > 0) {
          updatePayload.displayName = trimmedName;
        }
      }

      await updateDoc(ref, updatePayload);
      const snap = await getDoc(ref);
      const d = snap.data()!;
      return {
        uid: d.uid,
        email: d.email ?? null,
        displayName: d.displayName,
        photoUrl: d.photoUrl ?? null,
        theme: d.theme,
        defaultCurrency: d.defaultCurrency,
        timezone: d.timezone,
        activeWorkspaceId: d.activeWorkspaceId ?? null,
        createdAt: timestampToIso(d.createdAt),
        updatedAt: timestampToIso(d.updatedAt),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async listWorkspaces(ownerId: string): Promise<Workspace[]> {
    const path = 'workspaces';
    try {
      const q = query(collection(db, path), where('ownerId', '==', ownerId));
      const snap = await getDocs(q);
      return snap.docs
        .map((docSnap) => this.mapWorkspaceDoc(docSnap.data()))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createWorkspace(ownerId: string, input: WorkspaceInput): Promise<Workspace> {
    const valid = workspaceInputSchema.parse(input);
    const workspaceId = generateId('ws');
    const path = `workspaces/${workspaceId}`;
    try {
      const wsRef = doc(db, 'workspaces', workspaceId);
      const wsPayload = {
        id: workspaceId,
        ownerId,
        name: valid.name,
        description: valid.description,
        baseCurrency: valid.baseCurrency,
        timezone: valid.timezone,
        status: 'active' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(wsRef, wsPayload);
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'workspace',
        workspaceId,
        'create',
        `Created workspace "${valid.name}" (${valid.baseCurrency})`
      );
      const snap = await getDoc(wsRef);
      return this.mapWorkspaceDoc(snap.data() ?? wsPayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updateWorkspace(ownerId: string, workspaceId: string, input: WorkspaceInput): Promise<Workspace> {
    const valid = workspaceInputSchema.parse(input);
    const path = `workspaces/${workspaceId}`;
    try {
      const ref = doc(db, 'workspaces', workspaceId);
      await updateDoc(ref, {
        name: valid.name,
        description: valid.description,
        baseCurrency: valid.baseCurrency,
        timezone: valid.timezone,
        updatedAt: serverTimestamp(),
      });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'workspace',
        workspaceId,
        'update',
        `Updated workspace "${valid.name}" (${valid.baseCurrency} · ${valid.timezone})`
      );
      const snap = await getDoc(ref);
      return this.mapWorkspaceDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async setWorkspaceStatus(
    ownerId: string,
    workspaceId: string,
    status: WorkspaceStatus
  ): Promise<Workspace> {
    const path = `workspaces/${workspaceId}`;
    try {
      const ref = doc(db, 'workspaces', workspaceId);
      await updateDoc(ref, {
        status,
        updatedAt: serverTimestamp(),
      });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'workspace',
        workspaceId,
        status === 'archived' ? 'archive' : 'restore',
        `${status === 'archived' ? 'Archived' : 'Restored'} workspace`
      );
      const snap = await getDoc(ref);
      return this.mapWorkspaceDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async listPortfolios(ownerId: string, workspaceId: string): Promise<Portfolio[]> {
    const path = `workspaces/${workspaceId}/portfolios`;
    try {
      const q = query(collection(db, path), where('ownerId', '==', ownerId));
      const snap = await getDocs(q);
      return snap.docs
        .map((docSnap) => this.mapPortfolioDoc(docSnap.data()))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createPortfolio(ownerId: string, workspaceId: string, input: PortfolioInput): Promise<Portfolio> {
    const valid = portfolioInputSchema.parse(input);
    const portfolioId = generateId('pf');
    const path = `workspaces/${workspaceId}/portfolios/${portfolioId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/portfolios`, portfolioId);
      const payload = {
        id: portfolioId,
        workspaceId,
        ownerId,
        name: valid.name,
        description: valid.description,
        baseCurrency: valid.baseCurrency,
        status: 'active' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      await this.appendAuditLog(ownerId, workspaceId, 'portfolio', portfolioId, 'create', `Created portfolio "${valid.name}"`);
      const snap = await getDoc(ref);
      return this.mapPortfolioDoc(snap.data() ?? payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updatePortfolio(
    ownerId: string,
    workspaceId: string,
    portfolioId: string,
    input: PortfolioInput
  ): Promise<Portfolio> {
    const valid = portfolioInputSchema.parse(input);
    const path = `workspaces/${workspaceId}/portfolios/${portfolioId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/portfolios`, portfolioId);
      await updateDoc(ref, {
        name: valid.name,
        description: valid.description,
        baseCurrency: valid.baseCurrency,
        updatedAt: serverTimestamp(),
      });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'portfolio',
        portfolioId,
        'update',
        `Updated portfolio "${valid.name}" (${valid.baseCurrency})`
      );
      const snap = await getDoc(ref);
      return this.mapPortfolioDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async setPortfolioStatus(
    ownerId: string,
    workspaceId: string,
    portfolioId: string,
    status: WorkspaceStatus
  ): Promise<Portfolio> {
    const path = `workspaces/${workspaceId}/portfolios/${portfolioId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/portfolios`, portfolioId);
      await updateDoc(ref, {
        status,
        updatedAt: serverTimestamp(),
      });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'portfolio',
        portfolioId,
        status === 'archived' ? 'archive' : 'restore',
        `${status === 'archived' ? 'Archived' : 'Restored'} portfolio`
      );
      const snap = await getDoc(ref);
      return this.mapPortfolioDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deletePortfolio(ownerId: string, workspaceId: string, portfolioId: string): Promise<void> {
    const path = `workspaces/${workspaceId}/portfolios/${portfolioId}`;
    try {
      const batch = writeBatch(db);
      const accSnap = await getDocs(
        query(collection(db, `workspaces/${workspaceId}/accounts`), where('ownerId', '==', ownerId))
      );
      for (const accDoc of accSnap.docs) {
        if (accDoc.data().portfolioId === portfolioId) {
          batch.update(accDoc.ref, { portfolioId: null, updatedAt: serverTimestamp() });
        }
      }
      batch.delete(doc(db, `workspaces/${workspaceId}/portfolios`, portfolioId));
      const logId = generateId('log');
      batch.set(doc(db, `workspaces/${workspaceId}/auditLogs`, logId), {
        id: logId,
        workspaceId,
        ownerId,
        entityType: 'portfolio',
        entityId: portfolioId,
        action: 'delete',
        summary: 'Deleted portfolio and unassigned linked accounts',
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async listAccounts(ownerId: string, workspaceId: string): Promise<Account[]> {
    const path = `workspaces/${workspaceId}/accounts`;
    try {
      const q = query(collection(db, path), where('ownerId', '==', ownerId));
      const snap = await getDocs(q);
      return snap.docs
        .map((docSnap) => this.mapAccountDoc(docSnap.data()))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createAccount(ownerId: string, workspaceId: string, input: AccountInput): Promise<Account> {
    const valid = accountInputSchema.parse(input);
    const accountId = generateId('acc');
    const path = `workspaces/${workspaceId}/accounts/${accountId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/accounts`, accountId);
      const payload = {
        id: accountId,
        workspaceId,
        portfolioId: valid.portfolioId,
        ownerId,
        name: valid.name,
        accountIdentifierMasked: valid.accountIdentifierMasked,
        accountType: valid.accountType,
        customCategory: valid.customCategory ?? null,
        status: valid.status,
        brokerId: valid.brokerId ?? null,
        brokerName: valid.brokerName,
        propFirmId: valid.propFirmId ?? null,
        propFirmName: valid.propFirmName,
        platformId: valid.platformId ?? null,
        platformName: valid.platformName,
        baseCurrency: valid.baseCurrency,
        timezone: valid.timezone,
        startingBalance: valid.startingBalance,
        verifiedBalanceSnapshot: valid.verifiedBalanceSnapshot,
        verifiedEquitySnapshot: valid.verifiedEquitySnapshot,
        snapshotAsOf: valid.snapshotAsOf,
        reconciliationNotes: valid.reconciliationNotes,
        openingDate: valid.openingDate,
        challengePhase: valid.challengePhase,
        profitTargetAmount: valid.profitTargetAmount,
        profitTargetPct: valid.profitTargetPct,
        maxDailyLossAmount: valid.maxDailyLossAmount,
        maxDailyLossPct: valid.maxDailyLossPct,
        maxOverallLossAmount: valid.maxOverallLossAmount,
        maxOverallLossPct: valid.maxOverallLossPct,
        drawdownMode: valid.drawdownMode,
        minTradingDays: valid.minTradingDays,
        maxTradingDays: valid.maxTradingDays,
        notes: valid.notes,
        tags: valid.tags,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'account',
        accountId,
        'create',
        `Created account "${valid.name}" (${valid.baseCurrency} ${valid.startingBalance})`
      );
      const snap = await getDoc(ref);
      return this.mapAccountDoc(snap.data() ?? payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updateAccount(
    ownerId: string,
    workspaceId: string,
    accountId: string,
    input: AccountInput
  ): Promise<Account> {
    const valid = accountInputSchema.parse(input);
    const path = `workspaces/${workspaceId}/accounts/${accountId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/accounts`, accountId);
      await updateDoc(ref, {
        portfolioId: valid.portfolioId,
        name: valid.name,
        accountIdentifierMasked: valid.accountIdentifierMasked,
        accountType: valid.accountType,
        customCategory: valid.customCategory ?? null,
        status: valid.status,
        brokerId: valid.brokerId ?? null,
        brokerName: valid.brokerName,
        propFirmId: valid.propFirmId ?? null,
        propFirmName: valid.propFirmName,
        platformId: valid.platformId ?? null,
        platformName: valid.platformName,
        baseCurrency: valid.baseCurrency,
        timezone: valid.timezone,
        startingBalance: valid.startingBalance,
        verifiedBalanceSnapshot: valid.verifiedBalanceSnapshot,
        verifiedEquitySnapshot: valid.verifiedEquitySnapshot,
        snapshotAsOf: valid.snapshotAsOf,
        reconciliationNotes: valid.reconciliationNotes,
        openingDate: valid.openingDate,
        challengePhase: valid.challengePhase,
        profitTargetAmount: valid.profitTargetAmount,
        profitTargetPct: valid.profitTargetPct,
        maxDailyLossAmount: valid.maxDailyLossAmount,
        maxDailyLossPct: valid.maxDailyLossPct,
        maxOverallLossAmount: valid.maxOverallLossAmount,
        maxOverallLossPct: valid.maxOverallLossPct,
        drawdownMode: valid.drawdownMode,
        minTradingDays: valid.minTradingDays,
        maxTradingDays: valid.maxTradingDays,
        notes: valid.notes,
        tags: valid.tags,
        updatedAt: serverTimestamp(),
      });
      await this.appendAuditLog(ownerId, workspaceId, 'account', accountId, 'update', `Updated account "${valid.name}"`);
      const snap = await getDoc(ref);
      return this.mapAccountDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async setAccountStatus(
    ownerId: string,
    workspaceId: string,
    accountId: string,
    status: Account['status']
  ): Promise<Account> {
    const path = `workspaces/${workspaceId}/accounts/${accountId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/accounts`, accountId);
      await updateDoc(ref, {
        status,
        updatedAt: serverTimestamp(),
      });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'account',
        accountId,
        status === 'archived' ? 'archive' : 'restore',
        `Changed account status to "${status}"`
      );
      const snap = await getDoc(ref);
      return this.mapAccountDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteAccount(ownerId: string, workspaceId: string, accountId: string): Promise<void> {
    const path = `workspaces/${workspaceId}/accounts/${accountId}`;
    try {
      const batch = writeBatch(db);
      const [txSnap, snapSnap, tradeSnap] = await Promise.all([
        getDocs(query(collection(db, `workspaces/${workspaceId}/cashTransactions`), where('ownerId', '==', ownerId))),
        getDocs(query(collection(db, `workspaces/${workspaceId}/balanceSnapshots`), where('ownerId', '==', ownerId))),
        getDocs(query(collection(db, `workspaces/${workspaceId}/trades`), where('ownerId', '==', ownerId))),
      ]);
      for (const d of txSnap.docs) {
        if (d.data().accountId === accountId) batch.delete(d.ref);
      }
      for (const d of snapSnap.docs) {
        if (d.data().accountId === accountId) batch.delete(d.ref);
      }
      for (const d of tradeSnap.docs) {
        if (d.data().accountId === accountId) batch.delete(d.ref);
      }
      batch.delete(doc(db, `workspaces/${workspaceId}/accounts`, accountId));
      const logId = generateId('log');
      batch.set(doc(db, `workspaces/${workspaceId}/auditLogs`, logId), {
        id: logId,
        workspaceId,
        ownerId,
        entityType: 'account',
        entityId: accountId,
        action: 'delete',
        summary: 'Deleted trading account and associated ledger movements, snapshots, and trades',
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async listCashTransactions(ownerId: string, workspaceId: string): Promise<CashTransaction[]> {
    const path = `workspaces/${workspaceId}/cashTransactions`;
    try {
      const q = query(collection(db, path), where('ownerId', '==', ownerId));
      const snap = await getDocs(q);
      return snap.docs
        .map((docSnap) => this.mapCashTxDoc(docSnap.data()))
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createCashTransaction(
    ownerId: string,
    workspaceId: string,
    input: CashTransactionInput
  ): Promise<CashTransaction> {
    const valid = cashTransactionInputSchema.parse(input);
    const txId = generateId('tx');
    const path = `workspaces/${workspaceId}/cashTransactions/${txId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/cashTransactions`, txId);
      const payload = {
        id: txId,
        workspaceId,
        accountId: valid.accountId,
        ownerId,
        type: valid.type,
        amount: valid.amount,
        currency: valid.currency,
        grossAmount: valid.grossAmount,
        splitPct: valid.splitPct,
        occurredAt: valid.occurredAt,
        notes: valid.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'cash_transaction',
        txId,
        'create',
        `Recorded ${valid.type} of ${valid.currency} ${valid.amount}`
      );
      const snap = await getDoc(ref);
      return this.mapCashTxDoc(snap.data() ?? payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updateCashTransaction(
    ownerId: string,
    workspaceId: string,
    transactionId: string,
    input: CashTransactionInput
  ): Promise<CashTransaction> {
    const valid = cashTransactionInputSchema.parse(input);
    const path = `workspaces/${workspaceId}/cashTransactions/${transactionId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/cashTransactions`, transactionId);
      await updateDoc(ref, {
        type: valid.type,
        amount: valid.amount,
        currency: valid.currency,
        grossAmount: valid.grossAmount,
        splitPct: valid.splitPct,
        occurredAt: valid.occurredAt,
        notes: valid.notes,
        updatedAt: serverTimestamp(),
      });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'cash_transaction',
        transactionId,
        'update',
        `Updated ${valid.type} movement (${valid.currency} ${valid.amount})`
      );
      const snap = await getDoc(ref);
      return this.mapCashTxDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteCashTransaction(ownerId: string, workspaceId: string, transactionId: string): Promise<void> {
    const path = `workspaces/${workspaceId}/cashTransactions/${transactionId}`;
    try {
      await deleteDoc(doc(db, `workspaces/${workspaceId}/cashTransactions`, transactionId));
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'cash_transaction',
        transactionId,
        'delete',
        'Deleted cash movement entry'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async listBalanceSnapshots(ownerId: string, workspaceId: string): Promise<BalanceSnapshot[]> {
    const path = `workspaces/${workspaceId}/balanceSnapshots`;
    try {
      const q = query(collection(db, path), where('ownerId', '==', ownerId));
      const snap = await getDocs(q);
      return snap.docs
        .map((docSnap) => this.mapSnapshotDoc(docSnap.data()))
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt) || b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async recordBalanceSnapshot(
    ownerId: string,
    workspaceId: string,
    input: BalanceSnapshotInput,
    reconciliation: {
      calculatedLedgerBalance: string;
      reconciliationDelta: string;
      reconciliationStatus: 'reconciled' | 'discrepancy';
    }
  ): Promise<{ snapshot: BalanceSnapshot; account: Account }> {
    const valid = balanceSnapshotInputSchema.parse(input);
    const snapshotId = generateId('snap');
    const path = `workspaces/${workspaceId}/balanceSnapshots/${snapshotId}`;
    try {
      const batch = writeBatch(db);
      const snapRef = doc(db, `workspaces/${workspaceId}/balanceSnapshots`, snapshotId);
      const snapPayload = {
        id: snapshotId,
        workspaceId,
        accountId: valid.accountId,
        ownerId,
        balance: valid.balance,
        equity: valid.equity,
        capturedAt: valid.capturedAt,
        calculatedLedgerBalance: reconciliation.calculatedLedgerBalance,
        reconciliationDelta: reconciliation.reconciliationDelta,
        reconciliationStatus: reconciliation.reconciliationStatus,
        notes: valid.notes,
        createdAt: serverTimestamp(),
      };
      batch.set(snapRef, snapPayload);

      const accRef = doc(db, `workspaces/${workspaceId}/accounts`, valid.accountId);
      batch.update(accRef, {
        verifiedBalanceSnapshot: valid.balance,
        verifiedEquitySnapshot: valid.equity,
        snapshotAsOf: valid.capturedAt,
        reconciliationNotes: valid.notes,
        updatedAt: serverTimestamp(),
      });

      const logId = generateId('log');
      batch.set(doc(db, `workspaces/${workspaceId}/auditLogs`, logId), {
        id: logId,
        workspaceId,
        ownerId,
        entityType: 'balance_snapshot',
        entityId: snapshotId,
        action: 'reconcile',
        summary: `Recorded balance snapshot ${valid.balance} (${reconciliation.reconciliationStatus})`,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      const [createdSnap, updatedAcc] = await Promise.all([getDoc(snapRef), getDoc(accRef)]);
      return {
        snapshot: this.mapSnapshotDoc(createdSnap.data() ?? snapPayload),
        account: this.mapAccountDoc(updatedAcc.data()!),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async listBrokers(ownerId: string, workspaceId: string): Promise<Broker[]> {
    const path = `workspaces/${workspaceId}/brokers`;
    try {
      const snap = await getDocs(query(collection(db, path), where('ownerId', '==', ownerId)));
      return snap.docs.map((d) => this.mapBrokerDoc(d.data())).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createBroker(ownerId: string, workspaceId: string, input: BrokerInput): Promise<Broker> {
    const valid = brokerInputSchema.parse(input);
    const id = generateId('brk');
    const path = `workspaces/${workspaceId}/brokers/${id}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/brokers`, id);
      const payload = {
        id,
        workspaceId,
        ownerId,
        name: valid.name,
        website: valid.website,
        notes: valid.notes,
        status: 'active' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      await this.appendAuditLog(ownerId, workspaceId, 'broker', id, 'create', `Added broker "${valid.name}"`);
      const snap = await getDoc(ref);
      return this.mapBrokerDoc(snap.data() ?? payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updateBroker(
    ownerId: string,
    workspaceId: string,
    brokerId: string,
    input: BrokerInput
  ): Promise<Broker> {
    const valid = brokerInputSchema.parse(input);
    const path = `workspaces/${workspaceId}/brokers/${brokerId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/brokers`, brokerId);
      await updateDoc(ref, {
        name: valid.name,
        website: valid.website,
        notes: valid.notes,
        updatedAt: serverTimestamp(),
      });
      await this.appendAuditLog(ownerId, workspaceId, 'broker', brokerId, 'update', `Updated broker "${valid.name}"`);
      const snap = await getDoc(ref);
      return this.mapBrokerDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async setBrokerStatus(
    ownerId: string,
    workspaceId: string,
    brokerId: string,
    status: WorkspaceStatus
  ): Promise<Broker> {
    const path = `workspaces/${workspaceId}/brokers/${brokerId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/brokers`, brokerId);
      await updateDoc(ref, { status, updatedAt: serverTimestamp() });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'broker',
        brokerId,
        status === 'archived' ? 'archive' : 'restore',
        `${status === 'archived' ? 'Archived' : 'Restored'} broker reference`
      );
      const snap = await getDoc(ref);
      return this.mapBrokerDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteBroker(ownerId: string, workspaceId: string, brokerId: string): Promise<void> {
    const path = `workspaces/${workspaceId}/brokers/${brokerId}`;
    try {
      await deleteDoc(doc(db, `workspaces/${workspaceId}/brokers`, brokerId));
      await this.appendAuditLog(ownerId, workspaceId, 'broker', brokerId, 'delete', 'Deleted broker reference');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async listTradingPlatforms(ownerId: string, workspaceId: string): Promise<TradingPlatform[]> {
    const path = `workspaces/${workspaceId}/platforms`;
    try {
      const snap = await getDocs(query(collection(db, path), where('ownerId', '==', ownerId)));
      return snap.docs.map((d) => this.mapPlatformDoc(d.data())).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createTradingPlatform(
    ownerId: string,
    workspaceId: string,
    input: TradingPlatformInput
  ): Promise<TradingPlatform> {
    const valid = tradingPlatformInputSchema.parse(input);
    const id = generateId('plt');
    const path = `workspaces/${workspaceId}/platforms/${id}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/platforms`, id);
      const payload = {
        id,
        workspaceId,
        ownerId,
        name: valid.name,
        vendor: valid.vendor,
        notes: valid.notes,
        status: 'active' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      await this.appendAuditLog(ownerId, workspaceId, 'platform', id, 'create', `Added platform "${valid.name}"`);
      const snap = await getDoc(ref);
      return this.mapPlatformDoc(snap.data() ?? payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updateTradingPlatform(
    ownerId: string,
    workspaceId: string,
    platformId: string,
    input: TradingPlatformInput
  ): Promise<TradingPlatform> {
    const valid = tradingPlatformInputSchema.parse(input);
    const path = `workspaces/${workspaceId}/platforms/${platformId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/platforms`, platformId);
      await updateDoc(ref, {
        name: valid.name,
        vendor: valid.vendor,
        notes: valid.notes,
        updatedAt: serverTimestamp(),
      });
      await this.appendAuditLog(ownerId, workspaceId, 'platform', platformId, 'update', `Updated platform "${valid.name}"`);
      const snap = await getDoc(ref);
      return this.mapPlatformDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async setTradingPlatformStatus(
    ownerId: string,
    workspaceId: string,
    platformId: string,
    status: WorkspaceStatus
  ): Promise<TradingPlatform> {
    const path = `workspaces/${workspaceId}/platforms/${platformId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/platforms`, platformId);
      await updateDoc(ref, { status, updatedAt: serverTimestamp() });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'platform',
        platformId,
        status === 'archived' ? 'archive' : 'restore',
        `${status === 'archived' ? 'Archived' : 'Restored'} trading platform reference`
      );
      const snap = await getDoc(ref);
      return this.mapPlatformDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteTradingPlatform(ownerId: string, workspaceId: string, platformId: string): Promise<void> {
    const path = `workspaces/${workspaceId}/platforms/${platformId}`;
    try {
      await deleteDoc(doc(db, `workspaces/${workspaceId}/platforms`, platformId));
      await this.appendAuditLog(ownerId, workspaceId, 'platform', platformId, 'delete', 'Deleted trading platform reference');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async listPropFirms(ownerId: string, workspaceId: string): Promise<PropFirm[]> {
    const path = `workspaces/${workspaceId}/propFirms`;
    try {
      const snap = await getDocs(query(collection(db, path), where('ownerId', '==', ownerId)));
      return snap.docs.map((d) => this.mapPropFirmDoc(d.data())).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createPropFirm(ownerId: string, workspaceId: string, input: PropFirmInput): Promise<PropFirm> {
    const valid = propFirmInputSchema.parse(input);
    const id = generateId('firm');
    const path = `workspaces/${workspaceId}/propFirms/${id}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/propFirms`, id);
      const payload = {
        id,
        workspaceId,
        ownerId,
        name: valid.name,
        website: valid.website,
        notes: valid.notes,
        status: 'active' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      await this.appendAuditLog(ownerId, workspaceId, 'prop_firm', id, 'create', `Added prop firm "${valid.name}"`);
      const snap = await getDoc(ref);
      return this.mapPropFirmDoc(snap.data() ?? payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updatePropFirm(
    ownerId: string,
    workspaceId: string,
    firmId: string,
    input: PropFirmInput
  ): Promise<PropFirm> {
    const valid = propFirmInputSchema.parse(input);
    const path = `workspaces/${workspaceId}/propFirms/${firmId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/propFirms`, firmId);
      await updateDoc(ref, {
        name: valid.name,
        website: valid.website,
        notes: valid.notes,
        updatedAt: serverTimestamp(),
      });
      await this.appendAuditLog(ownerId, workspaceId, 'prop_firm', firmId, 'update', `Updated prop firm "${valid.name}"`);
      const snap = await getDoc(ref);
      return this.mapPropFirmDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async setPropFirmStatus(
    ownerId: string,
    workspaceId: string,
    firmId: string,
    status: WorkspaceStatus
  ): Promise<PropFirm> {
    const path = `workspaces/${workspaceId}/propFirms/${firmId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/propFirms`, firmId);
      await updateDoc(ref, { status, updatedAt: serverTimestamp() });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'prop_firm',
        firmId,
        status === 'archived' ? 'archive' : 'restore',
        `${status === 'archived' ? 'Archived' : 'Restored'} prop firm reference`
      );
      const snap = await getDoc(ref);
      return this.mapPropFirmDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deletePropFirm(ownerId: string, workspaceId: string, firmId: string): Promise<void> {
    const path = `workspaces/${workspaceId}/propFirms/${firmId}`;
    try {
      await deleteDoc(doc(db, `workspaces/${workspaceId}/propFirms`, firmId));
      await this.appendAuditLog(ownerId, workspaceId, 'prop_firm', firmId, 'delete', 'Deleted prop firm reference');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async listFXRates(ownerId: string, workspaceId: string): Promise<FXRateSnapshot[]> {
    const path = `workspaces/${workspaceId}/fxRates`;
    try {
      const snap = await getDocs(query(collection(db, path), where('ownerId', '==', ownerId)));
      return snap.docs
        .map((d) => this.mapFXRateDoc(d.data()))
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createFXRate(ownerId: string, workspaceId: string, input: FXRateInput): Promise<FXRateSnapshot> {
    const valid = fxRateInputSchema.parse(input);
    const id = generateId('fx');
    const path = `workspaces/${workspaceId}/fxRates/${id}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/fxRates`, id);
      const payload = {
        id,
        workspaceId,
        ownerId,
        baseCurrency: valid.baseCurrency,
        quoteCurrency: valid.quoteCurrency,
        rate: valid.rate,
        capturedAt: valid.capturedAt,
        source: valid.source,
        notes: valid.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'fx_rate',
        id,
        'create',
        `Recorded FX rate ${valid.baseCurrency}/${valid.quoteCurrency} = ${valid.rate}`
      );
      const snap = await getDoc(ref);
      return this.mapFXRateDoc(snap.data() ?? payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updateFXRate(
    ownerId: string,
    workspaceId: string,
    rateId: string,
    input: FXRateInput
  ): Promise<FXRateSnapshot> {
    const valid = fxRateInputSchema.parse(input);
    const path = `workspaces/${workspaceId}/fxRates/${rateId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/fxRates`, rateId);
      await updateDoc(ref, {
        rate: valid.rate,
        capturedAt: valid.capturedAt,
        source: valid.source,
        notes: valid.notes,
        updatedAt: serverTimestamp(),
      });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'fx_rate',
        rateId,
        'update',
        `Updated FX rate ${valid.baseCurrency}/${valid.quoteCurrency} = ${valid.rate}`
      );
      const snap = await getDoc(ref);
      return this.mapFXRateDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteFXRate(ownerId: string, workspaceId: string, rateId: string): Promise<void> {
    const path = `workspaces/${workspaceId}/fxRates/${rateId}`;
    try {
      await deleteDoc(doc(db, `workspaces/${workspaceId}/fxRates`, rateId));
      await this.appendAuditLog(ownerId, workspaceId, 'fx_rate', rateId, 'delete', 'Deleted FX rate snapshot');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async listInstruments(ownerId: string, workspaceId: string): Promise<InstrumentSpecification[]> {
    const path = `workspaces/${workspaceId}/instruments`;
    try {
      const snap = await getDocs(query(collection(db, path), where('ownerId', '==', ownerId)));
      return snap.docs
        .map((d) => this.mapInstrumentDoc(d.data()))
        .sort((a, b) => a.symbol.localeCompare(b.symbol));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createInstrument(
    ownerId: string,
    workspaceId: string,
    input: InstrumentSpecInput
  ): Promise<InstrumentSpecification> {
    const valid = instrumentSpecInputSchema.parse(input);
    const id = generateId('inst');
    const path = `workspaces/${workspaceId}/instruments/${id}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/instruments`, id);
      const payload = {
        id,
        workspaceId,
        ownerId,
        symbol: valid.symbol,
        displayName: valid.displayName,
        assetClass: valid.assetClass,
        baseCurrency: valid.baseCurrency,
        quoteCurrency: valid.quoteCurrency,
        profitCurrency: valid.profitCurrency,
        contractSize: valid.contractSize,
        tickSize: valid.tickSize,
        pipSize: valid.pipSize,
        tickValue: valid.tickValue,
        quantityUnit: valid.quantityUnit,
        status: 'active' as const,
        notes: valid.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'instrument',
        id,
        'create',
        `Added instrument specification ${valid.symbol} (${valid.assetClass})`
      );
      const snap = await getDoc(ref);
      return this.mapInstrumentDoc(snap.data() ?? payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updateInstrument(
    ownerId: string,
    workspaceId: string,
    instrumentId: string,
    input: InstrumentSpecInput
  ): Promise<InstrumentSpecification> {
    const valid = instrumentSpecInputSchema.parse(input);
    const path = `workspaces/${workspaceId}/instruments/${instrumentId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/instruments`, instrumentId);
      await updateDoc(ref, {
        symbol: valid.symbol,
        displayName: valid.displayName,
        assetClass: valid.assetClass,
        baseCurrency: valid.baseCurrency,
        quoteCurrency: valid.quoteCurrency,
        profitCurrency: valid.profitCurrency,
        contractSize: valid.contractSize,
        tickSize: valid.tickSize,
        pipSize: valid.pipSize,
        tickValue: valid.tickValue,
        quantityUnit: valid.quantityUnit,
        notes: valid.notes,
        updatedAt: serverTimestamp(),
      });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'instrument',
        instrumentId,
        'update',
        `Updated instrument specification ${valid.symbol}`
      );
      const snap = await getDoc(ref);
      return this.mapInstrumentDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async setInstrumentStatus(
    ownerId: string,
    workspaceId: string,
    instrumentId: string,
    status: WorkspaceStatus
  ): Promise<InstrumentSpecification> {
    const path = `workspaces/${workspaceId}/instruments/${instrumentId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/instruments`, instrumentId);
      await updateDoc(ref, { status, updatedAt: serverTimestamp() });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'instrument',
        instrumentId,
        status === 'archived' ? 'archive' : 'restore',
        `${status === 'archived' ? 'Archived' : 'Restored'} instrument specification`
      );
      const snap = await getDoc(ref);
      return this.mapInstrumentDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteInstrument(ownerId: string, workspaceId: string, instrumentId: string): Promise<void> {
    const path = `workspaces/${workspaceId}/instruments/${instrumentId}`;
    try {
      await deleteDoc(doc(db, `workspaces/${workspaceId}/instruments`, instrumentId));
      await this.appendAuditLog(ownerId, workspaceId, 'instrument', instrumentId, 'delete', 'Deleted instrument specification');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async listTrades(ownerId: string, workspaceId: string): Promise<Trade[]> {
    const path = `workspaces/${workspaceId}/trades`;
    try {
      const snap = await getDocs(query(collection(db, path), where('ownerId', '==', ownerId)));
      return snap.docs
        .map((d) => this.mapTradeDoc(d.data()))
        .sort((a, b) => (b.entryAt ?? b.createdAt).localeCompare(a.entryAt ?? a.createdAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createTrade(
    ownerId: string,
    workspaceId: string,
    input: TradeInput,
    context: { portfolioId: string | null; accountCurrency: string }
  ): Promise<Trade> {
    const valid = tradeInputSchema.parse(input);
    const tradeId = generateId('trd');
    const path = `workspaces/${workspaceId}/trades/${tradeId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/trades`, tradeId);
      const payload = {
        id: tradeId,
        workspaceId,
        portfolioId: context.portfolioId,
        accountId: valid.accountId,
        ownerId,
        externalTicketId: valid.externalTicketId,
        symbol: valid.symbol,
        instrumentId: valid.instrumentId,
        direction: valid.direction,
        status: valid.status,
        isArchived: valid.isArchived,
        session: valid.session,
        timeframes: valid.timeframes,
        timezone: valid.timezone,
        accountCurrency: context.accountCurrency,
        accountBalanceSnapshot: valid.accountBalanceSnapshot,
        entryAt: valid.entryAt,
        entryPrice: valid.entryPrice,
        quantity: valid.quantity,
        entryType: valid.entryType,
        leverage: valid.leverage,
        marginUsed: valid.marginUsed,
        entryRationale: valid.entryRationale,
        initialStopPrice: valid.initialStopPrice,
        actualStopPrice: valid.actualStopPrice,
        plannedTargetPrice: valid.plannedTargetPrice,
        plannedRiskAmount: valid.plannedRiskAmount,
        plannedRiskPct: valid.plannedRiskPct,
        actualRiskAmount: valid.actualRiskAmount,
        exitAt: valid.exitAt,
        exitPrice: valid.exitPrice,
        exitQuantity: valid.exitQuantity,
        exitReason: valid.exitReason,
        manualGrossPnl: valid.manualGrossPnl,
        fxConversionRate: valid.fxConversionRate,
        playbookId: null,
        setupId: null,
        setupTag: valid.setupTag,
        commission: valid.commission,
        swap: valid.swap,
        fees: valid.fees,
        slippage: valid.slippage,
        spread: valid.spread,
        marketConditions: valid.marketConditions,
        entryNotes: valid.entryNotes,
        reviewNotes: valid.reviewNotes,
        tags: valid.tags,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'trade',
        tradeId,
        'create',
        `Logged ${valid.status} ${valid.direction} trade on ${valid.symbol}`
      );
      const snap = await getDoc(ref);
      return this.mapTradeDoc(snap.data() ?? payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updateTrade(
    ownerId: string,
    workspaceId: string,
    tradeId: string,
    input: TradeInput,
    context: { portfolioId: string | null; accountCurrency: string }
  ): Promise<Trade> {
    const valid = tradeInputSchema.parse(input);
    const path = `workspaces/${workspaceId}/trades/${tradeId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/trades`, tradeId);
      await updateDoc(ref, {
        portfolioId: context.portfolioId,
        accountId: valid.accountId,
        externalTicketId: valid.externalTicketId,
        symbol: valid.symbol,
        instrumentId: valid.instrumentId,
        direction: valid.direction,
        status: valid.status,
        isArchived: valid.isArchived,
        session: valid.session,
        timeframes: valid.timeframes,
        timezone: valid.timezone,
        accountCurrency: context.accountCurrency,
        accountBalanceSnapshot: valid.accountBalanceSnapshot,
        entryAt: valid.entryAt,
        entryPrice: valid.entryPrice,
        quantity: valid.quantity,
        entryType: valid.entryType,
        leverage: valid.leverage,
        marginUsed: valid.marginUsed,
        entryRationale: valid.entryRationale,
        initialStopPrice: valid.initialStopPrice,
        actualStopPrice: valid.actualStopPrice,
        plannedTargetPrice: valid.plannedTargetPrice,
        plannedRiskAmount: valid.plannedRiskAmount,
        plannedRiskPct: valid.plannedRiskPct,
        actualRiskAmount: valid.actualRiskAmount,
        exitAt: valid.exitAt,
        exitPrice: valid.exitPrice,
        exitQuantity: valid.exitQuantity,
        exitReason: valid.exitReason,
        manualGrossPnl: valid.manualGrossPnl,
        fxConversionRate: valid.fxConversionRate,
        setupTag: valid.setupTag,
        commission: valid.commission,
        swap: valid.swap,
        fees: valid.fees,
        slippage: valid.slippage,
        spread: valid.spread,
        marketConditions: valid.marketConditions,
        entryNotes: valid.entryNotes,
        reviewNotes: valid.reviewNotes,
        tags: valid.tags,
        updatedAt: serverTimestamp(),
      });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'trade',
        tradeId,
        'update',
        `Updated ${valid.direction} trade on ${valid.symbol} (${valid.status})`
      );
      const snap = await getDoc(ref);
      return this.mapTradeDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async setTradeStatus(
    ownerId: string,
    workspaceId: string,
    tradeId: string,
    status: Trade['status']
  ): Promise<Trade> {
    const path = `workspaces/${workspaceId}/trades/${tradeId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/trades`, tradeId);
      await updateDoc(ref, { status, updatedAt: serverTimestamp() });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'trade',
        tradeId,
        'update',
        `Changed trade status to "${status}"`
      );
      const snap = await getDoc(ref);
      return this.mapTradeDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async setTradeArchived(
    ownerId: string,
    workspaceId: string,
    tradeId: string,
    isArchived: boolean
  ): Promise<Trade> {
    const path = `workspaces/${workspaceId}/trades/${tradeId}`;
    try {
      const ref = doc(db, `workspaces/${workspaceId}/trades`, tradeId);
      await updateDoc(ref, { isArchived, updatedAt: serverTimestamp() });
      await this.appendAuditLog(
        ownerId,
        workspaceId,
        'trade',
        tradeId,
        isArchived ? 'archive' : 'restore',
        `${isArchived ? 'Archived' : 'Restored'} trade record`
      );
      const snap = await getDoc(ref);
      return this.mapTradeDoc(snap.data()!);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteTrade(ownerId: string, workspaceId: string, tradeId: string): Promise<void> {
    const path = `workspaces/${workspaceId}/trades/${tradeId}`;
    try {
      await deleteDoc(doc(db, `workspaces/${workspaceId}/trades`, tradeId));
      await this.appendAuditLog(ownerId, workspaceId, 'trade', tradeId, 'delete', 'Deleted trade journal record');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async listAuditLogs(ownerId: string, workspaceId: string): Promise<AuditLog[]> {
    const path = `workspaces/${workspaceId}/auditLogs`;
    try {
      const q = query(collection(db, path), where('ownerId', '==', ownerId));
      const snap = await getDocs(q);
      return snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          return {
            id: d.id,
            workspaceId: d.workspaceId,
            ownerId: d.ownerId,
            entityType: d.entityType,
            entityId: d.entityId,
            action: d.action,
            summary: d.summary,
            createdAt: timestampToIso(d.createdAt),
          } as AuditLog;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  private async appendAuditLog(
    ownerId: string,
    workspaceId: string,
    entityType: AuditLog['entityType'],
    entityId: string,
    action: AuditLog['action'],
    summary: string
  ): Promise<void> {
    const logId = generateId('log');
    const ref = doc(db, `workspaces/${workspaceId}/auditLogs`, logId);
    await setDoc(ref, {
      id: logId,
      workspaceId,
      ownerId,
      entityType,
      entityId,
      action,
      summary: summary.slice(0, 240),
      createdAt: serverTimestamp(),
    });
  }

  private mapWorkspaceDoc(d: Record<string, unknown>): Workspace {
    return {
      id: String(d.id),
      ownerId: String(d.ownerId),
      name: String(d.name),
      description: (d.description as string | null) ?? null,
      baseCurrency: String(d.baseCurrency),
      timezone: String(d.timezone),
      status: (d.status as WorkspaceStatus) ?? 'active',
      createdAt: timestampToIso(d.createdAt),
      updatedAt: timestampToIso(d.updatedAt),
    };
  }

  private mapPortfolioDoc(d: Record<string, unknown>): Portfolio {
    return {
      id: String(d.id),
      workspaceId: String(d.workspaceId),
      ownerId: String(d.ownerId),
      name: String(d.name),
      description: (d.description as string | null) ?? null,
      baseCurrency: String(d.baseCurrency),
      status: (d.status as WorkspaceStatus) ?? 'active',
      createdAt: timestampToIso(d.createdAt),
      updatedAt: timestampToIso(d.updatedAt),
    };
  }

  private mapCashTxDoc(d: Record<string, unknown>): CashTransaction {
    return {
      id: String(d.id),
      workspaceId: String(d.workspaceId),
      accountId: String(d.accountId),
      ownerId: String(d.ownerId),
      type: d.type as CashTransaction['type'],
      amount: String(d.amount),
      currency: String(d.currency),
      grossAmount: (d.grossAmount as string | null) ?? null,
      splitPct: (d.splitPct as string | null) ?? null,
      occurredAt: String(d.occurredAt),
      notes: (d.notes as string | null) ?? null,
      createdAt: timestampToIso(d.createdAt),
      updatedAt: timestampToIso(d.updatedAt),
    };
  }

  private mapSnapshotDoc(d: Record<string, unknown>): BalanceSnapshot {
    return {
      id: String(d.id),
      workspaceId: String(d.workspaceId),
      accountId: String(d.accountId),
      ownerId: String(d.ownerId),
      balance: String(d.balance),
      equity: (d.equity as string | null) ?? null,
      capturedAt: String(d.capturedAt),
      calculatedLedgerBalance: String(d.calculatedLedgerBalance),
      reconciliationDelta: String(d.reconciliationDelta),
      reconciliationStatus: d.reconciliationStatus as BalanceSnapshot['reconciliationStatus'],
      notes: (d.notes as string | null) ?? null,
      createdAt: timestampToIso(d.createdAt),
    };
  }

  private mapBrokerDoc(d: Record<string, unknown>): Broker {
    return {
      id: String(d.id),
      workspaceId: String(d.workspaceId),
      ownerId: String(d.ownerId),
      name: String(d.name),
      website: (d.website as string | null) ?? null,
      notes: (d.notes as string | null) ?? null,
      status: (d.status as WorkspaceStatus) ?? 'active',
      createdAt: timestampToIso(d.createdAt),
      updatedAt: timestampToIso(d.updatedAt),
    };
  }

  private mapPlatformDoc(d: Record<string, unknown>): TradingPlatform {
    return {
      id: String(d.id),
      workspaceId: String(d.workspaceId),
      ownerId: String(d.ownerId),
      name: String(d.name),
      vendor: (d.vendor as string | null) ?? null,
      notes: (d.notes as string | null) ?? null,
      status: (d.status as WorkspaceStatus) ?? 'active',
      createdAt: timestampToIso(d.createdAt),
      updatedAt: timestampToIso(d.updatedAt),
    };
  }

  private mapPropFirmDoc(d: Record<string, unknown>): PropFirm {
    return {
      id: String(d.id),
      workspaceId: String(d.workspaceId),
      ownerId: String(d.ownerId),
      name: String(d.name),
      website: (d.website as string | null) ?? null,
      notes: (d.notes as string | null) ?? null,
      status: (d.status as WorkspaceStatus) ?? 'active',
      createdAt: timestampToIso(d.createdAt),
      updatedAt: timestampToIso(d.updatedAt),
    };
  }

  private mapFXRateDoc(d: Record<string, unknown>): FXRateSnapshot {
    return {
      id: String(d.id),
      workspaceId: String(d.workspaceId),
      ownerId: String(d.ownerId),
      baseCurrency: String(d.baseCurrency),
      quoteCurrency: String(d.quoteCurrency),
      rate: String(d.rate),
      capturedAt: String(d.capturedAt),
      source: d.source as FXRateSnapshot['source'],
      notes: (d.notes as string | null) ?? null,
      createdAt: timestampToIso(d.createdAt),
      updatedAt: timestampToIso(d.updatedAt),
    };
  }

  private mapAccountDoc(d: Record<string, unknown>): Account {
    return {
      id: String(d.id),
      workspaceId: String(d.workspaceId),
      portfolioId: (d.portfolioId as string | null) ?? null,
      ownerId: String(d.ownerId),
      name: String(d.name),
      accountIdentifierMasked: (d.accountIdentifierMasked as string | null) ?? null,
      accountType: d.accountType as Account['accountType'],
      customCategory: (d.customCategory as string | null) ?? null,
      status: d.status as Account['status'],
      brokerId: (d.brokerId as string | null) ?? null,
      brokerName: (d.brokerName as string | null) ?? null,
      propFirmId: (d.propFirmId as string | null) ?? null,
      propFirmName: (d.propFirmName as string | null) ?? null,
      platformId: (d.platformId as string | null) ?? null,
      platformName: (d.platformName as string | null) ?? null,
      baseCurrency: String(d.baseCurrency),
      timezone: String(d.timezone),
      startingBalance: String(d.startingBalance),
      verifiedBalanceSnapshot: (d.verifiedBalanceSnapshot as string | null) ?? null,
      verifiedEquitySnapshot: (d.verifiedEquitySnapshot as string | null) ?? null,
      snapshotAsOf: (d.snapshotAsOf as string | null) ?? null,
      reconciliationNotes: (d.reconciliationNotes as string | null) ?? null,
      openingDate: (d.openingDate as string | null) ?? null,
      challengePhase: (d.challengePhase as string | null) ?? null,
      profitTargetAmount: (d.profitTargetAmount as string | null) ?? null,
      profitTargetPct: (d.profitTargetPct as string | null) ?? null,
      maxDailyLossAmount: (d.maxDailyLossAmount as string | null) ?? null,
      maxDailyLossPct: (d.maxDailyLossPct as string | null) ?? null,
      maxOverallLossAmount: (d.maxOverallLossAmount as string | null) ?? null,
      maxOverallLossPct: (d.maxOverallLossPct as string | null) ?? null,
      drawdownMode: (d.drawdownMode as Account['drawdownMode']) ?? 'none',
      minTradingDays: typeof d.minTradingDays === 'number' ? d.minTradingDays : null,
      maxTradingDays: typeof d.maxTradingDays === 'number' ? d.maxTradingDays : null,
      notes: (d.notes as string | null) ?? null,
      tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
      createdAt: timestampToIso(d.createdAt),
      updatedAt: timestampToIso(d.updatedAt),
    };
  }

  private mapInstrumentDoc(d: Record<string, unknown>): InstrumentSpecification {
    return {
      id: String(d.id),
      workspaceId: String(d.workspaceId),
      ownerId: String(d.ownerId),
      symbol: String(d.symbol),
      displayName: (d.displayName as string | null) ?? null,
      assetClass: d.assetClass as InstrumentSpecification['assetClass'],
      baseCurrency: (d.baseCurrency as string | null) ?? null,
      quoteCurrency: String(d.quoteCurrency),
      profitCurrency: (d.profitCurrency as string | null) ?? null,
      contractSize: String(d.contractSize),
      tickSize: String(d.tickSize),
      pipSize: String(d.pipSize),
      tickValue: (d.tickValue as string | null) ?? null,
      quantityUnit: d.quantityUnit as InstrumentSpecification['quantityUnit'],
      status: (d.status as WorkspaceStatus) ?? 'active',
      notes: (d.notes as string | null) ?? null,
      createdAt: timestampToIso(d.createdAt),
      updatedAt: timestampToIso(d.updatedAt),
    };
  }

  private mapTradeDoc(d: Record<string, unknown>): Trade {
    return {
      id: String(d.id),
      workspaceId: String(d.workspaceId),
      portfolioId: (d.portfolioId as string | null) ?? null,
      accountId: String(d.accountId),
      ownerId: String(d.ownerId),
      externalTicketId: (d.externalTicketId as string | null) ?? null,
      symbol: String(d.symbol),
      instrumentId: (d.instrumentId as string | null) ?? null,
      direction: d.direction as Trade['direction'],
      status: d.status as Trade['status'],
      isArchived: Boolean(d.isArchived),
      session: (d.session as Trade['session']) ?? null,
      timeframes: Array.isArray(d.timeframes) ? (d.timeframes as string[]) : [],
      timezone: String(d.timezone ?? 'UTC'),
      accountCurrency: String(d.accountCurrency ?? 'USD'),
      accountBalanceSnapshot: (d.accountBalanceSnapshot as string | null) ?? null,
      entryAt: (d.entryAt as string | null) ?? null,
      entryPrice: (d.entryPrice as string | null) ?? null,
      quantity: (d.quantity as string | null) ?? null,
      entryType: (d.entryType as Trade['entryType']) ?? null,
      leverage: (d.leverage as string | null) ?? null,
      marginUsed: (d.marginUsed as string | null) ?? null,
      entryRationale: (d.entryRationale as string | null) ?? null,
      initialStopPrice: (d.initialStopPrice as string | null) ?? null,
      actualStopPrice: (d.actualStopPrice as string | null) ?? null,
      plannedTargetPrice: (d.plannedTargetPrice as string | null) ?? null,
      plannedRiskAmount: (d.plannedRiskAmount as string | null) ?? null,
      plannedRiskPct: (d.plannedRiskPct as string | null) ?? null,
      actualRiskAmount: (d.actualRiskAmount as string | null) ?? null,
      exitAt: (d.exitAt as string | null) ?? null,
      exitPrice: (d.exitPrice as string | null) ?? null,
      exitQuantity: (d.exitQuantity as string | null) ?? null,
      exitReason: (d.exitReason as string | null) ?? null,
      manualGrossPnl: (d.manualGrossPnl as string | null) ?? null,
      fxConversionRate: (d.fxConversionRate as string | null) ?? null,
      playbookId: (d.playbookId as string | null) ?? null,
      setupId: (d.setupId as string | null) ?? null,
      setupTag: (d.setupTag as string | null) ?? null,
      commission: (d.commission as string | null) ?? null,
      swap: (d.swap as string | null) ?? null,
      fees: (d.fees as string | null) ?? null,
      slippage: (d.slippage as string | null) ?? null,
      spread: (d.spread as string | null) ?? null,
      marketConditions: Array.isArray(d.marketConditions) ? (d.marketConditions as string[]) : [],
      entryNotes: (d.entryNotes as string | null) ?? null,
      reviewNotes: (d.reviewNotes as string | null) ?? null,
      tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
      createdAt: timestampToIso(d.createdAt),
      updatedAt: timestampToIso(d.updatedAt),
    };
  }
}
