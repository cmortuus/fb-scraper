/**
 * Prepends the Next.js basePath to API routes for client-side fetch() calls.
 * Next.js auto-prepends basePath to <Link> and router.push, but NOT to fetch().
 */
const BASE_PATH = "/market";

export function api(path: string): string {
  return `${BASE_PATH}${path}`;
}
