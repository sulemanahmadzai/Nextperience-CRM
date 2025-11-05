/*
  Re-enable RLS on quotation_templates and align policies with scoped RBAC.
  This addresses a prior migration that disabled RLS globally for development.
*/

-- Ensure table exists before attempting to modify
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'quotation_templates'
  ) THEN
    RAISE NOTICE 'quotation_templates does not exist; skipping RLS fixes';
    RETURN;
  END IF;

  -- Re-enable RLS
  EXECUTE 'ALTER TABLE public.quotation_templates ENABLE ROW LEVEL SECURITY';

  -- Clean up older name-based policies if present
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotation_templates' AND polname='Users can view templates'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view templates" ON public.quotation_templates';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotation_templates' AND polname='Admins and managers can manage templates'
  ) THEN
    EXECUTE 'DROP POLICY "Admins and managers can manage templates" ON public.quotation_templates';
  END IF;

  -- Ensure scoped RBAC policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotation_templates' AND polname='qtemplates_select'
  ) THEN
    EXECUTE $$
      CREATE POLICY qtemplates_select ON public.quotation_templates
      FOR SELECT TO authenticated
      USING (
        CASE public.rbac_scope('templates','read', quotation_templates.company_id)
          WHEN 'all' THEN true
          WHEN 'own' THEN quotation_templates.owner_id = auth.uid()
          ELSE false
        END
      )
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotation_templates' AND polname='qtemplates_all'
  ) THEN
    EXECUTE $$
      CREATE POLICY qtemplates_all ON public.quotation_templates
      FOR ALL TO authenticated
      USING (
        CASE public.rbac_scope('templates','update', quotation_templates.company_id)
          WHEN 'all' THEN true
          WHEN 'own' THEN quotation_templates.owner_id = auth.uid()
          ELSE false
        END
      )
      WITH CHECK (
        CASE public.rbac_scope('templates','create', quotation_templates.company_id)
          WHEN 'all' THEN true
          WHEN 'own' THEN quotation_templates.owner_id = auth.uid()
          ELSE false
        END
      )
    $$;
  END IF;
END $$;


