-- LearnLynk Tech Test - Task 2: RLS Policies on leads

alter table public.leads enable row level security;

-- SELECT Policy
create policy "leads_select_policy"
on public.leads
for select
using (
  -- 1. Ensure Tenant Isolation (applies to everyone)
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND (
    -- 2. Admin: Can see everything in the tenant
    (auth.jwt() ->> 'role') = 'admin'
    OR
    -- 3. Counselor: Can see leads they own
    owner_id = auth.uid()
    OR
    -- 4. Counselor: Can see leads assigned to their team
    -- Checks if the lead's team_id exists in the user's teams
    exists (
      select 1 
      from user_teams ut 
      where ut.user_id = auth.uid() 
      and ut.team_id = leads.team_id
    )
  )
);

-- INSERT Policy
create policy "leads_insert_policy"
on public.leads
for insert
with check (
  -- User must be authenticated
  auth.role() = 'authenticated'
  AND
  -- Tenant ID in the row must match the user's JWT tenant_id
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND
  -- Only Admins or Counselors can insert
  (auth.jwt() ->> 'role') in ('admin', 'counselor')
);