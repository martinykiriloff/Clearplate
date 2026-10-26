"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import { useI18n } from "@/i18n/provider";
import { api, ApiError, fetcher, type User } from "./api";

/** Current user, or null when signed out. */
export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<User>("/auth/me", fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
  // Only a 401 means signed out. Anything else (429, 5xx, offline) is an error the
  // UI can retry; treating it as signed out would bounce between /login and /today.
  const signedOut = error instanceof ApiError && error.status === 401;
  const failed = !!error && !signedOut;
  return { user: signedOut ? null : (data ?? undefined), isLoading: isLoading && !signedOut, failed, mutate };
}

/**
 * Guards an app page: sends signed-out users to /login and users without a
 * questionnaire to /onboarding (unless `allowNotOnboarded`).
 */
export function useRequireUser({ allowNotOnboarded = false } = {}) {
  const router = useRouter();
  const { href } = useI18n();
  const { user, isLoading, failed, mutate } = useUser();
  useEffect(() => {
    if (isLoading) return;
    // Clear a stale cookie first, otherwise the proxy would bounce /login back here.
    if (user === null) void api("/auth/logout", { method: "POST" }).finally(() => router.replace(href("/login")));
    else if (user && !user.onboarded && !allowNotOnboarded) router.replace(href("/onboarding"));
  }, [user, isLoading, allowNotOnboarded, router, href]);
  const ready = !!user && (allowNotOnboarded || user.onboarded);
  return { user: ready ? user : undefined, failed, mutate };
}

/**
 * Leaves the app with a full page load so no cached data from this account
 * (SWR cache, React state) survives for the next person on the same device.
 */
export function hardNavigate(path: string) {
  window.location.assign(path);
}
