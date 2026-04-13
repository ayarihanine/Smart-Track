// ============================================================================
// CORE DOMAIN TYPES
// ============================================================================

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
  progressPercent: number;
  totalTimeMinutes?: number;
  scanPoints: number;
  operatorId?: string;
  createdAt: string;
  updatedAt: string;
  currentStage?: string;
  currentLocation?: string;
  loadingPlan?: LoadingPlanEntry[];
  componentInsertions?: ComponentInsertion[];
  qualityIssues?: string;
  missingItems?: string;
}

export interface ScanEvent {
  id: string;
  cardId: string;
  scannedBy: string;
  location: string;
  stage: string;
  timestamp: string;
  rfidTag?: string;
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
  supabaseUrl: string;
  supabaseAnonKey: string;
  notificationsEnabled: boolean;
  vibrationEnabled: boolean;
  offlineModeEnabled: boolean;
  autoSyncInterval: number;
  theme: 'light' | 'dark' | 'auto';
  language: 'en' | 'fr' | 'ar';
  dashboardWidgets: { id: string; visible: boolean; order: number }[];
}

export interface FilterOptions {
  currentMachine?: string;
  currentMachineStatus?: 'in_progress' | 'completed' | 'blocked';
  sortBy: 'recent' | 'stage_order' | 'id_asc';
  status?: CardStatus;
}

// ============================================================================
// COLLABORATION & TASK MANAGEMENT
// ============================================================================

export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface Issue {
  id: string;
  title: string;
  description?: string;
  reportedBy: string; // profile id
  assignedTo?: string; // profile id
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
export * from './production';
