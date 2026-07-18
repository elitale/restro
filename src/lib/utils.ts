import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Serialize a server value to a JSON-safe shape before passing it to a client
 * component (Dates → ISO strings, BigInt → string). Prevents Prisma Date/Decimal
 * values from leaking across the server/client boundary.
 */
export function serializeForClient<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val: unknown) =>
      typeof val === "bigint" ? val.toString() : val,
    ),
  ) as T
}
