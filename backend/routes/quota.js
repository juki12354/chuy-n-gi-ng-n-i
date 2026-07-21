require("dotenv").config();
const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  getQuotaStatus,
  updateQuotaAlert,
  upgradeUserPlan,
} = require("../services/quotaService");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    return res.json(await getQuotaStatus(req.user.id));
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Không lấy được quota" });
  }
});

router.patch("/alert", requireAuth, async (req, res) => {
  try {
    const minutes = Number(req.body.alertMinutes);
    const seconds = Number.isFinite(minutes)
      ? minutes * 60
      : Number(req.body.alertSeconds);
    return res.json(await updateQuotaAlert(req.user.id, seconds));
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Không cập nhật được cảnh báo quota" });
  }
});

// Mock upgrade endpoint for local/dev flow. Replace with real payment webhook later.
router.post("/upgrade", requireAuth, async (req, res) => {
  if (process.env.ENABLE_DEV_QUOTA_UPGRADE !== "true") {
    return res.status(403).json({
      error:
        "Nâng cấp trực tiếp đã tắt. Vui lòng mua gói qua /api/billing/checkout.",
    });
  }

  try {
    const plan = req.body.plan || "special";
    const billingCycle = req.body.billingCycle || req.body.cycle || "monthly";
    return res.json(await upgradeUserPlan(req.user.id, plan, billingCycle));
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Không nâng cấp được tài khoản" });
  }
});

module.exports = router;
