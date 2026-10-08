import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MediaItem } from "@/lib/types";
import { useAuth } from "./use-auth";

export function useFavorites() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useToggleFavorite() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: favs = [] } = useFavorites();
  const isFav = (i: Pick<MediaItem, "source" | "mediaType" | "id">) =>
    favs.some((f) => f.source === i.source && f.media_type === i.mediaType && f.content_id === i.id);

  const m = useMutation({
    mutationFn: async (i: MediaItem) => {
      if (!user) throw new Error("login");
      if (isFav(i)) {
        await supabase.from("favorites").delete().match({ source: i.source, media_type: i.mediaType, content_id: i.id });
        return false;
      }
      const { error } = await supabase.from("favorites").insert({
        user_id: user.id, source: i.source, media_type: i.mediaType, content_id: i.id, title: i.title, poster_url: i.poster,
      });
      if (error) throw error;
      return true;
    },
    onSuccess: (added) => {
      toast.success(added ? "Adicionado à Minha Lista" : "Removido da Minha Lista");
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (e: Error) => toast.error(e.message === "login" ? "Entre na sua conta para usar a Minha Lista" : "Não foi possível atualizar"),
  });
  return { toggle: m.mutate, isFav, pending: m.isPending };
}

export function useContinueWatching() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["progress", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("watch_progress").select("*").order("updated_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data.filter((p) => p.duration_seconds === 0 || p.position_seconds / p.duration_seconds < 0.95);
    },
  });
}

export function useHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("watch_history").select("*").order("watched_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useDownloads() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["downloads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("downloads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
