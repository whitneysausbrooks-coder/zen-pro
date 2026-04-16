import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { query, auditLog } from "../lib/db";

const router = Router();

function requireEnterpriseAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-enterprise-key"] as string;
  const validKey = process.env.ENTERPRISE_API_KEY;
  if (!validKey || apiKey !== validKey) {
    res.status(401).json({ error: "Unauthorized: valid x-enterprise-key header required" });
    return;
  }
  next();
}

router.use("/enterprise/sso/{*path}", requireEnterpriseAuth);
router.use("/enterprise/scim/{*path}", requireEnterpriseAuth);

router.get("/enterprise/sso/.well-known/openid-configuration", (_req, res) => {
  const baseUrl = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN || "localhost:8080"}`;
  res.json({
    issuer: `${baseUrl}/api/enterprise/sso`,
    authorization_endpoint: `${baseUrl}/api/enterprise/sso/authorize`,
    token_endpoint: `${baseUrl}/api/enterprise/sso/token`,
    userinfo_endpoint: `${baseUrl}/api/enterprise/sso/userinfo`,
    jwks_uri: `${baseUrl}/api/enterprise/sso/jwks`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile", "email"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    claims_supported: ["sub", "email", "name", "given_name", "family_name", "picture", "org_id", "role"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    _status: "draft",
    _note: "authorize/token/userinfo/jwks endpoints require IdP integration. SSO config + SCIM provisioning are operational.",
  });
});

const ssoConfigSchema = z.object({
  company_id: z.string().uuid(),
  provider: z.enum(["okta", "azure_ad", "google_workspace", "onelogin", "custom_oidc"]),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  discovery_url: z.string().url(),
  domain_restriction: z.string().optional(),
  auto_provision: z.boolean().default(true),
  default_role: z.enum(["employee", "manager", "admin"]).default("employee"),
});

router.post("/enterprise/sso/configure", async (req, res) => {
  const parsed = ssoConfigSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await query(
      `INSERT INTO sso_configurations
         (company_id, provider, client_id, client_secret, discovery_url,
          domain_restriction, auto_provision, default_role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       ON CONFLICT (company_id) DO UPDATE SET
         provider = EXCLUDED.provider,
         client_id = EXCLUDED.client_id,
         client_secret = EXCLUDED.client_secret,
         discovery_url = EXCLUDED.discovery_url,
         domain_restriction = EXCLUDED.domain_restriction,
         auto_provision = EXCLUDED.auto_provision,
         default_role = EXCLUDED.default_role,
         status = 'active',
         updated_at = NOW()
       RETURNING id, company_id, provider, status, created_at`,
      [
        parsed.data.company_id, parsed.data.provider, parsed.data.client_id,
        parsed.data.client_secret, parsed.data.discovery_url,
        parsed.data.domain_restriction || null, parsed.data.auto_provision,
        parsed.data.default_role,
      ]
    );

    await auditLog(null, "sso_configured", "sso_configurations", {
      company_id: parsed.data.company_id,
      provider: parsed.data.provider,
    });

    res.json({ success: true, config: result.rows[0] });
  } catch (err: any) {
    console.error("SSO config error:", err.message);
    res.status(500).json({ error: "Failed to configure SSO" });
  }
});

router.get("/enterprise/sso/config/:companyId", async (req, res) => {
  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }

  try {
    const result = await query(
      `SELECT id, company_id, provider, domain_restriction, auto_provision,
              default_role, status, created_at, updated_at
       FROM sso_configurations WHERE company_id = $1`,
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.json({ configured: false });
    }
    res.json({ configured: true, config: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch SSO config" });
  }
});

router.delete("/enterprise/sso/config/:companyId", async (req, res) => {
  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }

  try {
    await query(
      `UPDATE sso_configurations SET status = 'disabled', updated_at = NOW() WHERE company_id = $1`,
      [companyId]
    );
    await auditLog(null, "sso_disabled", "sso_configurations", { company_id: companyId });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to disable SSO" });
  }
});

const scimUserSchema = z.object({
  schemas: z.array(z.string()).default(["urn:ietf:params:scim:schemas:core:2.0:User"]),
  userName: z.string().email(),
  name: z.object({
    givenName: z.string().min(1),
    familyName: z.string().min(1),
  }),
  emails: z.array(z.object({
    value: z.string().email(),
    primary: z.boolean().default(false),
  })).optional(),
  active: z.boolean().default(true),
  externalId: z.string().optional(),
});

router.get("/enterprise/scim/v2/ServiceProviderConfig", (_req, res) => {
  res.json({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    documentationUri: "https://neuroquestllc.info/docs/scim",
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [{
      type: "httpbasic",
      name: "HTTP Basic",
      description: "Authentication via x-enterprise-key header",
    }],
  });
});

router.get("/enterprise/scim/v2/ResourceTypes", (_req, res) => {
  res.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: 1,
    Resources: [{
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
      id: "User",
      name: "User",
      endpoint: "/Users",
      schema: "urn:ietf:params:scim:schemas:core:2.0:User",
    }],
  });
});

router.get("/enterprise/scim/v2/Schemas", (_req, res) => {
  res.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: 1,
    Resources: [{
      id: "urn:ietf:params:scim:schemas:core:2.0:User",
      name: "User",
      attributes: [
        { name: "userName", type: "string", required: true, uniqueness: "server" },
        { name: "name", type: "complex", subAttributes: [
          { name: "givenName", type: "string" },
          { name: "familyName", type: "string" },
        ]},
        { name: "emails", type: "complex", multiValued: true },
        { name: "active", type: "boolean" },
        { name: "externalId", type: "string" },
      ],
    }],
  });
});

router.get("/enterprise/scim/v2/Users", async (req, res) => {
  const filter = req.query.filter as string | undefined;
  const startIndex = parseInt(req.query.startIndex as string || "1");
  const count = Math.min(parseInt(req.query.count as string || "100"), 200);

  try {
    let rows: any[];
    let total: number;

    if (filter) {
      const emailMatch = filter.match(/userName\s+eq\s+"([^"]+)"/);
      if (emailMatch) {
        const result = await query(
          `SELECT id, email, role, company_id, created_at FROM enterprise_users WHERE email = $1`,
          [emailMatch[1]]
        );
        rows = result.rows;
        total = rows.length;
      } else {
        const result = await query(
          `SELECT id, email, role, company_id, created_at FROM enterprise_users ORDER BY created_at LIMIT $1 OFFSET $2`,
          [count, startIndex - 1]
        );
        rows = result.rows;
        const countResult = await query(`SELECT COUNT(*) FROM enterprise_users`);
        total = parseInt(countResult.rows[0].count);
      }
    } else {
      const result = await query(
        `SELECT id, email, role, company_id, created_at FROM enterprise_users ORDER BY created_at LIMIT $1 OFFSET $2`,
        [count, startIndex - 1]
      );
      rows = result.rows;
      const countResult = await query(`SELECT COUNT(*) FROM enterprise_users`);
      total = parseInt(countResult.rows[0].count);
    }

    res.json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: total,
      startIndex,
      itemsPerPage: count,
      Resources: rows.map(toScimUser),
    });
  } catch (err: any) {
    console.error("SCIM list error:", err.message);
    res.status(500).json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Internal error", status: "500" });
  }
});

router.get("/enterprise/scim/v2/Users/:id", async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, role, company_id, created_at FROM enterprise_users WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "User not found", status: "404" });
    }
    res.json(toScimUser(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Internal error", status: "500" });
  }
});

router.post("/enterprise/scim/v2/Users", async (req, res) => {
  const parsed = scimUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail: "Invalid user data",
      status: "400",
    });
  }

  try {
    const companyIdHeader = req.headers["x-company-id"] as string | undefined;
    const companyResult = companyIdHeader
      ? await query(
          `SELECT sc.company_id, sc.default_role, sc.domain_restriction, sc.auto_provision
           FROM sso_configurations sc WHERE sc.company_id = $1 AND sc.status = 'active'`,
          [companyIdHeader]
        )
      : await query(
          `SELECT sc.company_id, sc.default_role, sc.domain_restriction, sc.auto_provision
           FROM sso_configurations sc WHERE sc.status = 'active'
           ORDER BY created_at DESC LIMIT 1`
        );

    let companyId: string | null = null;
    let role = "employee";
    if (companyResult.rows.length > 0) {
      const config = companyResult.rows[0];
      if (config.domain_restriction) {
        const domain = parsed.data.userName.split("@")[1];
        if (domain !== config.domain_restriction) {
          return res.status(403).json({
            schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
            detail: `Domain ${domain} not allowed`,
            status: "403",
          });
        }
      }
      companyId = config.company_id;
      role = config.default_role;
    }

    const result = await query(
      `INSERT INTO enterprise_users (email, company_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
       RETURNING id, email, role, company_id, created_at`,
      [parsed.data.userName, companyId, role]
    );

    await auditLog(result.rows[0].id, "scim_user_provisioned", "enterprise_users", {
      email: parsed.data.userName,
      method: "SCIM",
      external_id: parsed.data.externalId,
    });

    res.status(201).json(toScimUser(result.rows[0]));
  } catch (err: any) {
    console.error("SCIM create error:", err.message);
    res.status(500).json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Failed to create user", status: "500" });
  }
});

router.put("/enterprise/scim/v2/Users/:id", async (req, res) => {
  const parsed = scimUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail: "Invalid user data",
      status: "400",
    });
  }

  try {
    const result = await query(
      `UPDATE enterprise_users SET email = $1 WHERE id = $2
       RETURNING id, email, role, company_id, created_at`,
      [parsed.data.userName, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "User not found", status: "404" });
    }

    await auditLog(req.params.id, "scim_user_updated", "enterprise_users", { email: parsed.data.userName });
    res.json(toScimUser(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Failed to update user", status: "500" });
  }
});

router.patch("/enterprise/scim/v2/Users/:id", async (req, res) => {
  const ops = req.body?.Operations;
  if (!Array.isArray(ops)) {
    return res.status(400).json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail: "Invalid PATCH request",
      status: "400",
    });
  }

  try {
    for (const op of ops) {
      if (op.op === "replace" && op.path === "active" && op.value === false) {
        await query(`DELETE FROM enterprise_users WHERE id = $1`, [req.params.id]);
        await auditLog(req.params.id, "scim_user_deprovisioned", "enterprise_users", { method: "SCIM_PATCH" });
        return res.status(204).send();
      }
    }

    const result = await query(
      `SELECT id, email, role, company_id, created_at FROM enterprise_users WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "User not found", status: "404" });
    }
    res.json(toScimUser(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Failed to patch user", status: "500" });
  }
});

router.delete("/enterprise/scim/v2/Users/:id", async (req, res) => {
  try {
    await query(`DELETE FROM enterprise_users WHERE id = $1`, [req.params.id]);
    await auditLog(req.params.id, "scim_user_deprovisioned", "enterprise_users", { method: "SCIM_DELETE" });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Failed to delete user", status: "500" });
  }
});

function toScimUser(row: any) {
  const emailParts = (row.email || "").split("@");
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: row.id,
    userName: row.email,
    name: { givenName: emailParts[0] || "", familyName: "" },
    emails: [{ value: row.email, primary: true }],
    active: true,
    meta: {
      resourceType: "User",
      created: row.created_at,
      location: `/api/enterprise/scim/v2/Users/${row.id}`,
    },
  };
}

export default router;
