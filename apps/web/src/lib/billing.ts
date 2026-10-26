"use client";

import useSWR from "swr";
import { fetcher, type Billing, type PaidModule } from "./api";

/** Paid modules for the signed-in user. Unknown (loading) counts as locked. */
export function useBilling() {
  const { data, mutate, isLoading } = useSWR<Billing>("/billing", fetcher, { revalidateOnFocus: true });
  const has = (m: PaidModule) => !!data?.modules[m];
  return { billing: data, has, mutate, isLoading };
}
