-- Add sharing capabilities to existing collections table
ALTER TABLE public.collections
ADD COLUMN is_shared BOOLEAN DEFAULT FALSE,
ADD COLUMN share_token UUID UNIQUE DEFAULT gen_random_uuid(),
ADD COLUMN shared_at TIMESTAMPTZ;

-- Create index for fast share_token lookups
CREATE INDEX idx_collections_share_token ON public.collections(share_token);

-- RLS Policy for reading shared collections (authenticated users only)
CREATE POLICY "Allow reading shared collections" ON public.collections
  FOR SELECT TO authenticated USING (is_shared = true);