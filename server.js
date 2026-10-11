const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use("/dashboard", express.static(path.join(__dirname, "public", "dashboard")));
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  next();
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Soil Cloud API is running"
  });
});

app.post("/api/soil", authenticateApiKey, async (req, res) => {
  try {
    const {
      device_id,
      timestamp,
      ph,
      temperature,
      moisture,
      nitrogen,
      phosphorus,
      potassium,
      ec,
      classification,
      recommendation
    } = req.body;

    // Validasi field wajib
    if (
      !device_id ||
      !timestamp ||
      ph === undefined ||
      temperature === undefined ||
      moisture === undefined ||
      nitrogen === undefined ||
      phosphorus === undefined ||
      potassium === undefined ||
      ec === undefined ||
      !classification ||
      !recommendation
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or incomplete data"
      });
    }

    // Validasi tipe data numerik
    const numericFields = {
      ph,
      temperature,
      moisture,
      nitrogen,
      phosphorus,
      potassium,
      ec
    };

    for (const [field, value] of Object.entries(numericFields)) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a valid number`
        });
      }
    }

    const { data, error } = await supabase
      .from("soil_measurements")
      .insert([
        {
          device_id,
          timestamp,
          ph,
          temperature,
          moisture,
          nitrogen,
          phosphorus,
          potassium,
          ec,
          classification,
          recommendation
        }
      ])
      .select();

    if (error) {
      console.error("Supabase error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to save data",
        error: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: "Data saved successfully",
      data
    });

  } catch (error) {
    console.error("Server error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

app.get("/api/soil/latest", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("soil_measurements")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Supabase error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve data",
        error: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: "Data retrieved successfully",
      data
    });

  } catch (error) {
    console.error("Server error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

app.get("/api/soil", authenticateApiKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("soil_measurements")
      .select("*")
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve data",
        error: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: "Data retrieved successfully",
      data
    });

  } catch (error) {
    console.error("Server error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  const httpsOptions = {
    key: fs.readFileSync("./certs/server.key"),
    cert: fs.readFileSync("./certs/server.crt")
  };

  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`HTTPS server running on https://localhost:${PORT}`);
  });
}

module.exports = app;