import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dataRouter from "./data";
import leaderboardRouter from "./leaderboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dataRouter);
router.use(leaderboardRouter);

router.get("/config", (_req, res) => {
  res.json({
    firebase: {
      apiKey:            process.env.GOOGLE_API_KEY ?? "",
      authDomain:        "project-4143506525983233588.firebaseapp.com",
      projectId:         "project-4143506525983233588",
      storageBucket:     "project-4143506525983233588.firebasestorage.app",
      messagingSenderId: "226809178318",
      appId:             "1:226809178318:web:2e045cd2b51166d04fc89f",
    },
  });
});

export default router;
