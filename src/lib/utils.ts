import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Whether a sidebar/nav link should render as active for the current path.
 * `/dashboard` matches exactly; every other route also matches its nested
 * children (e.g. `/dashboard/inventory/123`).
 */
export function isActiveRoute(pathname: string, url: string): boolean {
  if (url === "/dashboard") {
    return pathname === url
  }
  return pathname === url || pathname.startsWith(`${url}/`)
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
