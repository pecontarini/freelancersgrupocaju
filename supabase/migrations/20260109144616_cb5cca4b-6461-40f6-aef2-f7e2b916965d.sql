-- Add created_by column to freelancer_entries
ALTER TABLE public.freelancer_entries 
ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_freelancer_entries_created_by ON public.freelancer_entries(created_by);

-- Update RLS policy to allow authenticated users to see all entries (test phase)
DROP POLICY IF EXISTS "Allow all operations for all users" ON public.freelancer_entries;

CREATE POLICY "Authenticated users can view all entries"
ON public.freelancer_entries
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert entries"
ON public.freelancer_entries
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update own entries"
ON public.freelancer_entries
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete own entries"
ON public.freelancer_entries
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);