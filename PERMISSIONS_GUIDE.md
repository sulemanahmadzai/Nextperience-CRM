# Role-Based Permissions and Payment Locking System

## Overview
This system implements comprehensive role-based access control (RBAC) for Leads and Quotations with payment verification locking.

## Permission Rules by Role

### Admin
- **Full Access**: Can view, edit, move, and delete all leads and quotations
- **Override Power**: Can delete records even with verified payments (for corrections/audits)
- **Audit Control**: All actions are logged in audit_logs table

### Manager
- **Edit Access**: Can view, edit, and move leads and quotations
- **Delete Restrictions**: Can delete records ONLY if they don't have verified payments
- **Locked Records**: Cannot delete records with verified payments (shown with lock icon)

### Sales Representative
- **Edit Access**: Can view, edit, and move leads and quotations
- **Delete Restrictions**: Can delete records ONLY if they don't have verified payments
- **Locked Records**: Cannot delete records with verified payments (shown with lock icon)

### Finance Officer
- **View Only**: Can see all leads and quotations including payment information
- **No Modifications**: Cannot edit, move, or delete any records
- **Payment Management**: Can verify and manage payments (separate permission)

### Viewer
- **View Only**: Can see basic lead and quotation information
- **No Modifications**: Cannot edit, move, or delete any records
- **Limited Access**: May have restricted visibility based on company settings

## Payment Locking Mechanism

### How It Works
1. When a payment is marked as "Verified", the associated lead/quotation becomes locked
2. The lock applies to delete operations for Manager and Sales Representative roles
3. Admin retains full delete access for audit and correction purposes
4. Edit access remains available for non-payment fields (notes, event details, etc.)

### Visual Indicators
- **Unlocked Records**: Show trash icon (can be deleted)
- **Locked Records**: Show lock icon with tooltip "Locked: This record has a verified payment attached."
- **Disabled State**: Delete button is visually disabled (greyed out) when locked

## Database Functions

### Permission Checking Functions
- `check_user_role()`: Returns the current user's role name
- `can_edit_record()`: Checks if user can edit based on role
- `can_delete_lead(lead_uuid)`: Checks if user can delete a specific lead
- `can_delete_quotation(quotation_uuid)`: Checks if user can delete a specific quotation

### Payment Status Functions
- `has_verified_payment_lead(lead_uuid)`: Checks if lead has any verified payments
- `has_verified_payment_quotation(quotation_uuid)`: Checks if quotation has verified payments

### Audit Logging
- `log_audit_action(table_name, record_id, action, old_data, new_data)`: Records all modifications
- Automatically captures: user_id, timestamp, action type, before/after data

## Implementation Details

### Frontend Components Updated
1. **LeadsKanban** (`src/components/leads/LeadsKanban.tsx`)
   - Role-based button visibility
   - Lock icons on restricted records
   - Permission checks before drag-and-drop moves
   - Audit logging on stage changes

2. **LeadDetailView** (`src/components/leads/LeadDetailView.tsx`)
   - Dynamic edit button based on permissions
   - View-only mode for restricted roles

3. **QuotationDetailPage** (`src/components/quotations/QuotationDetailPage.tsx`)
   - Permission-aware edit buttons
   - Lock status indicators
   - Audit trail integration

### Permission Utility Functions
Located in `src/lib/permissions.ts`:
- `getUserPermissions()`: Returns user's permission set
- `checkLeadLockStatus(leadId)`: Returns lock status for a lead
- `checkQuotationLockStatus(quotationId)`: Returns lock status for a quotation
- `canDeleteLead(leadId)`: Boolean check for delete permission
- `canDeleteQuotation(quotationId)`: Boolean check for delete permission
- `logAuditAction()`: Client-side audit logging helper

## Security Considerations

### Database Level
- All permission functions use `SECURITY DEFINER` to safely access auth context
- RLS policies remain in place for data access control
- No client-side permission bypasses possible

### Audit Trail
- Every move, edit, and delete action is logged
- Old and new values captured as JSON
- Immutable audit log (no delete capability)
- User ID and timestamp automatically recorded

## Testing Recommendations

### Test Scenarios
1. **Role-Based Access**
   - Login as each role type
   - Verify correct buttons are visible/hidden
   - Test edit restrictions

2. **Payment Locking**
   - Create a quotation
   - Add a verified payment
   - Attempt to delete as Manager/Sales Rep (should fail)
   - Attempt to delete as Admin (should succeed)

3. **Audit Logging**
   - Move a lead between stages
   - Check audit_logs table for entry
   - Verify old_data and new_data are captured correctly

4. **Edge Cases**
   - Multiple verified payments on one quotation
   - Role changes mid-session
   - Concurrent edits by different users

## Migration Applied
**Filename**: `add_role_based_permissions_and_payment_locking.sql`
- Creates all permission checking functions
- Grants execute permissions to authenticated users
- Sets up audit logging infrastructure

## Future Enhancements
- Email notifications on permission-blocked actions
- Detailed permission history reports
- Bulk operation permissions
- Time-based permission overrides
- Approval workflows for locked record modifications
