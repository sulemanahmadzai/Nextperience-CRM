/*
  # RBAC Scopes migration

  - Adds scoped permission model support using rbac_scope(module, action, company)
  - Extends ownership fields and indexes
  - Updates RLS policies to enforce scopes: 'all' | 'own' | 'ownDeals' | false

  Notes:
  - Our pipeline module is implemented on top of the `leads` table; 'ownDeals'
    maps to `leads.assigned_to = auth.uid()`.
*/

-- ==============================================
-- Helper: rbac_scope(module, action, company_id)
-- ==============================================
create or replace function rbac_scope(p_module text, p_action text, p_company uuid)
returns text
language sql
stable
security definer
as $$
  with u as (
    select ucr.permission_overrides as po, r.permissions as rp
    from user_company_roles ucr
    left join roles r on r.id = ucr.role_id
    where ucr.user_id = auth.uid()
      and ucr.company_id = p_company
      and ucr.is_active = true
    limit 1
  )
  select coalesce(
    nullif(u.po->p_module->>p_action, ''),
    nullif(u.rp->p_module->>p_action, '')
  , 'false')
  from u;
$$;

-- ==============================================
-- Ownership fields (owner_id) and indexes
-- ==============================================
DO $$
BEGIN
  -- customers.owner_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='customers' AND column_name='owner_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    UPDATE customers SET owner_id = COALESCE(created_by, auth.uid()) WHERE owner_id IS NULL; -- backfill best-effort
    ALTER TABLE customers ALTER COLUMN owner_id SET DEFAULT auth.uid();
  END IF;

  -- leads.owner_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='leads' AND column_name='owner_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    UPDATE leads SET owner_id = COALESCE(created_by, assigned_to, auth.uid()) WHERE owner_id IS NULL;
    ALTER TABLE leads ALTER COLUMN owner_id SET DEFAULT auth.uid();
  END IF;

  -- activities.owner_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='activities' AND column_name='owner_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    UPDATE activities SET owner_id = COALESCE(created_by, assigned_to, auth.uid()) WHERE owner_id IS NULL;
    ALTER TABLE activities ALTER COLUMN owner_id SET DEFAULT auth.uid();
  END IF;

  -- quotations.owner_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='quotations' AND column_name='owner_id'
  ) THEN
    ALTER TABLE quotations ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    UPDATE quotations SET owner_id = COALESCE(created_by, salesperson_id, auth.uid()) WHERE owner_id IS NULL;
    ALTER TABLE quotations ALTER COLUMN owner_id SET DEFAULT auth.uid();
  END IF;

  -- quotation_templates.owner_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='quotation_templates' AND column_name='owner_id'
  ) THEN
    ALTER TABLE quotation_templates ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    UPDATE quotation_templates SET owner_id = COALESCE(created_by, auth.uid()) WHERE owner_id IS NULL;
    ALTER TABLE quotation_templates ALTER COLUMN owner_id SET DEFAULT auth.uid();
  END IF;
END $$;

-- Indexes for ownership/assignment
CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activities_owner ON activities(owner_id);
CREATE INDEX IF NOT EXISTS idx_quotations_owner ON quotations(owner_id);
CREATE INDEX IF NOT EXISTS idx_qtemplates_owner ON quotation_templates(owner_id);

-- ==============================================
-- RLS policies using rbac_scope
-- ==============================================

-- CUSTOMERS
drop policy if exists customers_select on customers;
drop policy if exists customers_insert on customers;
drop policy if exists customers_update on customers;
drop policy if exists customers_delete on customers;

create policy customers_select on customers
for select to authenticated
using (
  case rbac_scope('customers','read', customers.company_id)
    when 'all' then true
    when 'own' then customers.owner_id = auth.uid()
    else false
  end
);

create policy customers_insert on customers
for insert to authenticated
with check (
  case rbac_scope('customers','create', customers.company_id)
    when 'all' then true
    when 'own' then customers.owner_id = auth.uid()
    else false
  end
);

create policy customers_update on customers
for update to authenticated
using (
  case rbac_scope('customers','update', customers.company_id)
    when 'all' then true
    when 'own' then customers.owner_id = auth.uid()
    else false
  end
)
with check (true);

create policy customers_delete on customers
for delete to authenticated
using (
  case rbac_scope('customers','delete', customers.company_id)
    when 'all' then true
    when 'own' then customers.owner_id = auth.uid()
    else false
  end
);

-- LEADS (also powers PIPELINE access via ownDeals)
drop policy if exists leads_select on leads;
drop policy if exists leads_insert on leads;
drop policy if exists leads_update on leads;
drop policy if exists leads_delete on leads;

create policy leads_select on leads
for select to authenticated
using (
  (
    case rbac_scope('leads','read', leads.company_id)
      when 'all' then true
      when 'own' then leads.owner_id = auth.uid()
      else false
    end
  )
  OR (
    case rbac_scope('pipeline','read', leads.company_id)
      when 'all' then true
      when 'ownDeals' then leads.assigned_to = auth.uid()
      else false
    end
  )
);

create policy leads_insert on leads
for insert to authenticated
with check (
  case rbac_scope('leads','create', leads.company_id)
    when 'all' then true
    when 'own' then leads.owner_id = auth.uid()
    else false
  end
);

create policy leads_update on leads
for update to authenticated
using (
  (
    case rbac_scope('leads','update', leads.company_id)
      when 'all' then true
      when 'own' then leads.owner_id = auth.uid()
      else false
    end
  )
  OR (
    case rbac_scope('pipeline','update', leads.company_id)
      when 'all' then true
      when 'ownDeals' then leads.assigned_to = auth.uid()
      else false
    end
  )
)
with check (true);

create policy leads_delete on leads
for delete to authenticated
using (
  case rbac_scope('leads','delete', leads.company_id)
    when 'all' then true
    when 'own' then leads.owner_id = auth.uid()
    else false
  end
);

-- ACTIVITIES (owner-based)
drop policy if exists activities_select on activities;
drop policy if exists activities_insert on activities;
drop policy if exists activities_update on activities;
drop policy if exists activities_delete on activities;

create policy activities_select on activities
for select to authenticated
using (
  case rbac_scope('activities','read', activities.company_id)
    when 'all' then true
    when 'own' then activities.owner_id = auth.uid()
    else false
  end
);

create policy activities_insert on activities
for insert to authenticated
with check (
  case rbac_scope('activities','create', activities.company_id)
    when 'all' then true
    when 'own' then activities.owner_id = auth.uid()
    else false
  end
);

create policy activities_update on activities
for update to authenticated
using (
  case rbac_scope('activities','update', activities.company_id)
    when 'all' then true
    when 'own' then activities.owner_id = auth.uid()
    else false
  end
)
with check (true);

create policy activities_delete on activities
for delete to authenticated
using (
  case rbac_scope('activities','delete', activities.company_id)
    when 'all' then true
    when 'own' then activities.owner_id = auth.uid()
    else false
  end
);

-- PRODUCTS (no ownership; scope 'all' to allow, else false)
drop policy if exists products_all on products;
create policy products_all on products
for all to authenticated
using (
  case rbac_scope('products', 'read', products.company_id)
    when 'all' then true
    else false
  end
)
with check (
  case rbac_scope('products', 'create', products.company_id)
    when 'all' then true
    else false
  end
);

-- EVENT TYPES (no ownership)
drop policy if exists event_types_all on event_types;
create policy event_types_all on event_types
for all to authenticated
using (
  case rbac_scope('event_types', 'read', event_types.company_id)
    when 'all' then true
    else false
  end
)
with check (
  case rbac_scope('event_types', 'create', event_types.company_id)
    when 'all' then true
    else false
  end
);

-- QUOTATIONS (owner-based)
drop policy if exists quotations_select on quotations;
drop policy if exists quotations_insert on quotations;
drop policy if exists quotations_update on quotations;
drop policy if exists quotations_delete on quotations;

create policy quotations_select on quotations
for select to authenticated
using (
  case rbac_scope('quotations','read', quotations.company_id)
    when 'all' then true
    when 'own' then quotations.owner_id = auth.uid()
    else false
  end
);

create policy quotations_insert on quotations
for insert to authenticated
with check (
  case rbac_scope('quotations','create', quotations.company_id)
    when 'all' then true
    when 'own' then quotations.owner_id = auth.uid()
    else false
  end
);

create policy quotations_update on quotations
for update to authenticated
using (
  case rbac_scope('quotations','update', quotations.company_id)
    when 'all' then true
    when 'own' then quotations.owner_id = auth.uid()
    else false
  end
)
with check (true);

create policy quotations_delete on quotations
for delete to authenticated
using (
  case rbac_scope('quotations','delete', quotations.company_id)
    when 'all' then true
    when 'own' then quotations.owner_id = auth.uid()
    else false
  end
);

-- TEMPLATES (owner-based)
drop policy if exists qtemplates_select on quotation_templates;
drop policy if exists qtemplates_all on quotation_templates;

create policy qtemplates_select on quotation_templates
for select to authenticated
using (
  case rbac_scope('templates','read', quotation_templates.company_id)
    when 'all' then true
    when 'own' then quotation_templates.owner_id = auth.uid()
    else false
  end
);

create policy qtemplates_all on quotation_templates
for all to authenticated
using (
  case rbac_scope('templates','update', quotation_templates.company_id)
    when 'all' then true
    when 'own' then quotation_templates.owner_id = auth.uid()
    else false
  end
)
with check (
  case rbac_scope('templates','create', quotation_templates.company_id)
    when 'all' then true
    when 'own' then quotation_templates.owner_id = auth.uid()
    else false
  end
);

-- PAYMENT VERIFICATION (payments table)
drop policy if exists payments_select on payments;
drop policy if exists payments_insert on payments;
drop policy if exists payments_update on payments;
drop policy if exists payments_delete on payments;

create policy payments_select on payments
for select to authenticated
using (
  case rbac_scope('payment_verification','read', payments.company_id)
    when 'all' then true
    else false
  end
);

create policy payments_insert on payments
for insert to authenticated
with check (
  case rbac_scope('payment_verification','create', payments.company_id)
    when 'all' then true
    else false
  end
);

create policy payments_update on payments
for update to authenticated
using (
  case rbac_scope('payment_verification','update', payments.company_id)
    when 'all' then true
    else false
  end
)
with check (true);

-- no delete by design unless explicitly given (matrix says false)


