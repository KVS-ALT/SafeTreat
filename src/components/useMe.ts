"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type Me } from "@/lib/client";

export function useMe() {
  const [me, setMe] = useState<Me | undefined>(undefined); // undefined = loading
  useEffect(() => {
    api<{ user: Me }>("/api/me").then((r) => setMe(r.user)).catch(() => setMe(null));
  }, []);
  return me;
}

/** Sends logged-out visitors to /login and back here afterwards. */
export function useRequireMe() {
  const me = useMe();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (me === null) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [me, router, path]);
  return me;
}
