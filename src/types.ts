export interface Project {
  id: number;
  name: string;
  description: string;
  budget: number;
  target_messages: number;
  created_at: string;
}

export interface IntegrationStep {
  id: string;
  type: 'start' | 'end' | 'splitter' | 'router' | 'api_call' | 'mapping' | 'multicast' | 'subprocess';
  name: string;
  config: any;
}

export interface IntegrationGroup {
  id: number;
  project_id: number;
  name: string;
  description: string;
  default_retries: number;
  created_at: string;
}

export interface Integration {
  id: number;
  project_id: number;
  group_id?: number | null;
  name: string;
  type: string;
  base_payload_size: number;
  daily_volume: number;
  retries: number;
  failure_rate?: number; // percentage (0-100)
  config: {
    steps: IntegrationStep[];
    records_per_split?: number;
    is_edge_integration?: boolean;
    is_sap_standard?: boolean;
    worker_nodes?: number;
    request_reply_count?: number;
    has_timer?: boolean;
    has_internal_adapters?: boolean;
  };
  created_at: string;
}

export interface SimulationResult {
  id?: number;
  name?: string;
  monthlyMessages: number;
  estimatedCost: number;
  retries: number;
  base_payload_size: number;
  daily_volume: number;
  breakdown: {
    dailyMessages: number;
    payloadFactor: number;
    multiplier: number;
    extraCalls: number;
    retryVolume?: number;
    failureRate?: number;
    steps?: IntegrationStep[];
    // New breakdown fields
    baseExecutions: number;
    splitterFactor: number;
    retryFactor: number;
    requestReplyFactor: number;
    edgeFactor: number;
    totalBillableMessages: number;
    blocksOf10K: number;
  };
}

export interface SimulationHistoryItem {
  id: string;
  name: string;
  timestamp: string;
  result: SimulationResult;
  integration: Partial<Integration>;
}

export interface Recommendation {
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
  savings: string;
}
