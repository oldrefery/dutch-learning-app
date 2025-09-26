-- RLS Policy for reading words from shared collections (authenticated users only)
-- This allows authenticated users to read words from collections that are publicly shared
CREATE POLICY "Allow reading words from shared collections" ON public.words
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.collection_id = words.collection_id
      AND collections.is_shared = true
    )
  );