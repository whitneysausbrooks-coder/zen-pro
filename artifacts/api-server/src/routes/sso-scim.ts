import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import crypto from "crypto";
import { query, auditLog } from "../lib/db";
import { handleSeatChangeProspective } from "../lib/revenueRecognition";

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

router.use("/enterprise/sso/configure", requireEnterpriseAuth);
router.use("/enterprise/sso/config", requireEnterpriseAuth);
router.use("/enterprise/scim/{*path}", requireEnterpriseAuth);
router.use("/enterprise/tenant/{*path}", requireEnterpriseAuth);

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
  });
});

function validateRedirectUri(redirectUri: string, companyDomain?: string): boolean {
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== "https:") return false;
    if (companyDomain && !url.hostname.endsWith(companyDomain)) return false;
    return true;
  } catch {
    return false;
  }
}

const SSO_SIGNING_SECRET = process.env.SSO_SIGNING_SECRET || crypto.randomBytes(32).toString("hex");

function signIdToken(payload: Record<string, any>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SSO_SIGNING_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

router.get("/enterprise/sso/authorize", async (req, res) => {
  const { company_id, redirect_uri, state: clientState, scope } = req.query as Record<string, string>;

  if (!company_id || !redirect_uri) {
    return res.status(400).json({ error: "company_id and redirect_uri are required" });
  }

  try {
    const configResult = await query(
      `SELECT * FROM sso_configurations WHERE company_id = $1 AND status = 'active'`,
      [company_id]
    );

    if (configResult.rows.length === 0) {
      return res.status(404).json({ error: "SSO not configured for this company" });
    }

    const config = configResult.rows[0];

    if (!validateRedirectUri(redirect_uri, config.domain_restriction)) {
      return res.status(400).json({ error: "Invalid redirect_uri: must be HTTPS and match configured domain" });
    }

    const internalState = crypto.randomBytes(32).toString("hex");
    const nonce = crypto.randomBytes(16).toString("hex");

    await query(
      `INSERT INTO sso_sessions (company_id, state, nonce, redirect_uri, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')`,
      [company_id, internalState, nonce, redirect_uri]
    );

    let discoveryEndpoints = {
      authorization_endpoint: config.authorization_endpoint,
    };

    if (!discoveryEndpoints.authorization_endpoint && config.discovery_url) {
      try {
        const disc = await fetch(config.discovery_url);
        const discData = await disc.json() as any;
        discoveryEndpoints.authorization_endpoint = discData.authorization_endpoint;

        await query(
          `UPDATE sso_configurations
           SET authorization_endpoint = $1, token_endpoint = $2, userinfo_endpoint = $3, jwks_uri = $4
           WHERE id = $5`,
          [
            discData.authorization_endpoint, discData.token_endpoint,
            discData.userinfo_endpoint, discData.jwks_uri, config.id,
          ]
        );
      } catch (e: any) {
        console.error("[SSO] Discovery fetch failed:", e.message);
        return res.status(502).json({ error: "Failed to discover IdP endpoints" });
      }
    }

    if (!discoveryEndpoints.authorization_endpoint) {
      return res.status(500).json({ error: "No authorization endpoint configured" });
    }

    const scopes = config.scopes || scope || "openid profile email";
    const idpUrl = new URL(discoveryEndpoints.authorization_endpoint);
    idpUrl.searchParams.set("client_id", config.client_id);
    idpUrl.searchParams.set("response_type", "code");
    idpUrl.searchParams.set("redirect_uri", `${getBaseUrl()}/api/enterprise/sso/callback`);
    idpUrl.searchParams.set("scope", scopes);
    idpUrl.searchParams.set("state", internalState);
    idpUrl.searchParams.set("nonce", nonce);

    await auditLog(null, "sso_authorize_initiated", "sso_sessions", {
      company_id, provider: config.provider,
    });

    res.json({
      redirect_url: idpUrl.toString(),
      state: internalState,
      provider: config.provider,
    });
  } catch (err: any) {
    console.error("[SSO] Authorize error:", err.message);
    res.status(500).json({ error: "SSO authorization failed" });
  }
});

router.get("/enterprise/sso/callback", async (req, res) => {
  const { code, state, error: idpError, error_description } = req.query as Record<string, string>;

  if (idpError) {
    return res.status(400).json({ error: idpError, description: error_description });
  }

  if (!code || !state) {
    return res.status(400).json({ error: "Missing code or state parameter" });
  }

  try {
    const sessionResult = await query(
      `UPDATE sso_sessions SET nonce = nonce
       FROM sso_configurations sc
       WHERE sso_sessions.company_id = sc.company_id AND sc.status = 'active'
         AND sso_sessions.state = $1 AND sso_sessions.expires_at > NOW() AND sso_sessions.code_used = FALSE
       RETURNING sso_sessions.*, sc.client_id, sc.client_secret, sc.token_endpoint, sc.userinfo_endpoint,
                 sc.discovery_url, sc.provider, sc.auto_provision, sc.default_role, sc.domain_restriction`,
      [state]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired SSO session" });
    }

    const session = sessionResult.rows[0];
    let tokenEndpoint = session.token_endpoint;
    let userinfoEndpoint = session.userinfo_endpoint;

    if (!tokenEndpoint && session.discovery_url) {
      const disc = await fetch(session.discovery_url);
      const discData = await disc.json() as any;
      tokenEndpoint = discData.token_endpoint;
      userinfoEndpoint = discData.userinfo_endpoint;
    }

    if (!tokenEndpoint) {
      return res.status(500).json({ error: "Token endpoint not configured" });
    }

    const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${getBaseUrl()}/api/enterprise/sso/callback`,
        client_id: session.client_id,
        client_secret: session.client_secret,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[SSO] Token exchange failed:", errText);
      return res.status(502).json({ error: "Token exchange failed with IdP" });
    }

    const tokenData = await tokenRes.json() as any;

    let userInfo: any = null;
    if (userinfoEndpoint && tokenData.access_token) {
      const uiRes = await fetch(userinfoEndpoint, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (uiRes.ok) {
        userInfo = await uiRes.json();
      }
    }

    const email = userInfo?.email || parseJwtPayload(tokenData.id_token)?.email;
    const sub = userInfo?.sub || parseJwtPayload(tokenData.id_token)?.sub;
    const givenName = userInfo?.given_name || "";
    const familyName = userInfo?.family_name || "";

    if (!email) {
      return res.status(400).json({ error: "Could not retrieve email from IdP" });
    }

    if (session.domain_restriction) {
      const domain = email.split("@")[1];
      if (domain !== session.domain_restriction) {
        return res.status(403).json({ error: `Email domain ${domain} not allowed for this organization` });
      }
    }

    let user;
    const existingUser = await query(
      `SELECT * FROM enterprise_users WHERE email = $1`,
      [email]
    );

    if (existingUser.rows.length > 0) {
      user = existingUser.rows[0];
      await query(
        `UPDATE enterprise_users SET idp_subject = $1, last_login = NOW() WHERE id = $2`,
        [sub, user.id]
      );
    } else if (session.auto_provision) {
      const newUser = await query(
        `INSERT INTO enterprise_users (email, company_id, role, external_id, idp_subject, last_login)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [email, session.company_id, session.default_role, sub, sub]
      );
      user = newUser.rows[0];

      await auditLog(user.id, "sso_auto_provisioned", "enterprise_users", {
        email, company_id: session.company_id, provider: session.provider,
      });
    } else {
      return res.status(403).json({ error: "User not provisioned and auto-provisioning is disabled" });
    }

    const authCode = crypto.randomBytes(32).toString("hex");
    await query(
      `UPDATE sso_sessions SET code = $1, user_id = $2, access_token = $3, id_token = $4
       WHERE id = $5`,
      [authCode, user.id, tokenData.access_token, tokenData.id_token, session.id]
    );

    await auditLog(user.id, "sso_login_success", "sso_sessions", {
      company_id: session.company_id, provider: session.provider, email,
    });

    const redirectUrl = new URL(session.redirect_uri);
    redirectUrl.searchParams.set("code", authCode);
    redirectUrl.searchParams.set("state", state);

    res.redirect(redirectUrl.toString());
  } catch (err: any) {
    console.error("[SSO] Callback error:", err.message);
    res.status(500).json({ error: "SSO callback processing failed" });
  }
});

router.post("/enterprise/sso/token", async (req, res) => {
  const { grant_type, code, client_id, client_secret } = req.body;

  if (grant_type !== "authorization_code") {
    return res.status(400).json({ error: "unsupported_grant_type" });
  }

  if (!code || !client_id || !client_secret) {
    return res.status(400).json({ error: "invalid_request", error_description: "code, client_id, and client_secret are required" });
  }

  try {
    const sessionResult = await query(
      `UPDATE sso_sessions SET code_used = TRUE
       FROM sso_configurations sc
       WHERE sso_sessions.company_id = sc.company_id
         AND sso_sessions.code = $1
         AND sso_sessions.expires_at > NOW()
         AND sso_sessions.code_used = FALSE
       RETURNING sso_sessions.*, sc.client_id as config_client_id, sc.client_secret as config_client_secret`,
      [code]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(400).json({ error: "invalid_grant" });
    }

    const session = sessionResult.rows[0];

    if (client_id !== session.config_client_id) {
      return res.status(401).json({ error: "invalid_client" });
    }

    const secretMatch = crypto.timingSafeEqual(
      Buffer.from(client_secret),
      Buffer.from(session.config_client_secret)
    );
    if (!secretMatch) {
      return res.status(401).json({ error: "invalid_client" });
    }

    const userResult = await query(
      `SELECT eu.*, c.name as company_name
       FROM enterprise_users eu
       LEFT JOIN companies c ON c.id = eu.company_id
       WHERE eu.id = $1`,
      [session.user_id]
    );

    const user = userResult.rows[0];
    const accessToken = crypto.randomBytes(32).toString("hex");
    const emailParts = (user?.email || "").split("@");

    const idTokenPayload = {
      iss: `${getBaseUrl()}/api/enterprise/sso`,
      sub: user?.idp_subject || user?.id,
      aud: session.config_client_id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      nonce: session.nonce,
      email: user?.email,
      name: `${emailParts[0] || ""}`,
      given_name: emailParts[0] || "",
      family_name: "",
      org_id: session.company_id,
      org_name: user?.company_name || "",
      role: user?.role || "employee",
    };

    const idToken = signIdToken(idTokenPayload);

    res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      id_token: idToken,
      scope: "openid profile email",
    });
  } catch (err: any) {
    console.error("[SSO] Token error:", err.message);
    res.status(500).json({ error: "server_error" });
  }
});

router.get("/enterprise/sso/userinfo", async (req, res) => {
  const authHeader = req.headers.authorization;
  const code = req.query.code as string;

  if (!authHeader && !code) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    let session;
    if (code) {
      const result = await query(
        `SELECT ss.*, eu.email, eu.role, eu.idp_subject, eu.company_id, c.name as company_name
         FROM sso_sessions ss
         LEFT JOIN enterprise_users eu ON eu.id = ss.user_id
         LEFT JOIN companies c ON c.id = eu.company_id
         WHERE ss.code = $1`,
        [code]
      );
      session = result.rows[0];
    }

    if (!session) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const emailParts = (session.email || "").split("@");
    res.json({
      sub: session.idp_subject || session.user_id,
      email: session.email,
      email_verified: true,
      name: emailParts[0] || "",
      given_name: emailParts[0] || "",
      family_name: "",
      org_id: session.company_id,
      org_name: session.company_name || "",
      role: session.role || "employee",
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch user info" });
  }
});

function getBaseUrl(): string {
  return process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN || "localhost:8080"}`;
}

function parseJwtPayload(token: string | undefined): any {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch {
    return null;
  }
}

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
        await handleSCIMDeprovision(req.params.id, "SCIM_PATCH");
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
    await handleSCIMDeprovision(req.params.id, "SCIM_DELETE");
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Failed to delete user", status: "500" });
  }
});

async function handleSCIMDeprovision(userId: string, method: string) {
  const userResult = await query(
    `SELECT id, email, company_id FROM enterprise_users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) return;

  const user = userResult.rows[0];
  const companyId = user.company_id;

  await query("BEGIN");
  try {
    await query(`DELETE FROM enterprise_users WHERE id = $1`, [userId]);

    await auditLog(userId, "scim_user_deprovisioned", "enterprise_users", {
      email: user.email,
      company_id: companyId,
      method,
    });

    if (companyId) {
      const companyResult = await query(
        `SELECT subscription_id, seat_count, subscription_status FROM companies WHERE id = $1 FOR UPDATE`,
        [companyId]
      );

      if (companyResult.rows.length > 0) {
        const company = companyResult.rows[0];

        if (company.subscription_id && company.subscription_status === "active") {
          const newSeatCount = await query(
            `SELECT COUNT(*) as count FROM enterprise_users WHERE company_id = $1`,
            [companyId]
          );
          const currentSeats = parseInt(newSeatCount.rows[0].count);
          const previousSeats = company.seat_count || currentSeats + 1;

          if (currentSeats < previousSeats) {
            await handleSeatChangeProspective(
              companyId,
              company.subscription_id,
              currentSeats,
              previousSeats
            );

            await auditLog(null, "scim_revenue_adjustment", "revenue_schedules", {
              company_id: companyId,
              trigger: "scim_deprovision",
              deprovisioned_user: user.email,
              previous_seats: previousSeats,
              new_seats: currentSeats,
              method,
            });
          }
        }
      }
    }

    await query("COMMIT");
  } catch (err: any) {
    await query("ROLLBACK");
    console.error(`[SCIM→Revenue] Error in deprovision transaction:`, err.message);
    await auditLog(userId, "scim_deprovision_failed", "enterprise_users", {
      company_id: companyId,
      error: err.message,
    });
    throw err;
  }
}

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

const brandingSchema = z.object({
  logo_url: z.string().url().nullable().optional(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  custom_domain: z.string().max(255).nullable().optional(),
  welcome_message: z.string().max(500).nullable().optional(),
});

router.get("/enterprise/tenant/:companyId/branding", async (req, res) => {
  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }

  try {
    const result = await query(
      `SELECT id, name, logo_url, primary_color, secondary_color, accent_color,
              custom_domain, welcome_message
       FROM companies WHERE id = $1`,
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    const company = result.rows[0];
    res.json({
      tenant_id: company.id,
      company_name: company.name,
      branding: {
        logo_url: company.logo_url,
        primary_color: company.primary_color || "#6C63FF",
        secondary_color: company.secondary_color || "#2D2B55",
        accent_color: company.accent_color || "#00D9FF",
        custom_domain: company.custom_domain,
        welcome_message: company.welcome_message || "Welcome to your wellness dashboard",
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch branding" });
  }
});

router.put("/enterprise/tenant/:companyId/branding", async (req, res) => {
  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }

  const parsed = brandingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(parsed.data)) {
      if (val !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(val);
        idx++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "No branding fields provided" });
    }

    values.push(companyId);
    const result = await query(
      `UPDATE companies SET ${fields.join(", ")} WHERE id = $${idx}
       RETURNING id, name, logo_url, primary_color, secondary_color, accent_color, custom_domain, welcome_message`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    await auditLog(null, "tenant_branding_updated", "companies", {
      company_id: companyId,
      updated_fields: Object.keys(parsed.data),
    });

    const company = result.rows[0];
    res.json({
      success: true,
      tenant_id: company.id,
      company_name: company.name,
      branding: {
        logo_url: company.logo_url,
        primary_color: company.primary_color,
        secondary_color: company.secondary_color,
        accent_color: company.accent_color,
        custom_domain: company.custom_domain,
        welcome_message: company.welcome_message,
      },
    });
  } catch (err: any) {
    console.error("Branding update error:", err.message);
    res.status(500).json({ error: "Failed to update branding" });
  }
});

router.get("/enterprise/tenant/:companyId/theme", async (req, res) => {
  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }

  try {
    const result = await query(
      `SELECT name, logo_url, primary_color, secondary_color, accent_color, welcome_message
       FROM companies WHERE id = $1`,
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    const c = result.rows[0];
    res.json({
      company_name: c.name,
      css_variables: {
        "--nq-primary": c.primary_color || "#6C63FF",
        "--nq-secondary": c.secondary_color || "#2D2B55",
        "--nq-accent": c.accent_color || "#00D9FF",
      },
      logo_url: c.logo_url,
      welcome_message: c.welcome_message || "Welcome to your wellness dashboard",
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch theme" });
  }
});

export default router;
