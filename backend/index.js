require("dotenv").config();
const express = require("express");
const cors = require("cors");

require("./config/passport");
const authRoutes = require("./routes/auth");
const transcribeRoutes = require("./routes/transcribe");
const apiKeyRoutes = require("./routes/apiKeys");
const publicApiRoutes = require("./routes/publicApi");
const quotaRoutes = require("./routes/quota");
const billingRoutes = require("./routes/billing");
const settingsRoutes = require("./routes/settings");
const supportRoutes = require("./routes/support");
const initDatabase = require("./initDb");
const { getTranscriptionProvider } = require("./services/transcriptionService");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/transcribe", transcribeRoutes);
app.use("/api/keys", apiKeyRoutes);
app.use("/api/quota", quotaRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/v1", publicApiRoutes);

app.get("/", (_req, res) => {
  res.json({
    name: "Vbee API Backend",
    status: "ok",
    docs: "/api/v1/health",
    message:
      "Backend API đang chạy. Mở frontend ở http://localhost:3000 để dùng giao diện.",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Backend đang chạy",
    transcriptionProvider: getTranscriptionProvider(),
  });
});

const PORT = process.env.PORT || 3001;

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server đang chạy tại http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Không thể khởi tạo database:", error.message);
    process.exit(1);
  });
