import { supabase } from "@/integrations/supabase/client";

export type Bucket = "artwork" | "videos" | "subtitles";

/** Uploads a file to storage with real progress reporting (XHR). Returns the stored reference. */
export async function uploadWithProgress(bucket: Bucket, file: File, onProgress: (pct: number) => void): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Faça login para enviar arquivos.");
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.\-_]/g, "-");
  const path = `${crypto.randomUUID()}-${safe}`;
  const { Upload } = await import("tus-js-client");
  // Envio em partes de 6 MB (retoma sozinho se a conexão cair) — evita o erro 400 de arquivos grandes.
  await new Promise<void>((resolve, reject) => {
    const up = new Upload(file, {
      endpoint: `${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/upload/resumable`,
      retryDelays: [0, 2000, 5000, 10000],
      chunkSize: 6 * 1024 * 1024,
      headers: { authorization: `Bearer ${token}`, apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"], "x-upsert": "false" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: bucket, objectName: path, contentType: file.type || "application/octet-stream", cacheControl: "3600" },
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
      onError: (err) => {
        const msg = String(err?.message ?? "");
        reject(new Error(msg.includes("413") ? "Arquivo grande demais." : msg.includes("403") ? "Sem permissão para enviar (entre com a conta admin)." : "Falha no envio. Tente novamente."));
      },
    });
    up.start();
  });
  onProgress(100);

  if (bucket === "artwork") {
    // Artwork bucket is private: store a long-lived signed URL for image display
    const { data: signed, error } = await supabase.storage.from("artwork").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (error) throw error;
    return signed.signedUrl;
  }
  return `storage://${bucket}/${path}`;
}
