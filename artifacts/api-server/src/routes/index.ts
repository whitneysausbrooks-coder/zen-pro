import { Router, type IRouter } from "express";
import healthRouter from "./health";
import questRouter from "./quest";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/quest", questRouter);

export default router;
