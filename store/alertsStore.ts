import { create } from 'zustand';

type AlertSeverity = 'warning' | 'error' | 'medium' | 'high' | 'critical';
type AlertType = 'stuck_card' | 'quality_alert' | 'blocking_anomaly' | 'system';

export interface AppAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  cardId?: string;
  createdAt: string;
  dismissed: boolean;
}

interface AlertCardSnapshot {
  cardId: string;
  updatedAt: string;
  stageEnteredAt?: string;
  status: string;
  currentStage?: string;
  currentLocation?: string;
}

interface AlertsState {
  alerts: AppAlert[];
  addAlert: (alert: Omit<AppAlert, 'createdAt' | 'dismissed'> & Partial<Pick<AppAlert, 'createdAt' | 'dismissed'>>) => void;
  dismissAlert: (id: string) => void;
  clearAll: () => void;
  checkStuckCards: (cards: AlertCardSnapshot[], thresholdHours: number) => void;
}

function buildStuckCardMessage(card: AlertCardSnapshot, hoursStuck: number) {
  const stageLabel = card.currentStage || card.currentLocation || 'the current station';
  return `Card ${card.cardId} has been stuck at ${stageLabel} for ${hoursStuck}h.`;
}

export function getActiveElapsedMs(
  stageEnteredAt: string,
  shiftStartOrConfig: number | {
    weekdaysOnly: boolean;
    holidays?: string[];
    shiftStartHour: number;
    shiftEndHour: number;
    breakStartHour?: number;
    breakEndHour?: number;
  },
  shiftEnd?: number,
  workingDays: number[] = [1, 2, 3, 4, 5] // 1=Mon, 5=Fri
): number {
  const start = new Date(stageEnteredAt);
  const now = new Date();
  if (isNaN(start.getTime()) || start >= now) return 0;

  let weekdaysOnly = true;
  let holidays: string[] = [];
  let shiftStartHour = 8;
  let shiftEndHour = 17;
  let breakStartHour: number | undefined = undefined;
  let breakEndHour: number | undefined = undefined;

  if (typeof shiftStartOrConfig === 'number') {
    shiftStartHour = shiftStartOrConfig;
    shiftEndHour = shiftEnd ?? 17;
    weekdaysOnly = true;
  } else if (shiftStartOrConfig && typeof shiftStartOrConfig === 'object') {
    shiftStartHour = shiftStartOrConfig.shiftStartHour;
    shiftEndHour = shiftStartOrConfig.shiftEndHour;
    weekdaysOnly = shiftStartOrConfig.weekdaysOnly;
    holidays = shiftStartOrConfig.holidays ?? [];
    breakStartHour = shiftStartOrConfig.breakStartHour;
    breakEndHour = shiftStartOrConfig.breakEndHour;
  }

  let totalActiveMs = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0); // Start at midnight of the start day

  while (cursor <= now) {
    const dayOfWeek = cursor.getDay(); // 0 = Sun, 6 = Sat
    const dateStr = cursor.toISOString().split('T')[0];

    // Check if we should skip this day
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.includes(dateStr);

    if ((weekdaysOnly && isWeekend) || isHoliday) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    // Today's interval boundaries in the scope of [start, now]
    const dayStartOfToday = new Date(cursor);
    dayStartOfToday.setHours(0, 0, 0, 0);
    const dayEndOfToday = new Date(cursor);
    dayEndOfToday.setHours(23, 59, 59, 999);

    const todayIntervalStart = Math.max(start.getTime(), dayStartOfToday.getTime());
    const todayIntervalEnd = Math.min(now.getTime(), dayEndOfToday.getTime());

    if (todayIntervalEnd > todayIntervalStart) {
      // Shift boundaries for today
      const shiftStart = new Date(cursor);
      shiftStart.setHours(shiftStartHour, 0, 0, 0);
      const shiftEnd = new Date(cursor);
      shiftEnd.setHours(shiftEndHour, 0, 0, 0);

      // Overlap with shift window
      const shiftOverlapStart = Math.max(todayIntervalStart, shiftStart.getTime());
      const shiftOverlapEnd = Math.min(todayIntervalEnd, shiftEnd.getTime());
      
      let shiftOverlapMs = Math.max(0, shiftOverlapEnd - shiftOverlapStart);

      // Overlap with break window
      if (breakStartHour !== undefined && breakEndHour !== undefined) {
        const breakStart = new Date(cursor);
        breakStart.setHours(breakStartHour, 0, 0, 0);
        const breakEnd = new Date(cursor);
        breakEnd.setHours(breakEndHour, 0, 0, 0);

        const breakOverlapStart = Math.max(todayIntervalStart, breakStart.getTime());
        const breakOverlapEnd = Math.min(todayIntervalEnd, breakEnd.getTime());

        const breakOverlapMs = Math.max(0, breakOverlapEnd - breakOverlapStart);
        shiftOverlapMs = Math.max(0, shiftOverlapMs - breakOverlapMs);
      }

      totalActiveMs += shiftOverlapMs;
    }

    // Increment day safely
    cursor.setDate(cursor.getDate() + 1);
  }

  return totalActiveMs;
}

let lastStuckCheck = 0;
const STUCK_CHECK_INTERVAL_MS = 30_000;

export const useAlertsStore = create<AlertsState>((set, get) => ({
  alerts: [],

  addAlert: (alert) => {
    set(state => {
      const existing = state.alerts.find(item => item.id === alert.id);
      const nextAlert: AppAlert = {
        createdAt: alert.createdAt || new Date().toISOString(),
        dismissed: alert.dismissed ?? false,
        ...alert,
      };

      if (!existing) {
        return {
          alerts: [nextAlert, ...state.alerts].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
        };
      }

      return {
        alerts: state.alerts
          .map(item => (
            item.id === alert.id
              ? {
                ...item,
                ...nextAlert,
                createdAt: item.createdAt,
                dismissed: alert.dismissed ?? item.dismissed,
              }
              : item
          ))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      };
    });
  },

  dismissAlert: (id) => {
    set(state => ({
      alerts: state.alerts.map(alert => (
        alert.id === id ? { ...alert, dismissed: true } : alert
      )),
    }));
  },

  clearAll: () => {
    set(state => ({
      alerts: state.alerts.map(alert => ({ ...alert, dismissed: true })),
    }));
  },

  checkStuckCards: (cards, thresholdHours) => {
    const now = Date.now();
    if (now - lastStuckCheck < STUCK_CHECK_INTERVAL_MS) return;
    lastStuckCheck = now;

    const thresholdMs = Math.max(0.1, thresholdHours) * 60 * 60 * 1000;
    const existingAlerts = get().alerts;
    const existingById = new Map(existingAlerts.map(alert => [alert.id, alert]));

    const stuckAlerts = cards
      .filter(card => {
        const timeInactive = getActiveElapsedMs(
          card.stageEnteredAt || card.updatedAt,
          8,
          17
        );
        return card.status !== 'completed' && timeInactive >= thresholdMs && timeInactive < 7 * 24 * 60 * 60 * 1000;
      })
      .map(card => {
        const stageId = card.currentStage || card.currentLocation || 'unknown';
        const id = `stuck:${card.cardId}:${stageId}`;
        const existing = existingById.get(id);
        const timeInactive = getActiveElapsedMs(
          card.stageEnteredAt || card.updatedAt,
          8,
          17
        );
        const hoursStuck = timeInactive / (1000 * 60 * 60);
        const ratio = timeInactive / thresholdMs;

        let severity: AlertSeverity = 'medium';
        if (ratio >= 2.0) {
          severity = 'critical';
        } else if (ratio >= 1.5) {
          severity = 'high';
        }

        return {
          id,
          type: 'stuck_card' as const,
          severity,
          message: buildStuckCardMessage(card, Math.max(1, Math.floor(hoursStuck))),
          cardId: card.cardId,
          createdAt: existing?.createdAt || card.updatedAt || new Date().toISOString(),
          dismissed: existing?.dismissed ?? false,
        };
      });

    const nonStuckAlerts = existingAlerts.filter(alert => !alert.id.startsWith('stuck:'));

    set({
      alerts: [...stuckAlerts, ...nonStuckAlerts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    });
  },
}));
