"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionResult } from "@/types";

interface UseServerActionOptions<T> {
  readonly onSuccess?: (data: T | undefined) => void;
  readonly onError?: (
    error: string,
    fieldErrors?: Record<string, string[]>,
  ) => void;
  readonly redirectTo?: string;
  readonly refresh?: boolean;
}

/**
 * Standard wrapper for invoking a Server Action from a client component.
 * Handles the pending transition, success/redirect/refresh, and error routing.
 */
export function useServerAction<TInput, TOutput>(
  action: (input: TInput) => Promise<ActionResult<TOutput>>,
  options: UseServerActionOptions<TOutput> = {},
): {
  readonly execute: (input: TInput) => void;
  readonly isPending: boolean;
} {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const execute = (input: TInput): void => {
    startTransition(async () => {
      const result = await action(input);
      if (result.success) {
        options.onSuccess?.(result.data);
        if (options.refresh) {
          router.refresh();
        }
        if (options.redirectTo) {
          router.push(options.redirectTo);
        }
      } else {
        options.onError?.(
          result.error ?? "Something went wrong",
          result.fieldErrors,
        );
      }
    });
  };

  return { execute, isPending };
}
