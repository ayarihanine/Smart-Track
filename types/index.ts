export interface Product {
  id: string;
  productName: string;
  description?: string;
}

export interface LoadingPlanEntry {
  id: string;
  productId: string;
  machineReference: string;
  tableNumber?: number;
  partReference: string;
  requiredQuantity: number;
  insertionOrder?: number;
  createdAt: string;
}

export interface ComponentInsertion {
  id: string;
  cardId: string;
  loadingPlanId?: string;
  partReference: string;
  insertedQuantity: number;
  machineReference?: string;
  timestamp: string;
  status: 'success' | 'failed';
  operatorId?: string;
}

export type UserRole = 'operator' | 'supervisor' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  badgeId?: string;
  department?: string;
  avatarUrl?: string;
  phone?: string;
  createdAt?: string;
}

export type CardStatus = 'in_progress' | 'completed' | 'pending' | 'on_hold' | 'cancelled';

export interface ElectronicCard {
  id: string;
  cardId: string;
  productId?: string;
  status: CardStatus;
  currentMachine?: string;
  currentMachineStatus?: 'in_progress' | 'completed' | 'blocked';
  currentStage?: string;
  currentLocation?: string;
  stageEnteredAt?: string;
  createdAt: string;
  updatedAt: string;
  productName?: string;
  loadingPlan?: LoadingPlanEntry[];
  componentInsertions?: ComponentInsertion[];
  qualityIssues?: string;
  missingItems?: string;
  progressPercent?: number;
  totalTimeMinutes?: number;
  scanPoints?: number;
}

export interface ScanEvent {
  id: string;
  cardId: string;
  scannedBy: string;
  operatorId?: string;
  location: string;
  stageName?: string;
  timestamp: string;
  notes?: string;
  partReference?: string;
  eventType?: 'location_update' | 'component_scan' | 'machine_entry' | 'machine_exit' | 'quality_alert' | 'blocking_anomaly';
}

export type MaintenanceCommand = 'ping' | 'reboot' | 'fetch_logs';

export type AnalyticsPeriod = 'today' | 'this_week' | 'all_time';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  cardsScanned: number;
  avgTimeMinutes: number;
  trend: 'up' | 'down' | 'stable';
  isCurrentUser?: boolean;
}

export interface AnalyticsData {
  period: AnalyticsPeriod;
  totalCards: number;
  completed: number;
  inProgress: number;
  completionRate: number;
  targetRate: number;
  weeklyGrowth: number;
  activeNow: number;
  sinceDate: string;
  stageBreakdown: {
    stage: string;
    count: number;
    percent: number;
    color: string;
  }[];
  insight: string;
  avgCycleTime?: number;
}

export interface AppSettings {
  webhookUrl: string;
  n8nUrl: string;
  n8nToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  notificationsEnabled: boolean;
  vibrationEnabled: boolean;
  offlineModeEnabled: boolean;
  autoSyncInterval: number;
  theme: 'light' | 'dark' | 'auto';
  language: 'en' | 'fr' | 'ar';
  dashboardWidgets: { id: string; visible: boolean; order: number }[];
  stuckCardThresholdHours?: number;
}

export interface FilterOptions {
  currentMachine?: string;
  currentMachineStatus?: 'in_progress' | 'completed' | 'blocked';
  sortBy: 'recent' | 'oldest' | 'stage_order' | 'id_asc';
  status?: CardStatus;
  stages?: string[];
}

export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface Issue {
  id: string;
  title: string;
  description?: string;
  reportedBy: string;
  assignedTo?: string;
  cardId?: string;
  station?: string;
  status: IssueStatus;
  priority: IssuePriority;
  photoUrl?: string;
  createdAt: string;
  resolvedAt?: string;
  reporterName?: string;
  assigneeName?: string;
}

export interface Task {
  id: string;
  issueId: string;
  title: string;
  assignedTo?: string;
  createdBy: string;
  status: 'pending' | 'completed';
  dueAt?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SensorDataRow {
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

export interface LossRow {
  id: string;
  machineName: string;
  lossCount: number;
  reason?: string;
  lossZone?: string;
  costTnd?: number;
  createdAt: string;
}

export interface DailyReport {
  id: string;
  report_date: string;
  report_name?: string;
  trg_percentage: number;
  trs_percentage: number;
  total_losses: number;
  file_url?: string;
  file_path?: string;
  csv_content?: string;
  row_count?: number;
  file_size_bytes?: number;
  scope?: string;
  source?: string;
  workflow_run_id?: string;
  created_at: string;
}

export interface Alert {
  id: string;
  type: string;
  title: string;
  message: string | null;
  severity: 'low' | 'medium' | 'high';
  is_read: boolean;
  card_id: string | null;
  created_at: string;
}

export * from './production';

export type RootCauseCategory =
  | 'feeder_jam'
  | 'paste_defect'
  | 'conveyor_issue'
  | 'sensor_false_trigger'
  | 'component_shortage'
  | 'placement_error'
  | 'reflow_defect'
  | 'operator_error'
  | 'other';

export interface RootCauseRecord {
  id: string;
  loss_id: string;
  cause_category: RootCauseCategory;
  cause_details: string | null;
  photo_url: string | null;
  operator_id: string;
  created_at: string;
}

export interface InspectedLoss extends LossRow {
  root_cause: RootCauseRecord | null;
}

export const ROOT_CAUSE_LABELS: Record<RootCauseCategory, string> = {
  feeder_jam: 'Feeder Jam',
  paste_defect: 'Paste Defect',
  conveyor_issue: 'Conveyor Issue',
  sensor_false_trigger: 'Sensor False Trigger',
  component_shortage: 'Component Shortage',
  placement_error: 'Placement Error',
  reflow_defect: 'Reflow Defect',
  operator_error: 'Operator Error',
  other: 'Other',
};

export const ROOT_CAUSE_DESCRIPTIONS: Record<RootCauseCategory, string> = {
  feeder_jam: 'Component feeder jammed or misfed',
  paste_defect: 'Solder paste application defect or insufficient paste',
  conveyor_issue: 'Conveyor belt problem or card transport failure',
  sensor_false_trigger: 'Sensor incorrectly detected or missed a card',
  component_shortage: 'Required component not available or out of stock',
  placement_error: 'Pick-and-place misalignment or wrong component',
  reflow_defect: 'Soldering defect after reflow oven',
  operator_error: 'Incorrect handling, missed step, or wrong input by operator',
  other: 'Other cause not listed above',
};
