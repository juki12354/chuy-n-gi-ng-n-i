const crypto = require("crypto");
const pool = require("../db");
const {
  PLAN_CONFIG,
  createHttpError,
  getPurchasedQuotaSeconds,
  getQuotaStatus,
  normalizeBillingCycle,
  normalizePlan,
} = require("./quotaService");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const ORDER_TTL_MINUTES = Number.parseInt(
  process.env.BILLING_ORDER_TTL_MINUTES || "30",
  10,
);

const PLAN_PRICES = {
  standard: {
    monthly: Number.parseInt(process.env.STANDARD_MONTHLY_PRICE_VND || "39000", 10),
    yearly: Number.parseInt(process.env.STANDARD_YEARLY_PRICE_VND || "390000", 10),
  },
  special: {
    monthly: Number.parseInt(process.env.SPECIAL_MONTHLY_PRICE_VND || "89000", 10),
    yearly: Number.parseInt(process.env.SPECIAL_YEARLY_PRICE_VND || "890000", 10),
  },
};

function getPlanPrice(plan, billingCycle) {
  const planName = normalizePlan(plan);
  const cycle = normalizeBillingCycle(billingCycle);
  return PLAN_PRICES[planName]?.[cycle] ?? null;
}

function serializeOrder(row) {
  if (!row) return null;
  const planName = normalizePlan(row.plan);
  const cycle = normalizeBillingCycle(row.billing_cycle);
  const config = PLAN_CONFIG[planName] || PLAN_CONFIG.free;
  return {
    id: row.id,
    userId: row.user_id,
    plan: planName,
    label: config.label,
    billingCycle: cycle,
    quotaSeconds: getPurchasedQuotaSeconds(planName, cycle),
    amount: Number(row.amount || 0),
    currency: row.currency || "VND",
    status: row.status,
    provider: row.provider,
    providerOrderId: row.provider_order_id,
    paymentUrl: row.payment_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
    expiresAt: row.expires_at,
  };
}

function listPlans() {
  return ["free", "standard", "special", "business"].map((planName) => {
    const config = PLAN_CONFIG[planName];
    return {
      code: planName,
      label: config.label,
      monthly: {
        price: PLAN_PRICES[planName]?.monthly ?? null,
        quotaSeconds: config.quotaSeconds,
      },
      yearly: {
        price: PLAN_PRICES[planName]?.yearly ?? null,
        quotaSeconds: config.yearlyQuotaSeconds || config.quotaSeconds * 12,
      },
      limits: {
        maxUploadMb: config.maxUploadMb,
        maxRecordSeconds: config.maxRecordSeconds,
        maxFileSeconds: config.maxFileSeconds,
      },
    };
  });
}

async function createCheckoutOrder({
  userId,
  plan,
  billingCycle = "monthly",
  provider = "demo",
}) {
  const planName = normalizePlan(plan);
  const cycle = normalizeBillingCycle(billingCycle);
  const amount = getPlanPrice(planName, cycle);

  if (planName === "free") {
    throw createHttpError(400, "Gói Free không cần thanh toán");
  }
  if (planName === "business") {
    throw createHttpError(
      400,
      "Gói Business cần liên hệ tư vấn để cấu hình hợp đồng riêng",
    );
  }
  if (amount === null) {
    throw createHttpError(400, "Gói cước không hợp lệ");
  }

  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60 * 1000);
  const providerOrderId = `${provider}_${id}`;
  const paymentUrl = `${FRONTEND_URL}/checkout/${id}`;

  const { rows } = await pool.query(
    `INSERT INTO billing_orders (
       id, user_id, plan, billing_cycle, amount, currency, status,
       provider, provider_order_id, payment_url, raw_request, expires_at
     )
     VALUES ($1, $2, $3, $4, $5, 'VND', 'pending', $6, $7, $8, $9::jsonb, $10)
     RETURNING *`,
    [
      id,
      userId,
      planName,
      cycle,
      amount,
      provider,
      providerOrderId,
      paymentUrl,
      JSON.stringify({ plan: planName, billingCycle: cycle, provider }),
      expiresAt,
    ],
  );

  return {
    order: serializeOrder(rows[0]),
    paymentUrl,
  };
}

async function getOrderForUser(userId, orderId) {
  const { rows } = await pool.query(
    `SELECT * FROM billing_orders WHERE id = $1 AND user_id = $2`,
    [orderId, userId],
  );
  if (!rows[0]) throw createHttpError(404, "Không tìm thấy đơn hàng");
  return serializeOrder(rows[0]);
}

async function listUserOrders(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM billing_orders
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId],
  );
  return rows.map(serializeOrder);
}

async function confirmDemoPayment({ userId, orderId }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT * FROM billing_orders
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [orderId, userId],
    );
    const order = rows[0];
    if (!order) throw createHttpError(404, "Không tìm thấy đơn hàng");

    if (order.status === "paid") {
      await client.query("COMMIT");
      return {
        order: serializeOrder(order),
        quota: await getQuotaStatus(userId),
      };
    }

    if (order.status !== "pending") {
      throw createHttpError(400, `Đơn hàng đang ở trạng thái ${order.status}`);
    }

    if (order.expires_at && new Date(order.expires_at).getTime() < Date.now()) {
      await client.query(
        `UPDATE billing_orders
         SET status = 'expired', updated_at = NOW()
         WHERE id = $1`,
        [orderId],
      );
      throw createHttpError(400, "Đơn hàng đã hết hạn");
    }

    const planName = normalizePlan(order.plan);
    const cycle = normalizeBillingCycle(order.billing_cycle);
    const quotaSeconds = getPurchasedQuotaSeconds(planName, cycle);
    const planExpiresAt = new Date(
      Date.now() + (cycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000,
    );
    const transactionId = `demo_txn_${crypto.randomUUID()}`;

    await client.query(
      `UPDATE users
       SET plan = $1,
           quota_seconds = $2,
           plan_started_at = NOW(),
           plan_expires_at = $3
       WHERE id = $4`,
      [planName, quotaSeconds, planExpiresAt, userId],
    );

    const paidOrder = await client.query(
      `UPDATE billing_orders
       SET status = 'paid',
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId],
    );

    await client.query(
      `INSERT INTO payments (
         order_id, provider, provider_transaction_id, amount,
         currency, status, raw_payload, paid_at
       )
       VALUES ($1, $2, $3, $4, $5, 'paid', $6::jsonb, NOW())`,
      [
        orderId,
        order.provider,
        transactionId,
        order.amount,
        order.currency,
        JSON.stringify({
          provider: "demo",
          orderId,
          transactionId,
          paidAt: new Date().toISOString(),
        }),
      ],
    );

    await client.query("COMMIT");

    return {
      order: serializeOrder(paidOrder.rows[0]),
      quota: await getQuotaStatus(userId),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createCheckoutOrder,
  confirmDemoPayment,
  getOrderForUser,
  listPlans,
  listUserOrders,
};
