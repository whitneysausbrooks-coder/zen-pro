import { Router, type IRouter } from "express";
import healthRouter from "./health";
import questRouter from "./quest";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/quest", questRouter);
router.use(stripeRouter);

export default router;
