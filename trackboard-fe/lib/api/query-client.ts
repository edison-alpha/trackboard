import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, onUnauthorized } from "./client";
import { keys } from "./keys";

/**
 * One client for the app. Reads are cached and shared; a request the server answered with a 4xx is not retried (it
 * would get the same answer); and a mutation that fails says why in a toast unless the caller handles it itself.
 */
export function makeQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
      mutations: {
        onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong."),
      },
    },
  });
  // A session the server no longer accepts returns the whole app to the sign-in screen.
  onUnauthorized(() => client.setQueryData(keys.session, null));
  return client;
}
