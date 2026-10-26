"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import { api, ApiError, fetcher, type User } from "./api";

/** Current user, or null when signed out. */
export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<User>("/auth/me", fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
  const signedOut = error instanceof ApiError && error.status === 401;
  return { user: signedOut ? null : (data ?? undefined), isLoading: isLoading && !signedOut, mutate };
}

/**
 * Guards an app page: sends signed-out users to /login and users without a
 * questionnaire to /onboarding (unless `allowNotOnboarded`).
 */
export function useRequireUser({ allowNotOnboarded = false } = {}) {
  const router = useRouter();
  const { user, isLoading, mutate } = useUser();
  useEffect(() => {
    if (isLoading) return;
    // Clear a stale cookie first, otherwise the proxy would bounce /login back here.
    if (user === null) void api("/auth/logout", { method: "POST" }).finally(() => router.replace("/login"));
    else if (user && !user.onboarded && !allowNotOnboarded) router.replace("/onboarding");
  }, [user, isLoading, allowNotOnboarded, router]);
  const ready = !!user && (allowNotOnboarded || user.onboarded);
  return { user: ready ? user : undefined, mutate };
}
