export interface SensorData {
  id: string;
  nodeId: string;
  sensor_1_status: boolean;
  sensor_2_status: boolean;
  sensor_3_status: boolean;
  sensor_1_counter: number;
  sensor_2_counter: number;
  sensor_3_counter: number;
  timestamp: string;
}

export interface Configuration {
  id: string;
  machine_name: string;
  expected_cards: number;
  cycle_time_seconds: number;
  sensor_1_gpio: number;
  sensor_2_gpio: number;
  sensor_3_gpio: number;
  loss_threshold: number;
  updated_at: string;
}

export type BatchStatus = 'active' | 'completed' | 'cancelled';

export interface ProductionBatch {
  id: string;
  batch_number: string;
  product_id?: string;
  card_reference: string;
  target_quantity: number;
  produced_quantity: number;
  good_quantity: number;
  waste_quantity: number;
  start_time: string;
  end_time?: string;
  status: BatchStatus;
  cost_per_card: number;
  created_by?: string;
  created_at: string;
}

export interface Article {
  id: string;
  reference: string;
  designation: string;
  assembly_count: number;
  unit_price: number;
}

export interface SystemNode {
  id: string;
  name: string;
  type?: string | null;
  status: string;
  location?: string | null;
  ip_address?: string | null;
  mac_address?: string | null;
  cpu_usage?: number | null;
  memory_usage?: number | null;
  temperature?: number | null;
  last_seen: string;
}

export interface LossRow {
  id: string;
  machine_name: string;
  loss_count: number;
  reason?: string;
  loss_zone?: string;
  cost_tnd?: number;
  created_at: string;
}

export interface ProductionPerformanceRow {
  id: string;
  machine_name: string;
  target_count: number;
  actual_count: number;
  good_count: number;
  loss_count: number;
  trg_percentage: number;
  trs_percentage: number;
  date: string;
  timestamp: string;
}

export interface TodayLossSummary {
  totalCards: number;
  totalCost: number;
}
