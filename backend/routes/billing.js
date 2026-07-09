require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const {
  confirmDemoPayment,
  createCheckoutOrder,
  getOrderForUser,
  listPlans,
  listUserOrders,
} = require("../services/billingService");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Chưa đăng nhập" });
  }

  try {
    req.user = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token không hợp lệ" });
  }
}

router.get("/plans", (_req, res) => {
  res.json({ plans: listPlans() });
});

router.get("/orders", authMiddleware, async (req, res) => {
  try {
    res.json({ orders: await listUserOrders(req.user.id) });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Không tải được đơn hàng" });
  }
});

router.get("/orders/:orderId", authMiddleware, async (req, res) => {
  try {
    res.json({ order: await getOrderForUser(req.user.id, req.params.orderId) });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Không tải được đơn hàng" });
  }
});

router.post("/checkout", authMiddleware, async (req, res) => {
  try {
    const checkout = await createCheckoutOrder({
      userId: req.user.id,
      plan: req.body.plan,
      billingCycle: req.body.billingCycle,
      provider: req.body.provider || "demo",
    });
    res.status(201).json(checkout);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Không tạo được đơn hàng" });
  }
});

router.post("/demo/confirm", authMiddleware, async (req, res) => {
  try {
    const result = await confirmDemoPayment({
      userId: req.user.id,
      orderId: req.body.orderId,
    });
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Không xác nhận được thanh toán" });
  }
});

module.exports = router;
