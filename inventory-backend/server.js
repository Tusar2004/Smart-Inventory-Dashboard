const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Your HTTP trigger URL
const TRIGGER_URL =
  "https://asia-south1.workflow.boltic.app/e173dead-7474-44c1-8558-d60f325116b0";

// HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "Smart Inventory Predictor" });
});

// MAIN PREDICT ROUTE — No polling needed!
app.post("/predict", async (req, res) => {
  try {
    console.log("\n🔵 Sending request to Boltic HTTP workflow...\n");

    const response = await axios.post(
      TRIGGER_URL,
      {},
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("🟢 Workflow Response Received:");
    console.log(JSON.stringify(response.data, null, 2));

    // Extract predictions safely
    const predictions =
      response.data?.result?.predictions ||
      response.data?.result?.response_body?.result?.predictions ||
      response.data?.predictions;

    if (!predictions) {
      return res.status(500).json({
        success: false,
        error: "Predictions not found in workflow output",
        rawResponse: response.data,
      });
    }

    return res.json({
      success: true,
      count: predictions.length,
      predictions,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error("❌ ERROR:", err.message);

    return res.status(500).json({
      success: false,
      error: "Failed to execute prediction workflow",
      message: err.message,
      raw: err.response?.data || null,
    });
  }
});

// START SERVER
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
});
