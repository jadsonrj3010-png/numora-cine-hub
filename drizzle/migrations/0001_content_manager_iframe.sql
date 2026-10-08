ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS iframe_url text, ADD COLUMN IF NOT EXISTS original_title text, ADD COLUMN IF NOT EXISTS release_date date;
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS original_title text;
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS iframe_url text;
CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  season_number integer NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, season_number)
);
GRANT SELECT ON public.seasons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seasons public read" ON public.seasons FOR SELECT USING (EXISTS (SELECT 1 FROM public.series s WHERE s.id = seasons.series_id AND s.published) OR public.is_admin(auth.uid()));
CREATE POLICY "Admin manage seasons" ON public.seasons FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));