import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("sap_cpi_costs.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    budget REAL DEFAULT 0,
    target_messages INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS integration_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    default_retries INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    group_id INTEGER,
    name TEXT NOT NULL,
    type TEXT,
    base_payload_size INTEGER DEFAULT 10, -- in KB
    daily_volume INTEGER DEFAULT 1000,
    retries INTEGER DEFAULT 0,
    failure_rate REAL DEFAULT 5, -- percentage (0-100)
    config JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(group_id) REFERENCES integration_groups(id)
  );

  CREATE TABLE IF NOT EXISTS simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    integration_id INTEGER,
    name TEXT,
    total_messages_monthly INTEGER,
    estimated_cost_monthly REAL,
    results JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(integration_id) REFERENCES integrations(id)
  );
`);

// Migration for existing databases
try { db.exec("ALTER TABLE projects ADD COLUMN budget REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN target_messages INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE integrations ADD COLUMN group_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE integration_groups ADD COLUMN default_retries INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE simulations ADD COLUMN project_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE simulations ADD COLUMN name TEXT"); } catch (e) {}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // --- API Routes ---

  // Projects
  app.get("/api/projects", (req, res) => {
    const projects = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
    res.json(projects);
  });

  app.post("/api/projects", (req, res) => {
    const { name, description, budget, target_messages } = req.body;
    const result = db.prepare("INSERT INTO projects (name, description, budget, target_messages) VALUES (?, ?, ?, ?)").run(name, description, budget || 0, target_messages || 0);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/projects/:id", (req, res) => {
    db.prepare("DELETE FROM simulations WHERE project_id = ?").run(req.params.id);
    db.prepare("DELETE FROM integrations WHERE project_id = ?").run(req.params.id);
    db.prepare("DELETE FROM integration_groups WHERE project_id = ?").run(req.params.id);
    db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Integration Groups
  app.get("/api/projects/:projectId/groups", (req, res) => {
    const groups = db.prepare("SELECT * FROM integration_groups WHERE project_id = ?").all(req.params.projectId);
    res.json(groups);
  });

  app.post("/api/projects/:projectId/groups", (req, res) => {
    const { name, description, default_retries } = req.body;
    const result = db.prepare("INSERT INTO integration_groups (project_id, name, description, default_retries) VALUES (?, ?, ?, ?)").run(req.params.projectId, name, description, default_retries || 0);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/groups/:id", (req, res) => {
    db.prepare("UPDATE integrations SET group_id = NULL WHERE group_id = ?").run(req.params.id);
    db.prepare("DELETE FROM integration_groups WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Integrations
  app.get("/api/projects/:projectId/integrations", (req, res) => {
    const integrations = db.prepare("SELECT * FROM integrations WHERE project_id = ?").all(req.params.projectId);
    const parsedIntegrations = integrations.map((it: any) => ({
      ...it,
      config: typeof it.config === 'string' ? JSON.parse(it.config) : it.config
    }));
    res.json(parsedIntegrations);
  });

  app.post("/api/projects/:projectId/integrations", (req, res) => {
    const { name, type, base_payload_size, daily_volume, retries, failure_rate, config, group_id } = req.body;
    const result = db.prepare(`
      INSERT INTO integrations (project_id, name, type, base_payload_size, daily_volume, retries, failure_rate, config, group_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.projectId, name, type, base_payload_size, daily_volume, retries, failure_rate || 5, JSON.stringify(config), group_id || null);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/integrations/:id", (req, res) => {
    const { name, type, base_payload_size, daily_volume, retries, failure_rate, config, group_id } = req.body;
    db.prepare(`
      UPDATE integrations 
      SET name = ?, type = ?, base_payload_size = ?, daily_volume = ?, retries = ?, failure_rate = ?, config = ?, group_id = ?
      WHERE id = ?
    `).run(name, type, base_payload_size, daily_volume, retries, failure_rate || 5, JSON.stringify(config), group_id || null, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/integrations/:id", (req, res) => {
    db.prepare("DELETE FROM simulations WHERE integration_id = ?").run(req.params.id);
    db.prepare("DELETE FROM integrations WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Simulations
  app.get("/api/projects/:projectId/simulations", (req, res) => {
    const simulations = db.prepare("SELECT * FROM simulations WHERE project_id = ? ORDER BY created_at DESC LIMIT 10").all(req.params.projectId);
    const parsedSimulations = simulations.map((sim: any) => ({
      ...sim,
      results: typeof sim.results === 'string' ? JSON.parse(sim.results) : sim.results
    }));
    res.json(parsedSimulations);
  });

  // Simulation Engine
  app.post("/api/simulate", (req, res) => {
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
    
    // SAP CPI Pricing Rules
    const MESSAGE_SIZE_LIMIT = 250; // KB
    const DAYS_IN_MONTH = 30;

    // 1. Base executions
    const baseExecutions = daily_volume * DAYS_IN_MONTH;
    
    // 2. Payload size factor
    const payloadFactor = Math.ceil(base_payload_size / MESSAGE_SIZE_LIMIT);
    
    // 3. Process steps multipliers
    let splitterFactor = 1;
    let requestReplyFactor = 1; // 1 (base) + N (request-replies)
    
    // We iterate through steps to find splitters, multicasts, and request-replies
    // Note: In the new UI, we might pass these as explicit counts or as steps
    const recordsPerSplit = extraConfig?.records_per_split || 1;
    const requestReplyCount = extraConfig?.request_reply_count || 0;
    const isEdge = extraConfig?.is_edge_integration || false;
    const isStandard = extraConfig?.is_sap_standard || false;

    if (steps && Array.isArray(steps)) {
      steps.forEach((step: any) => {
        if (step.type === 'splitter') {
          // Each split item counts as a message
          const splitCount = step.config?.splitCount || recordsPerSplit;
          splitterFactor *= splitCount;
        } else if (step.type === 'multicast') {
          // Each branch counts as a message
          const branchCount = step.config?.branchCount || 1;
          splitterFactor *= branchCount;
        } else if (step.type === 'api_call' || step.type === 'request_reply') {
          // Request-Reply counts as an extra message per call
          requestReplyFactor += 1;
        }
      });
    } else {
      // Fallback if steps are not provided but counts are
      requestReplyFactor = 1 + requestReplyCount;
      // If no steps, we assume splitterFactor is 1 unless recordsPerSplit is > 1
      if (recordsPerSplit > 1) splitterFactor = recordsPerSplit;
    }

    // 4. Retry Logic
    const p = (failure_rate || 2) / 100; // Default 2% as requested
    const n = retries || 0;
    let retryMultiplier = 1;
    if (p > 0) {
      retryMultiplier = (1 - Math.pow(p, n + 1)) / (1 - p);
    }
    
    // 5. Edge Factor
    const edgeFactor = isEdge ? 0.5 : 1.0;

    // 6. Total Billable Messages
    // Formula: (Base * SplitterFactor * RequestReplyFactor) * PayloadFactor * RetryFactor * EdgeFactor
    // Actually, Request-Reply is often additive to the base flow, but let's stick to a multiplicative model for simplicity if it's per execution
    // SAP billing: "Each message processed... including those generated by splitters, multicasts, and request-reply steps."
    
    const totalBillableMessages = Math.round(
      baseExecutions * splitterFactor * requestReplyFactor * payloadFactor * retryMultiplier * edgeFactor
    );

    // 7. Cost Calculation (Tiered)
    // Blocks of 10,000
    const blocksOf10K = Math.ceil(totalBillableMessages / 10000);
    
    let cost = 0;
    if (totalBillableMessages <= 10000) {
      cost = 4000; // Base fee includes first 10k
    } else if (totalBillableMessages <= 100000) {
      cost = 4000 + (totalBillableMessages - 10000) * 0.10;
    } else {
      cost = 4000 + (90000 * 0.10) + (totalBillableMessages - 100000) * 0.05;
    }

    // If it's SAP Standard Content, some customers have it free, but usually it's just "standard"
    // We'll keep the cost as is but flag it in the UI.

    const response = {
      id: integration_id || null,
      name: name || 'Unnamed Simulation',
      monthlyMessages: totalBillableMessages,
      estimatedCost: cost,
      retries,
      base_payload_size,
      daily_volume,
      breakdown: {
        baseExecutions,
        splitterFactor,
        payloadFactor,
        retryFactor: retryMultiplier,
        requestReplyFactor,
        edgeFactor,
        totalBillableMessages,
        blocksOf10K,
        failureRate: failure_rate || 2,
        steps: steps || []
      }
    };

    if (project_id) {
      db.prepare(`
        INSERT INTO simulations (project_id, integration_id, name, total_messages_monthly, estimated_cost_monthly, results)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(project_id, integration_id || null, name || 'Unnamed Simulation', totalBillableMessages, cost, JSON.stringify(response));
    }

    res.json(response);
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
