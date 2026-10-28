import { get, set } from "idb-keyval";
import { useEffect, useState } from "react";
import { newId } from "./format";
import { fetchRemotePhoto, queuePhotoUpload, syncNow } from "../sync/sync";

const MAX_SIDE = 1600;
const QUALITY = 0.8;

/** Downscales to at most 1600px and re-encodes as JPEG (~200–300 KB for a phone shot). */
async function compress(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; // JPEG has no alpha: transparent PNGs would turn black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Не удалось сжать фото"))), "image/jpeg", QUALITY),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Stores a picked photo locally, queues it for Dropbox and returns its file name for the database. */
export async function savePhoto(file: File): Promise<string> {
  const name = `${newId()}.jpg`;
  await set(`photo:${name}`, await compress(file));
  await queuePhotoUpload(name);
  void syncNow();
  return name;
}

export function usePhotoUrl(name: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!name) return setUrl(null);
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      const blob = (await get<Blob>(`photo:${name}`)) ?? (await fetchRemotePhoto(name).catch(() => null));
      if (!blob || cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [name]);
  return url;
}
