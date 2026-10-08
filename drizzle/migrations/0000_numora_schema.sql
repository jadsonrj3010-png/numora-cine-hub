
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _user_id)
$$;

CREATE POLICY "Users see own admin row" ON public.admin_users FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.genres (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE
);
GRANT SELECT ON public.genres TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.genres TO authenticated;
GRANT USAGE ON SEQUENCE public.genres_id_seq TO authenticated;
GRANT ALL ON public.genres TO service_role;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Genres public read" ON public.genres FOR SELECT USING (true);
CREATE POLICY "Genres admin write" ON public.genres FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.genres (name, slug) VALUES
('Ação','acao'),('Aventura','aventura'),('Animação','animacao'),('Comédia','comedia'),('Crime','crime'),
('Documentário','documentario'),('Drama','drama'),('Família','familia'),('Fantasia','fantasia'),('Terror','terror'),
('Romance','romance'),('Ficção científica','ficcao-cientifica'),('Suspense','suspense'),('Infantil','infantil'),('Novela','novela');

CREATE TABLE public.movies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id integer,
  category text NOT NULL DEFAULT 'filmes',
  title text NOT NULL,
  description text,
  poster_url text,
  backdrop_url text,
  year integer,
  duration_min integer,
  rating numeric(3,1),
  age_rating text,
  director text,
  cast_list text[] NOT NULL DEFAULT '{}',
  genres text[] NOT NULL DEFAULT '{}',
  video_url text,
  subtitle_url text,
  trailer_url text,
  downloadable boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.movies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.movies TO authenticated;
GRANT ALL ON public.movies TO service_role;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published movies public" ON public.movies FOR SELECT USING (published = true OR public.is_admin(auth.uid()));
CREATE POLICY "Admin manage movies" ON public.movies FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id integer,
  category text NOT NULL DEFAULT 'series',
  title text NOT NULL,
  description text,
  poster_url text,
  backdrop_url text,
  year integer,
  rating numeric(3,1),
  age_rating text,
  director text,
  cast_list text[] NOT NULL DEFAULT '{}',
  genres text[] NOT NULL DEFAULT '{}',
  trailer_url text,
  downloadable boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.series TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.series TO authenticated;
GRANT ALL ON public.series TO service_role;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published series public" ON public.series FOR SELECT USING (published = true OR public.is_admin(auth.uid()));
CREATE POLICY "Admin manage series" ON public.series FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  season_number integer NOT NULL DEFAULT 1,
  episode_number integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  description text,
  still_url text,
  duration_min integer,
  video_url text,
  subtitle_url text,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, season_number, episode_number)
);
GRANT SELECT ON public.episodes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.episodes TO authenticated;
GRANT ALL ON public.episodes TO service_role;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published episodes public" ON public.episodes FOR SELECT USING (
  (published = true AND EXISTS (SELECT 1 FROM public.series s WHERE s.id = series_id AND s.published = true))
  OR public.is_admin(auth.uid()));
CREATE POLICY "Admin manage episodes" ON public.episodes FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('tmdb','local')),
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  content_id text NOT NULL,
  title text NOT NULL,
  poster_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, media_type, content_id)
);
CREATE TABLE public.watch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('tmdb','local')),
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  content_id text NOT NULL,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE SET NULL,
  title text NOT NULL,
  poster_url text,
  watched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.watch_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('tmdb','local')),
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  content_id text NOT NULL,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE SET NULL,
  title text NOT NULL,
  poster_url text,
  backdrop_url text,
  position_seconds numeric NOT NULL DEFAULT 0,
  duration_seconds numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, media_type, content_id)
);
CREATE TABLE public.downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('tmdb','local')),
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  content_id text NOT NULL,
  title text NOT NULL,
  poster_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, media_type, content_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites, public.watch_history, public.watch_progress, public.downloads TO authenticated;
GRANT ALL ON public.favorites, public.watch_history, public.watch_progress, public.downloads TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own favorites" ON public.favorites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own history" ON public.watch_history FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own progress" ON public.watch_progress FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own downloads" ON public.downloads FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX ON public.watch_history (user_id, watched_at DESC);
CREATE INDEX ON public.watch_progress (user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.increment_views(_kind text, _id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _kind = 'movie' THEN UPDATE public.movies SET views = views + 1 WHERE id = _id AND published;
  ELSIF _kind = 'tv' THEN UPDATE public.series SET views = views + 1 WHERE id = _id AND published;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.increment_views(text, uuid) TO anon, authenticated;

CREATE POLICY "Artwork public read" ON storage.objects FOR SELECT USING (bucket_id = 'artwork');
CREATE POLICY "Signed-in read videos/subs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('videos','subtitles'));
CREATE POLICY "Admin upload media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('artwork','videos','subtitles') AND public.is_admin(auth.uid()));
CREATE POLICY "Admin update media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('artwork','videos','subtitles') AND public.is_admin(auth.uid()));
CREATE POLICY "Admin delete media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('artwork','videos','subtitles') AND public.is_admin(auth.uid()));
