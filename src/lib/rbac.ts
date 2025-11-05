export type Scope = 'all' | 'own' | 'ownDeals' | false;

export type ModulePerm = Partial<{ create: Scope; read: Scope | true; update: Scope; delete: Scope }>;

export type Permissions = {
  dashboard?: { read: true };
  customers?: ModulePerm;
  leads?: ModulePerm;
  activities?: ModulePerm;
  products?: ModulePerm;
  pipeline?: ModulePerm;
  event_types?: ModulePerm;
  quotations?: ModulePerm;
  payment_verification?: ModulePerm;
  templates?: ModulePerm;
  settings?: ModulePerm;
};

export function can(
  perms: Permissions | undefined,
  module: keyof Permissions,
  action: 'create'|'read'|'update'|'delete',
  record?: { owner_id?: string; assigned_to?: string },
  userId?: string
): boolean {
  if (!perms) return false;
  const m = (perms as any)[module] as ModulePerm | undefined;
  if (!m) return false;
  const v = (m as any)[action] as Scope | true | undefined;
  if (v === true || v === 'all') return true;
  if (v === 'own') return record?.owner_id === userId;
  if (v === 'ownDeals') return record?.assigned_to === userId;
  return false;
}


