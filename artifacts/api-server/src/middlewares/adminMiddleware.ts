import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    res.status(403).json({ error: "Admin access is not configured" });
    return;
  }

  const authHeader = req.headers["authorization"];
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token || token !== adminSecret) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}
