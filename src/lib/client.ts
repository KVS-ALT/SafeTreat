"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string, public data: unknown) {
    super(message);
  }
}

/** fetch JSON from our API; throws ApiError with the server's message on failure. */
export async function api<T = unknown>(url: string, init?: Omit<RequestInit, "body"> & { body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`, data);
  return data as T;
}

export type Me = { id: string; username: string; role: "PARENT" | "HOMEOWNER"; childAllergens: string[] } | null;

export const DEFAULT_CENTER: [number, number] = [43.6835, -79.7615]; // seeded demo area (central Brampton, ON)

export function timeAgo(iso: string | Date) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
