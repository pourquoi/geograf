import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isHttpUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function formatMicroseconds(us: number, pad = 12, bracket = true) {
  let out;

  if (us < 1000) {
    out = `${us}µs`;
  } else {
    const ms = us / 1000;
    if (ms < 1000) {
      out = ms % 1 === 0 ? `${ms}ms` : `${ms.toFixed(3)}ms`;
    } else {
      const s = ms / 1000;
      out = s % 1 === 0 ? `${s}s` : `${s.toFixed(3)}s`;
    }
  }

  if (bracket) {
    out = `[${out}]`;
  }
  if (pad) out = out.padEnd(pad, " ");

  return out;
}

export function middleTruncate(str: string, maxLength: number) {
  if (str.length <= maxLength) return str;

  const ellipsis = "...";
  const keep = maxLength - ellipsis.length;

  const front = Math.ceil(keep / 2);
  const back = Math.floor(keep / 2);

  return str.slice(0, front) + ellipsis + str.slice(str.length - back);
}
