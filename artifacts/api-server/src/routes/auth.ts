import { Router } from "express";
import { getAuth } from "@clerk/express";
import type { Request, Response } from "express";

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

export default router;
