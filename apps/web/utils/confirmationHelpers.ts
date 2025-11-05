/**
 * Utility functions to replace window.confirm() with custom ConfirmationDialog
 * Import useConfirmDialog from '@/contexts/ConfirmationContext'
 */

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

/**
 * Creates a confirmation message for deletion
 */
export function createDeleteConfirmation(itemName: string, isDangerous = true): ConfirmOptions {
  return {
    title: 'تأكيد الحذف',
    message: `هل أنت متأكد من حذف ${itemName}؟ لا يمكن التراجع عن هذا.`,
    confirmText: 'حذف',
    cancelText: 'إلغاء',
    isDangerous,
  };
}

/**
 * Creates a confirmation message for a bulk deletion
 */
export function createBulkDeleteConfirmation(count: number, itemType: string, isDangerous = true): ConfirmOptions {
  return {
    title: 'تأكيد الحذف',
    message: `هل أنت متأكد من حذف ${count} ${itemType}؟ لا يمكن التراجع عن هذا.`,
    confirmText: 'حذف الجميع',
    cancelText: 'إلغاء',
    isDangerous,
  };
}

/**
 * Creates a confirmation message for general actions
 */
export function createActionConfirmation(action: string, isDangerous = false): ConfirmOptions {
  return {
    title: 'تأكيد الإجراء',
    message: action,
    confirmText: 'تأكيد',
    cancelText: 'إلغاء',
    isDangerous,
  };
}
