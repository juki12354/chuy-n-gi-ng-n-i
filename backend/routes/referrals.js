const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getReferralSummary } = require("../services/referralService");

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    return res.json(await getReferralSummary(req.user.id));
  } catch (error) {
    console.error("Referral summary error:", error.message);
    return res.status(500).json({ error: "Không tải được thông tin giới thiệu" });
  }
});

module.exports = router;
