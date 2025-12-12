import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";

export async function downloadStreamedFile(path: string) {
  const eventId = Date.now().toString();

  let chunks: string[] = [];

  const unlistenChunk = await listen<string>(
    `stream:${eventId}:chunk`,
    (event) => {
      const b64 = event.payload;
      chunks.push(b64);
    },
  );

  const unlistenEnd = await listen(`stream:${eventId}:end`, () => {
    unlistenChunk();
    unlistenEnd();
    finalizeDownload(chunks, path);
  });

  await invoke("stream_file", { path, eventId });
}

async function finalizeDownload(encodedChunks: string[], filePath: string) {
  const byteArrays = [];

  for (const b64 of encodedChunks) {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    byteArrays.push(bytes);
  }

  const blob = new Blob(byteArrays, {
    type: "application/octet-stream",
  });

  const filename = filePath.split("/").pop() || "data";

  const file = new File([blob], filename, { type: blob.type });

  if (navigator.share) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
        text: "Save to",
      });
      return;
    } catch (err) {
      console.error("share failed", err);

      toast.error("Failed to share file", {
        description: (err as Error).toString(),
      });
    }
  }

  // const url = URL.createObjectURL(blob);
  // const a = document.createElement("a");
  // a.href = url;
  // a.download = filename;
  // a.click();
  //
  // URL.revokeObjectURL(url);
}
