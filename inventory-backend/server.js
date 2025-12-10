// server.js - Enhanced Backend
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const TRIGGER_URL = "https://asia-south1.workflow.boltic.app/e173dead-7474-44c1-8558-d60f325116b0";
const PORT = 3000;

// In-memory cache for predictions
let cache = {
  lastPrediction: null,
  timestamp: null,
  requestCount: 0
};

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Smart Inventory Predictor",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: {
      hasPredictions: !!cache.lastPrediction,
      lastUpdate: cache.timestamp,
      totalRequests: cache.requestCount
    }
  });
});

// Get cached predictions
app.get("/predictions/cache", (req, res) => {
  if (!cache.lastPrediction) {
    return res.status(404).json({
      success: false,
      error: "No cached predictions available"
    });
  }

  res.json({
    success: true,
    ...cache.lastPrediction,
    cached: true,
    cacheAge: Date.now() - cache.timestamp
  });
});

// Main prediction endpoint
app.post("/predict", async (req, res) => {
  try {
    cache.requestCount++;
    
    console.log("\n🔵 Initiating AI prediction workflow...");
    console.log(`📊 Request #${cache.requestCount}`);

    const startTime = Date.now();

    const response = await axios.post(
      TRIGGER_URL,
      {},
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000 // 30 second timeout
      }
    );

    const processingTime = Date.now() - startTime;
    console.log(`⏱️  Workflow completed in ${processingTime}ms`);

    // Extract predictions with multiple fallback paths
    const predictions =
      response.data?.result?.predictions ||
      response.data?.result?.response_body?.result?.predictions ||
      response.data?.predictions ||
      [];

    if (!predictions || predictions.length === 0) {
      console.log("⚠️  No predictions found in response");
      return res.status(500).json({
        success: false,
        error: "No predictions returned from workflow",
        rawResponse: response.data,
        debug: {
          responseKeys: Object.keys(response.data || {}),
          resultKeys: response.data?.result ? Object.keys(response.data.result) : []
        }
      });
    }

    // Calculate additional analytics
    const analytics = calculateAnalytics(predictions);

    const result = {
      success: true,
      count: predictions.length,
      predictions,
      analytics,
      metadata: {
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`,
        requestId: cache.requestCount
      }
    };

    // Update cache
    cache.lastPrediction = result;
    cache.timestamp = Date.now();

    console.log("✅ Predictions generated successfully");
    console.log(`📦 Total products: ${predictions.length}`);
    console.log(`⚠️  Critical stock: ${analytics.criticalStock}`);
    console.log(`📈 Total demand: ${analytics.totalDemand}`);

    return res.json(result);

  } catch (err) {
    console.error("❌ ERROR:", err.message);

    const errorResponse = {
      success: false,
      error: "Failed to execute prediction workflow",
      message: err.message,
      details: {
        code: err.code,
        timeout: err.code === 'ECONNABORTED',
        timestamp: new Date().toISOString()
      }
    };

    if (err.response) {
      errorResponse.httpStatus = err.response.status;
      errorResponse.httpData = err.response.data;
    }

    return res.status(500).json(errorResponse);
  }
});

// Analytics calculation helper
function calculateAnalytics(predictions) {
  const criticalThreshold = 30;
  const lowThreshold = 50;

  return {
    totalProducts: predictions.length,
    criticalStock: predictions.filter(p => p.current_stock < criticalThreshold).length,
    lowStock: predictions.filter(p => p.current_stock >= criticalThreshold && p.current_stock < lowThreshold).length,
    adequateStock: predictions.filter(p => p.current_stock >= lowThreshold).length,
    totalDemand: predictions.reduce((sum, p) => sum + (p.predicted_demand || 0), 0),
    totalSales: predictions.reduce((sum, p) => sum + (p.total_sales || 0), 0),
    restockNeeded: predictions.filter(p => (p.recommended_restock || 0) > 0).length,
    avgStock: Math.round(predictions.reduce((sum, p) => sum + p.current_stock, 0) / predictions.length),
    avgDemand: Math.round(predictions.reduce((sum, p) => sum + (p.predicted_demand || 0), 0) / predictions.length),
    topDemand: predictions
      .sort((a, b) => (b.predicted_demand || 0) - (a.predicted_demand || 0))
      .slice(0, 5)
      .map(p => ({ id: p.product_id, demand: p.predicted_demand }))
  };
}

// Get analytics only
app.get("/analytics", (req, res) => {
  if (!cache.lastPrediction) {
    return res.status(404).json({
      success: false,
      error: "No predictions available. Run /predict first."
    });
  }

  res.json({
    success: true,
    analytics: cache.lastPrediction.analytics,
    timestamp: cache.timestamp
  });
});

// Clear cache
app.delete("/cache", (req, res) => {
  cache = {
    lastPrediction: null,
    timestamp: null,
    requestCount: cache.requestCount // Keep request count
  };

  res.json({
    success: true,
    message: "Cache cleared successfully"
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    availableEndpoints: [
      "GET /health",
      "POST /predict",
      "GET /predictions/cache",
      "GET /analytics",
      "DELETE /cache"
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 Smart Inventory Predictor Server");
  console.log("=".repeat(60));
  console.log(`📡 Server running at: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Analytics: http://localhost:${PORT}/analytics`);
  console.log("=".repeat(60) + "\n");
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});
