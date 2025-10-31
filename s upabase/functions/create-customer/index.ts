<dyad-execute-sql description="Criar tabela tags com políticas de RLS">
CREATE TABLE public.tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select" ON public.tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "tags_insert" ON public.tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tags_update" ON public.tags FOR UPDATE TO authenticated USING (true);
CREATE POLICY "tags_delete" ON public.tags FOR DELETE TO authenticated USING (true);
</dyad-execute-sql>