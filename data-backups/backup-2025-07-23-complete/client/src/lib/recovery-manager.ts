import { hasRecoverableData, clearAutoSavedData } from './auto-save';

export interface RecoveryItem {
  formKey: string;
  formType: string;
  data: any;
  timestamp: number;
  storageSource: 'primary' | 'backup' | 'session' | 'emergency';
  completeness: number;
}

export class RecoveryManager {
  private static instance: RecoveryManager;
  private activeRecoveries: Map<string, RecoveryItem> = new Map();
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): RecoveryManager {
    if (!RecoveryManager.instance) {
      RecoveryManager.instance = new RecoveryManager();
    }
    return RecoveryManager.instance;
  }

  // Register a recovery listener
  addListener(listener: () => void) {
    this.listeners.add(listener);
  }

  // Remove a recovery listener
  removeListener(listener: () => void) {
    this.listeners.delete(listener);
  }

  // Notify all listeners
  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  // Scan for recoverable data across all known forms
  scanForRecoveries(): RecoveryItem[] {
    const formKeys = ['gig-form', 'expense-form', 'goal-form'];
    const recoveries: RecoveryItem[] = [];

    formKeys.forEach(formKey => {
      const recovery = this.checkSingleFormRecovery(formKey);
      if (recovery) {
        recoveries.push(recovery);
        this.activeRecoveries.set(formKey, recovery);
      }
    });

    if (recoveries.length > 0) {
      this.notifyListeners();
    }

    return recoveries;
  }

  // Check recovery for a single form
  private checkSingleFormRecovery(formKey: string): RecoveryItem | null {
    const formTypeMap: { [key: string]: string } = {
      'gig-form': 'gig',
      'expense-form': 'expense',
      'goal-form': 'goal'
    };

    const formType = formTypeMap[formKey] || 'unknown';
    const recoveryResult = hasRecoverableData(formKey);

    if (recoveryResult.hasData) {
      // Determine storage source
      let storageSource: 'primary' | 'backup' | 'session' | 'emergency' = 'primary';
      
      try {
        if (localStorage.getItem(`autosave_${formKey}`)) {
          storageSource = 'primary';
        } else if (localStorage.getItem(`backup_autosave_${formKey}`)) {
          storageSource = 'backup';
        } else if (sessionStorage.getItem(`session_autosave_${formKey}`)) {
          storageSource = 'session';
        } else if (sessionStorage.getItem(`emergency_autosave_${formKey}`)) {
          storageSource = 'emergency';
        }
      } catch (error) {
        console.warn('Error determining storage source:', error);
      }

      // Calculate completeness
      const completeness = this.calculateCompleteness(recoveryResult.data, formType);

      return {
        formKey,
        formType,
        data: recoveryResult.data,
        timestamp: recoveryResult.timestamp || Date.now(),
        storageSource,
        completeness
      };
    }

    return null;
  }

  // Calculate data completeness percentage
  private calculateCompleteness(data: any, formType: string): number {
    if (!data || typeof data !== 'object') return 0;

    let totalFields = 0;
    let filledFields = 0;

    if (formType === 'gig') {
      const fields = ['gigType', 'eventName', 'clientName', 'startDate', 'endDate', 'expectedPay', 'actualPay', 'tips', 'duties', 'notes'];
      totalFields = fields.length;
      filledFields = fields.filter(field => data[field] && data[field] !== '').length;
    } else if (formType === 'expense') {
      const fields = ['description', 'amount', 'date', 'category', 'notes'];
      totalFields = fields.length;
      filledFields = fields.filter(field => data[field] && data[field] !== '').length;
    } else if (formType === 'goal') {
      const fields = ['name', 'targetAmount', 'deadline', 'description'];
      totalFields = fields.length;
      filledFields = fields.filter(field => data[field] && data[field] !== '').length;
    }

    return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  }

  // Get active recoveries
  getActiveRecoveries(): RecoveryItem[] {
    return Array.from(this.activeRecoveries.values());
  }

  // Get recovery count
  getRecoveryCount(): number {
    return this.activeRecoveries.size;
  }

  // Clear a specific recovery
  clearRecovery(formKey: string) {
    clearAutoSavedData(formKey);
    this.activeRecoveries.delete(formKey);
    this.notifyListeners();
  }

  // Clear all recoveries
  clearAllRecoveries() {
    this.activeRecoveries.forEach((_, formKey) => {
      clearAutoSavedData(formKey);
    });
    this.activeRecoveries.clear();
    this.notifyListeners();
  }

  // Get recovery for specific form
  getRecovery(formKey: string): RecoveryItem | undefined {
    return this.activeRecoveries.get(formKey);
  }

  // Check if form has recovery
  hasRecovery(formKey: string): boolean {
    return this.activeRecoveries.has(formKey);
  }

  // Auto-scan for recoveries periodically
  startAutoScan(intervalMs: number = 30000) {
    setInterval(() => {
      this.scanForRecoveries();
    }, intervalMs);
  }

  // Get recovery summary
  getRecoverySummary(): {
    totalRecoveries: number;
    byFormType: { [key: string]: number };
    byStorageSource: { [key: string]: number };
    averageCompleteness: number;
  } {
    const recoveries = this.getActiveRecoveries();
    const byFormType: { [key: string]: number } = {};
    const byStorageSource: { [key: string]: number } = {};
    let totalCompleteness = 0;

    recoveries.forEach(recovery => {
      byFormType[recovery.formType] = (byFormType[recovery.formType] || 0) + 1;
      byStorageSource[recovery.storageSource] = (byStorageSource[recovery.storageSource] || 0) + 1;
      totalCompleteness += recovery.completeness;
    });

    return {
      totalRecoveries: recoveries.length,
      byFormType,
      byStorageSource,
      averageCompleteness: recoveries.length > 0 ? Math.round(totalCompleteness / recoveries.length) : 0
    };
  }
}

// Export singleton instance
export const recoveryManager = RecoveryManager.getInstance();