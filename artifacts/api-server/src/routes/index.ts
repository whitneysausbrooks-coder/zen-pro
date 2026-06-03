import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import questRouter from "./quest";
import stripeRouter from "./stripe";
import sponsorRouter from "./sponsor";
import adminRouter from "./admin";
import backupRouter from "./backup";
import notificationsRouter from "./notifications";
import iapRouter from "./iap";
import appUserRouter from "./app-user";
import aiRouter from "./ai";
import cbiRouter from "./cbi";
import donationsRouter from "./donations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(backupRouter);
router.use(authRouter);
router.use("/quest", questRouter);
router.use(stripeRouter);
router.use(iapRouter);
router.use(appUserRouter);
router.use(aiRouter);
router.use(cbiRouter);
router.use(donationsRouter);
router.use("/", sponsorRouter);
router.use("/", adminRouter);
router.use("/", notificationsRouter);

export default router;
