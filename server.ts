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
    const { project_id, integration_id, name, base_payload_size, daily_volume, retries, failure_rate, steps } = req.body;
    
    // SAP CPI Pricing Rules
    const MESSAGE_SIZE_LIMIT = 250; // KB
    const DAYS_IN_MONTH = 30;

    let dailyMessages = 0;
    
    // 1. Base message (payload size factor)
    const payloadFactor = Math.ceil(base_payload_size / MESSAGE_SIZE_LIMIT);
    
    // 2. Process steps
    let multiplier = 1;
    let extraCalls = 0;

    steps.forEach((step: any) => {
      if (step.type === 'splitter') {
        multiplier *= (step.config.splitCount || 1) * (step.config.branchCount || 1);
      } else if (step.type === 'api_call') {
        extraCalls += 1;
      } else if (step.type === 'multicast') {
        multiplier *= (step.config.branchCount || 1);
      }
    });

    const baseVolume = daily_volume * payloadFactor * multiplier * (1 + extraCalls);
    
    // 3. Granular Retry Logic
    // failure_rate is percentage (0-100)
    const p = (failure_rate || 5) / 100;
    const n = retries || 0;
    
    // Total messages = 1 + p + p^2 + ... + p^n
    // Sum of geometric series: (1 - p^(n+1)) / (1 - p)
    let retryMultiplier = 1;
    if (p > 0) {
      retryMultiplier = (1 - Math.pow(p, n + 1)) / (1 - p);
    }
    
    dailyMessages = baseVolume * retryMultiplier;
    const retryVolume = dailyMessages - baseVolume;

    const monthlyMessages = Math.round(dailyMessages * DAYS_IN_MONTH);
    
    // Cost Calculation (Tiered)
    // Base: $4000 for first 10,000
    // Next 90,000: $0.10 each
    // Above 100,000: $0.05 each
    let cost = 0;
    if (monthlyMessages <= 10000) {
      cost = 4000;
    } else if (monthlyMessages <= 100000) {
      cost = 4000 + (monthlyMessages - 10000) * 0.10;
    } else {
      cost = 4000 + (90000 * 0.10) + (monthlyMessages - 100000) * 0.05;
    }

    const response = {
      monthlyMessages,
      estimatedCost: cost,
      retries,
      base_payload_size,
      daily_volume,
      breakdown: {
        dailyMessages,
        payloadFactor,
        multiplier,
        extraCalls,
        retryVolume,
        failureRate: failure_rate || 5,
        steps: steps || []
      }
    };

    if (project_id) {
      db.prepare(`
        INSERT INTO simulations (project_id, integration_id, name, total_messages_monthly, estimated_cost_monthly, results)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(project_id, integration_id || null, name || 'Unnamed Simulation', monthlyMessages, cost, JSON.stringify(response));
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
