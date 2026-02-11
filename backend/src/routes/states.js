const { Router } = require("express");
const pool = require("../db");

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    let result;
    if (search) {
      result = await pool.query(
        `SELECT id, name, abbreviation, capital
         FROM states
         WHERE name ILIKE $1 OR abbreviation ILIKE $1 OR capital ILIKE $1
         ORDER BY name`,
        [`%${search}%`]
      );
    } else {
      result = await pool.query(
        "SELECT id, name, abbreviation, capital FROM states ORDER BY name"
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching states:", err.message);
    res.status(500).json({ error: "Failed to fetch states" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT id, name, abbreviation, capital FROM states WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "State not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching state:", err.message);
    res.status(500).json({ error: "Failed to fetch state" });
  }
});

module.exports = router;
