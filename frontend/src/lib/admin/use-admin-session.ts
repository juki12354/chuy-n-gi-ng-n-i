import { useEffect, useState } from "react";
import { readAdminSession } from "./admin-auth";
import type { AdminSession } from "./types";

export function useAdminSession() {
  const [session, setSession] = useState<AdminSession | null>(() =>
    readAdminSession(),
  );

  useEffect(() => {
    setSession(readAdminSession());
  }, []);

  return session;
}
