import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dataRouter from "./data";
import leaderboardRouter from "./leaderboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dataRouter);
router.use(leaderboardRouter);

export default router;
