import { type Request, type Response, type NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (adminIds.length === 0) {
    res.status(403).json({ error: "Admin access is not configured" });
    return;
  }

  const userId = req.user?.id;
  if (!userId || !adminIds.includes(userId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}
