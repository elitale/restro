/**
 * Standard server-action result envelope. Server Actions never throw to the
 * client — they return one of these.
 */
export interface ActionResult<T = void> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly fieldErrors?: Record<string, string[]>;
}

export const success = <T>(data?: T): ActionResult<T> => ({
  success: true,
  data,
});

export const failure = <T = void>(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> => ({ success: false, error, fieldErrors });

/** A page of results plus its pagination metadata. */
export interface Paginated<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}
