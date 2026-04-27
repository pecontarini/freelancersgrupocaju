ALTER TABLE public.user_google_tokens
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS token_type text DEFAULT 'Bearer';