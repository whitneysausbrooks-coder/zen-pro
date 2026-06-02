import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

router.get("/auth/user", (_req: Request, res: Response) => {
  res.json({ user: null });
});

export default router;
