import { clerkClient, getAuth } from "@clerk/express";
import type { Request } from "express";

interface CachedClerkUser {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CachedClerkUser>();

function readClaims(req: Request) {
  const auth = getAuth(req);
  const clerkId =
    (auth?.sessionClaims?.userId as string | undefined) ||
    (auth?.userId as string | undefined) ||
    null;
  const claimsEmail =
    (auth?.sessionClaims as any)?.email != null
      ? String((auth?.sessionClaims as any).email).toLowerCase()
      : null;
  const claimsFirst =
    (auth?.sessionClaims as any)?.firstName != null
      ? String((auth?.sessionClaims as any).firstName)
      : null;
  const claimsLast =
    (auth?.sessionClaims as any)?.lastName != null
      ? String((auth?.sessionClaims as any).lastName)
      : null;
  return { clerkId, claimsEmail, claimsFirst, claimsLast };
}

/**
 * Resolve the signed-in user's Clerk identity (email + name).
 *
 * Reads from JWT session claims first; if the token doesn't carry email
 * (which is common when no custom JWT template is configured), falls back
 * to the Clerk REST API and caches the result for CACHE_TTL_MS so we don't
 * hammer Clerk on every request.
 *
 * Returns nulls when the user is not signed in.
 */
export async function resolveClerkIdentity(req: Request): Promise<{
  clerkId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}> {
  const { clerkId, claimsEmail, claimsFirst, claimsLast } = readClaims(req);
  if (!clerkId) {
    return { clerkId: null, email: null, firstName: null, lastName: null };
  }
  if (claimsEmail) {
    return {
      clerkId,
      email: claimsEmail,
      firstName: claimsFirst,
      lastName: claimsLast,
    };
  }
  const cached = cache.get(clerkId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return {
      clerkId,
      email: cached.email,
      firstName: claimsFirst ?? cached.firstName,
      lastName: claimsLast ?? cached.lastName,
    };
  }
  try {
    const u = await clerkClient.users.getUser(clerkId);
    const primary = u.emailAddresses.find(
      (e: any) => e.id === u.primaryEmailAddressId,
    );
    const email =
      (primary?.emailAddress || u.emailAddresses[0]?.emailAddress || null)?.toLowerCase() ??
      null;
    const firstName = u.firstName ?? null;
    const lastName = u.lastName ?? null;
    cache.set(clerkId, { email, firstName, lastName, fetchedAt: Date.now() });
    return {
      clerkId,
      email,
      firstName: claimsFirst ?? firstName,
      lastName: claimsLast ?? lastName,
    };
  } catch {
    return {
      clerkId,
      email: null,
      firstName: claimsFirst,
      lastName: claimsLast,
    };
  }
}

/** Allow other modules (e.g. claim-profile after a fresh link) to invalidate. */
export function invalidateClerkIdentityCache(clerkId: string): void {
  cache.delete(clerkId);
}
