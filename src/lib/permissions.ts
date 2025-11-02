import { supabase } from './supabase';

export interface UserPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canMove: boolean;
  isViewOnly: boolean;
  role: string;
}

export interface RecordLockStatus {
  isLocked: boolean;
  hasVerifiedPayment: boolean;
  lockReason?: string;
}

const EDIT_ROLES = ['Admin', 'Manager', 'Sales Representative'];
const DELETE_ROLES_WITH_PAYMENT = ['Admin'];
const DELETE_ROLES_WITHOUT_PAYMENT = ['Admin', 'Manager', 'Sales Representative'];

export async function getUserRole(): Promise<string> {
  const { data, error } = await supabase.rpc('check_user_role');

  if (error) {
    console.error('Error fetching user role:', error);
    return 'Viewer';
  }

  return data || 'Viewer';
}

export async function getUserPermissions(): Promise<UserPermissions> {
  const role = await getUserRole();

  return {
    canEdit: EDIT_ROLES.includes(role),
    canDelete: DELETE_ROLES_WITHOUT_PAYMENT.includes(role),
    canMove: EDIT_ROLES.includes(role),
    isViewOnly: !EDIT_ROLES.includes(role),
    role
  };
}

export async function checkLeadLockStatus(leadId: string): Promise<RecordLockStatus> {
  const { data: hasPayment, error } = await supabase.rpc('has_verified_payment_lead', {
    lead_uuid: leadId
  });

  if (error) {
    console.error('Error checking lead payment status:', error);
    return { isLocked: false, hasVerifiedPayment: false };
  }

  const role = await getUserRole();
  const isLocked = hasPayment && !DELETE_ROLES_WITH_PAYMENT.includes(role);

  return {
    isLocked,
    hasVerifiedPayment: hasPayment || false,
    lockReason: isLocked ? 'Locked: This record has a verified payment attached.' : undefined
  };
}

export async function checkQuotationLockStatus(quotationId: string): Promise<RecordLockStatus> {
  const { data: hasPayment, error } = await supabase.rpc('has_verified_payment_quotation', {
    quotation_uuid: quotationId
  });

  if (error) {
    console.error('Error checking quotation payment status:', error);
    return { isLocked: false, hasVerifiedPayment: false };
  }

  const role = await getUserRole();
  const isLocked = hasPayment && !DELETE_ROLES_WITH_PAYMENT.includes(role);

  return {
    isLocked,
    hasVerifiedPayment: hasPayment || false,
    lockReason: isLocked ? 'Locked: This record has a verified payment attached.' : undefined
  };
}

export async function canDeleteLead(leadId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_delete_lead', {
    lead_uuid: leadId
  });

  if (error) {
    console.error('Error checking lead delete permission:', error);
    return false;
  }

  return data || false;
}

export async function canDeleteQuotation(quotationId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_delete_quotation', {
    quotation_uuid: quotationId
  });

  if (error) {
    console.error('Error checking quotation delete permission:', error);
    return false;
  }

  return data || false;
}

export async function logAuditAction(
  tableName: string,
  recordId: string,
  action: string,
  oldData?: any,
  newData?: any
): Promise<void> {
  const { error } = await supabase.rpc('log_audit_action', {
    p_table_name: tableName,
    p_record_id: recordId,
    p_action: action,
    p_old_data: oldData ? JSON.stringify(oldData) : null,
    p_new_data: newData ? JSON.stringify(newData) : null
  });

  if (error) {
    console.error('Error logging audit action:', error);
  }
}
