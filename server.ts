import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import { Pool } from "pg";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ override: true });

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=require") || process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
});

let isDbConnected = false;

// Initialize tables (async)
async function initDB() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set. Database operations will fail. Please set it in the environment settings.");
    return;
  }

  if (process.env.DATABASE_URL.includes("@host:5432/")) {
    console.warn("DATABASE_URL appears to be using the placeholder 'host'. Please update it with your actual database host.");
    return;
  }

  try {
    const client = await db.connect();
    console.log("Successfully connected to PostgreSQL");
    client.release();
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        budget REAL DEFAULT 0,
        target_messages INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS integration_groups (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        default_retries INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS integrations (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        group_id INTEGER REFERENCES integration_groups(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        type TEXT,
        base_payload_size INTEGER DEFAULT 50,
        daily_volume INTEGER DEFAULT 1000,
        retries INTEGER DEFAULT 0,
        failure_rate REAL DEFAULT 2,
        config JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS simulations (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        integration_id INTEGER REFERENCES integrations(id) ON DELETE SET NULL,
        name TEXT,
        total_messages_monthly INTEGER,
        estimated_cost_monthly REAL,
        results JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    isDbConnected = true;
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Failed to initialize database:", err);
    isDbConnected = false;
  }
}

function checkDbConnection(req: Request, res: Response, next: Function) {
  if (!isDbConnected) {
    return res.status(503).json({ 
      error: 'Database not connected', 
      message: 'The application is unable to connect to the PostgreSQL database. Please check your DATABASE_URL environment variable.' 
    });
  }
  next();
}

function estimateCost(totalMessages: number): number {
  // SAP Integration Suite approximate pricing (USD)
  // Source: SAP Discovery Center (prices vary by region/contract)
  // First 10K messages typically included in base subscription
  const FREE_INCLUDED = 10_000;
  const PRICE_PER_10K_BLOCK = 17.50; // midpoint estimate
  const billableMessages = Math.max(0, totalMessages - FREE_INCLUDED);
  const blocks = Math.ceil(billableMessages / 10_000);
  return blocks * PRICE_PER_10K_BLOCK;
}

function simulateMessages(params: {
  base_payload_size: number;
  daily_volume: number;
  retries: number;
  failure_rate: number;
  steps?: any[];
  config?: any;
}) {
  const { base_payload_size, daily_volume, retries, failure_rate, steps, config: extraConfig } = params;
  
  const MESSAGE_SIZE_LIMIT = 250; // KB per SAP Note 2942344
  const DAYS_IN_MONTH = 30;

  // Extract inputs cleanly
  const avgPayloadKB = base_payload_size || 50;
  const dailyVol = daily_volume || 1000;
  const retryRatePercent = failure_rate || 2;
  const retryCount = retries || 0;
  const recordsPerSplit = extraConfig?.records_per_split || 1;
  const requestReplyCount = extraConfig?.request_reply_count || 0;
  const multicastBranches = extraConfig?.multicast_branches || 1;
  const isEdge = extraConfig?.is_edge_integration || false;
  const isSAPStandard = extraConfig?.is_sap_standard || false;
  const hasTimerStart = extraConfig?.has_timer_start || false;
  const workerNodes = extraConfig?.worker_nodes || 1;

  // If SAP standard unmodified content → FREE
  if (isSAPStandard) {
    return { 
      monthlyMessages: 0, 
      estimatedCost: 0, 
      isFree: true, 
      breakdown: { note: 'SAP-to-SAP standard content is not billed' }
    };
  }

  // Step 1: Base executions
  const baseExecutions = dailyVol * DAYS_IN_MONTH;

  // Step 2: Splitter (auto-detect from steps array OR use recordsPerSplit)
  let splitterMultiplier = 1;
  let detectedMulticastBranches = multicastBranches;
  
  if (steps && Array.isArray(steps)) {
    steps.forEach((step: any) => {
      if (step.type === 'splitter') {
        splitterMultiplier *= (step.config?.splitCount || recordsPerSplit);
      }
      if (step.type === 'multicast') {
        detectedMulticastBranches *= (step.config?.branchCount || 2);
      }
    });
  } else {
    splitterMultiplier = recordsPerSplit;
    detectedMulticastBranches = multicastBranches;
  }

  const afterSplitter = baseExecutions * splitterMultiplier;

  // Step 3: Multicast
  const afterMulticast = afterSplitter * detectedMulticastBranches;

  // Step 4: 250KB size rule — applied per message AFTER splitting
  const sizeMultiplier = Math.ceil(avgPayloadKB / MESSAGE_SIZE_LIMIT);
  const afterSize = afterMulticast * sizeMultiplier;

  // Step 5: Request-Reply — additive, NOT multiplicative
  // Each RR step generates: executions × 2 (req+reply) × sizeMultiplier
  let detectedRRCount = requestReplyCount;
  if (steps && Array.isArray(steps)) {
    detectedRRCount = steps.filter(
      (s: any) => s.type === 'request_reply' || s.type === 'api_call'
    ).length;
  }
  const rrMessages = detectedRRCount * baseExecutions * 2 * sizeMultiplier;

  const subtotal = afterSize + rrMessages;

  // Step 6: Retries — additive percentage
  const afterRetries = Math.ceil(subtotal * (1 + retryRatePercent / 100));

  // Step 7: Worker nodes — ONLY if Timer-triggered iFlow
  const afterWorkers = hasTimerStart ? afterRetries * workerNodes : afterRetries;

  // Step 8: Edge Integration Cell factor (0.5x)
  const totalBillableMessages = isEdge ? Math.ceil(afterWorkers * 0.5) : afterWorkers;

  // Step 9: Cost
  const estimatedCost = estimateCost(totalBillableMessages);
  const blocksOf10K = Math.ceil(Math.max(0, totalBillableMessages - 10000) / 10000);

  return {
    monthlyMessages: totalBillableMessages,
    estimatedCost,
    isFree: false,
    breakdown: {
      baseExecutions,
      splitterMultiplier,
      afterSplitter,
      multicastBranches: detectedMulticastBranches,
      afterMulticast,
      sizeMultiplier,
      afterSize,
      requestReplyMessages: rrMessages,
      subtotalBeforeRetries: subtotal,
      retryRatePercent,
      afterRetries,
      hasTimerStart,
      workerNodes: hasTimerStart ? workerNodes : 1,
      afterWorkers,
      isEdge,
      totalBillableMessages,
      blocksOf10K,
      estimatedCostUSD: estimatedCost,
      disclaimer: 'Estimate only. Actual pricing depends on your SAP contract.'
    }
  };
}

function validateSimulationInput(req: Request, res: Response, next: Function) {
  const { daily_volume, base_payload_size } = req.body;
  
  if (daily_volume && daily_volume > 10_000_000) {
    return res.status(400).json({ 
      warning: 'daily_volume exceeds 10M. Are you sure? This is very high volume.',
      accepted: true,
      value: daily_volume
    });
  }
  if (base_payload_size && base_payload_size > 10_240) {
    return res.status(400).json({
      warning: 'Payload > 10MB detected. Large payloads significantly increase costs.',
      tip: 'Consider splitting large messages into smaller chunks.',
      accepted: true
    });
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Initialize DB in the background
  initDB();

  // --- API Routes ---

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      dbConnected: isDbConnected,
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        isProduction: process.env.NODE_ENV === 'production'
      }
    });
  });

  // Projects
  app.get("/api/projects", checkDbConnection, async (req, res) => {
    try {
      const result = await db.query("SELECT * FROM projects ORDER BY created_at DESC");
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.post("/api/projects", checkDbConnection, async (req, res) => {
    try {
      const { name, description, budget, target_messages } = req.body;
      const result = await db.query(
        "INSERT INTO projects (name, description, budget, target_messages) VALUES ($1, $2, $3, $4) RETURNING id",
        [name, description, budget || 0, target_messages || 0]
      );
      res.json({ id: result.rows[0].id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.put("/api/projects/:id", checkDbConnection, async (req, res) => {
    try {
      const { name, description, budget, target_messages } = req.body;
      await db.query(
        "UPDATE projects SET name=$1, description=$2, budget=$3, target_messages=$4 WHERE id=$5",
        [name, description, budget, target_messages, req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.delete("/api/projects/:id", checkDbConnection, async (req, res) => {
    try {
      await db.query("DELETE FROM simulations WHERE project_id = $1", [req.params.id]);
      await db.query("DELETE FROM integrations WHERE project_id = $1", [req.params.id]);
      await db.query("DELETE FROM integration_groups WHERE project_id = $1", [req.params.id]);
      await db.query("DELETE FROM projects WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Integration Groups
  app.get("/api/projects/:projectId/groups", checkDbConnection, async (req, res) => {
    try {
      const result = await db.query("SELECT * FROM integration_groups WHERE project_id = $1", [req.params.projectId]);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.post("/api/projects/:projectId/groups", checkDbConnection, async (req, res) => {
    try {
      const { name, description, default_retries } = req.body;
      const result = await db.query(
        "INSERT INTO integration_groups (project_id, name, description, default_retries) VALUES ($1, $2, $3, $4) RETURNING id",
        [req.params.projectId, name, description, default_retries || 0]
      );
      res.json({ id: result.rows[0].id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.delete("/api/groups/:id", checkDbConnection, async (req, res) => {
    try {
      await db.query("UPDATE integrations SET group_id = NULL WHERE group_id = $1", [req.params.id]);
      await db.query("DELETE FROM integration_groups WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Integrations
  app.get("/api/projects/:projectId/integrations", checkDbConnection, async (req, res) => {
    try {
      const result = await db.query("SELECT * FROM integrations WHERE project_id = $1", [req.params.projectId]);
      const parsedIntegrations = result.rows.map((it: any) => ({
        ...it,
        config: typeof it.config === 'string' ? JSON.parse(it.config) : it.config
      }));
      res.json(parsedIntegrations);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.get("/api/integrations/:id", checkDbConnection, async (req, res) => {
    try {
      const result = await db.query("SELECT * FROM integrations WHERE id=$1", [req.params.id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.post("/api/projects/:projectId/integrations", checkDbConnection, async (req, res) => {
    try {
      const { name, type, base_payload_size, daily_volume, retries, failure_rate, config, group_id } = req.body;
      const result = await db.query(`
        INSERT INTO integrations (project_id, name, type, base_payload_size, daily_volume, retries, failure_rate, config, group_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [req.params.projectId, name, type, base_payload_size, daily_volume, retries, failure_rate || 2, JSON.stringify(config), group_id || null]);
      res.json({ id: result.rows[0].id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.put("/api/integrations/:id", checkDbConnection, async (req, res) => {
    try {
      const { name, type, base_payload_size, daily_volume, retries, failure_rate, config, group_id } = req.body;
      await db.query(`
        UPDATE integrations 
        SET name = $1, type = $2, base_payload_size = $3, daily_volume = $4, retries = $5, failure_rate = $6, config = $7, group_id = $8
        WHERE id = $9
      `, [name, type, base_payload_size, daily_volume, retries, failure_rate || 2, JSON.stringify(config), group_id || null, req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.delete("/api/integrations/:id", checkDbConnection, async (req, res) => {
    try {
      await db.query("DELETE FROM simulations WHERE integration_id = $1", [req.params.id]);
      await db.query("DELETE FROM integrations WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Simulations
  app.get("/api/projects/:projectId/simulations", checkDbConnection, async (req, res) => {
    try {
      const result = await db.query("SELECT * FROM simulations WHERE project_id = $1 ORDER BY created_at DESC LIMIT 10", [req.params.projectId]);
      const parsedSimulations = result.rows.map((sim: any) => ({
        ...sim,
        results: typeof sim.results === 'string' ? JSON.parse(sim.results) : sim.results
      }));
      res.json(parsedSimulations);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.get("/api/projects/:projectId/summary", checkDbConnection, async (req, res) => {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(DISTINCT i.id) as integration_count,
          COALESCE(SUM(s.total_messages_monthly), 0) as total_messages,
          COALESCE(SUM(s.estimated_cost_monthly), 0) as total_cost
        FROM integrations i
        LEFT JOIN simulations s ON s.integration_id = i.id 
          AND s.created_at = (
            SELECT MAX(s2.created_at) FROM simulations s2 
            WHERE s2.integration_id = i.id
          )
        WHERE i.project_id = $1
      `, [req.params.projectId]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.post("/api/projects/:projectId/simulate-all", checkDbConnection, async (req, res) => {
    try {
      const intResult = await db.query(
        "SELECT * FROM integrations WHERE project_id=$1", 
        [req.params.projectId]
      );
      const integrations = intResult.rows;
      const results = [];
      
      for (const integration of integrations) {
        const config = typeof integration.config === 'string' 
          ? JSON.parse(integration.config) : integration.config;
        
        const simResult = simulateMessages({
          base_payload_size: integration.base_payload_size,
          daily_volume: integration.daily_volume,
          retries: integration.retries,
          failure_rate: integration.failure_rate,
          config,
        });
        results.push({ integration_id: integration.id, name: integration.name, ...simResult });
      }
      
      const totalMessages = results.reduce((s, r) => s + r.monthlyMessages, 0);
      const totalCost = results.reduce((s, r) => s + r.estimatedCost, 0);
      
      res.json({ results, totalMessages, totalCost });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Simulation Engine
  app.post("/api/simulate", validateSimulationInput, async (req, res) => {
    try {
      const { 
        project_id, 
        integration_id, 
        name, 
        base_payload_size, 
        daily_volume, 
        retries, 
        failure_rate, 
        steps,
        config: extraConfig 
      } = req.body;
      
      const simResult = simulateMessages({
        base_payload_size,
        daily_volume,
        retries,
        failure_rate,
        steps,
        config: extraConfig
      });

      const response = {
        id: integration_id || null,
        name: name || 'Unnamed Simulation',
        ...simResult,
        retries,
        base_payload_size,
        daily_volume
      };

      if (project_id && isDbConnected) {
        await db.query(`
          INSERT INTO simulations (project_id, integration_id, name, total_messages_monthly, estimated_cost_monthly, results)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [project_id, integration_id || null, name || 'Unnamed Simulation', response.monthlyMessages, response.estimatedCost, JSON.stringify(response)]);
      }

      res.json(response);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Simulation error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
