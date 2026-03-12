import { Router, type IRouter } from "express";
import healthRouter from "./health";
import questRouter from "./quest";
import stripeRouter from "./stripe";
import enterpriseRouter from "./enterprise";
import sponsorRouter from "./sponsor";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/quest", questRouter);
router.use(stripeRouter);
router.use(enterpriseRouter);
router.use("/", sponsorRouter);
router.use("/", adminRouter);

export default router;
