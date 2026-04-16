import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import questRouter from "./quest";
import stripeRouter from "./stripe";
import enterpriseRouter from "./enterprise";
import stripeEnterpriseRouter from "./stripe-enterprise";
import sponsorRouter from "./sponsor";
import adminRouter from "./admin";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/quest", questRouter);
router.use(stripeRouter);
router.use(enterpriseRouter);
router.use(stripeEnterpriseRouter);
router.use("/", sponsorRouter);
router.use("/", adminRouter);
router.use("/", notificationsRouter);

export default router;
