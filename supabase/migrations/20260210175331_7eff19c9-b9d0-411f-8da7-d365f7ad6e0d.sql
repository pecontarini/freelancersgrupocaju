-- Add RLS policies for partner role on employees table
CREATE POLICY "Partners can manage all employees"
ON public.employees
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'partner'
  )
);

-- Add RLS policy for partner role on job_titles table
CREATE POLICY "Partners can manage all job_titles"
ON public.job_titles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'partner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'partner'
  )
);