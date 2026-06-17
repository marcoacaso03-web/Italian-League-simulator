import { Router, type IRouter } from "express";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const router: IRouter = Router();

router.get("/leaderboard", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nickname, score, overall, points, position,
              formation, difficulty, show_ratings, era_from, era_to, created_at
       FROM leaderboard ORDER BY score DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/leaderboard", async (req, res) => {
  const {
    nickname, score, overall, points, position,
    formation, difficulty, show_ratings, era_from, era_to,
  } = req.body as Record<string, unknown>;

  if (
    typeof nickname !== "string" || !nickname.trim() ||
    typeof score !== "number" || typeof overall !== "number" ||
    typeof points !== "number" || typeof position !== "number" ||
    typeof formation !== "string" || typeof difficulty !== "string" ||
    typeof show_ratings !== "string" ||
    typeof era_from !== "number" || typeof era_to !== "number"
  ) {
    res.status(400).json({ error: "Invalid payload" }); return;
  }

  try {
    const countResult = await pool.query("SELECT COUNT(*) AS cnt FROM leaderboard");
    const count = parseInt(countResult.rows[0].cnt as string, 10);

    if (count >= 50) {
      const minResult = await pool.query(
        "SELECT score FROM leaderboard ORDER BY score ASC LIMIT 1"
      );
      const minScore = (minResult.rows[0]?.score ?? 0) as number;
      if (score <= minScore) {
        res.json({ inserted: false, reason: "not_in_top50" }); return;
      }
    }

    const uid = (req.body as Record<string, unknown>).uid as string | undefined;

    // Match by uid (Firebase) if provided, else by nickname (legacy)
    const existingQuery = uid
      ? await pool.query("SELECT id, score FROM leaderboard WHERE uid = $1", [uid])
      : await pool.query("SELECT id, score FROM leaderboard WHERE nickname = $1", [nickname]);

    if (existingQuery.rows.length > 0) {
      if (score > (existingQuery.rows[0].score as number)) {
        const whereCol = uid ? "uid" : "nickname";
        const whereVal = uid ?? nickname;
        await pool.query(
          `UPDATE leaderboard
           SET score=$1, overall=$2, points=$3, position=$4,
               formation=$5, difficulty=$6, show_ratings=$7,
               era_from=$8, era_to=$9, nickname=$10, created_at=NOW()
           WHERE ${whereCol}=$11`,
          [score, overall, points, position, formation, difficulty, show_ratings, era_from, era_to, nickname, whereVal]
        );
        res.json({ inserted: true, updated: true }); return;
      }
      res.json({ inserted: false, reason: "existing_score_better" }); return;
    }

    if (count >= 50) {
      await pool.query(
        "DELETE FROM leaderboard WHERE id = (SELECT id FROM leaderboard ORDER BY score ASC LIMIT 1)"
      );
    }

    await pool.query(
      `INSERT INTO leaderboard
         (nickname, uid, score, overall, points, position, formation, difficulty, show_ratings, era_from, era_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [nickname, uid ?? null, score, overall, points, position, formation, difficulty, show_ratings, era_from, era_to]
    );
    res.json({ inserted: true, updated: false });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

export default router;
