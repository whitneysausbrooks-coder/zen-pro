import { Router } from "express";
import { getAuth } from "@clerk/express";
import type { Request, Response } from "express";
// `getAuth` is still needed by /auth/user below for backward compatibility.
import { query, auditLog } from "../lib/db";
import { resolveClerkIdentity, invalidateClerkIdentityCache } from "../lib/clerkUser";

const router = Router();

router.get("/auth/user", (req: Request, res: Response) => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;

  if (!userId) {
    res.json({ user: null });
    return;
  }

  res.json({
    user: {
      id: userId,
      email: (auth?.sessionClaims as any)?.email ?? null,
      firstName: (auth?.sessionClaims as any)?.firstName ?? null,
      lastName: (auth?.sessionClaims as any)?.lastName ?? null,
      profileImageUrl: (auth?.sessionClaims as any)?.imageUrl ?? null,
    },
  });
});

/**
 * Called by the web client immediately after Clerk sign-in.
 * Persists the Clerk identity for tracking/customization and, if the
 * user's email matches an enterprise_users row, links it to their Clerk
 * account so future enterprise queries resolve via either path.
 */
router.post("/auth/claim-profile", async (req: Request, res: Response) => {
  const identity = await resolveClerkIdentity(req);
  if (!identity.clerkId) {
    return res.status(401).json({ error: "Not signed in" });
  }
  const clerkId = identity.clerkId;
  const email = identity.email;
  const firstName = identity.firstName;
  const lastName = identity.lastName;

  let enterprise: {
    user_id: string;
    company_id: string;
    company_name: string | null;
    invite_code: string | null;
    role: string | null;
  } | null = null;

  if (email) {
    try {
      const lookup = await query(
        `SELECT eu.id AS user_id, eu.role, eu.idp_subject,
                c.id AS company_id, c.name AS company_name, c.invite_code
           FROM enterprise_users eu
           JOIN companies c ON c.id = eu.company_id
          WHERE LOWER(eu.email) = $1
          LIMIT 1`,
        [email]
      );
      if (lookup.rows.length > 0) {
        const row = lookup.rows[0];
        // Link the enterprise row to this Clerk identity if not yet linked,
        // OR if it was linked to a different Clerk id (e.g. user re-signed up).
        if (!row.idp_subject || row.idp_subject !== clerkId) {
          await query(
            `UPDATE enterprise_users SET idp_subject = $1 WHERE id = $2`,
            [clerkId, row.user_id]
          );
          invalidateClerkIdentityCache(clerkId);
          await auditLog(row.user_id, "clerk_linked", "enterprise_users", { clerkId, email });
        }
        enterprise = {
          user_id: row.user_id,
          company_id: row.company_id,
          company_name: row.company_name ?? null,
          invite_code: row.invite_code ?? null,
          role: row.role ?? null,
        };
      }
    } catch (e: any) {
      console.warn("claim-profile enterprise lookup failed:", e?.message);
    }
  }

  return res.json({
    user: { id: clerkId, email, firstName, lastName },
    enterprise,
  });
});

export default router;
