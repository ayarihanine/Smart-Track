import { create } from 'zustand';
import { getSupabaseClient } from '@/lib/supabase';

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

function buildStuckCardMessage(card: AlertCardSnapshot, minsStuck: number) {
  const stageLabel = card.currentStage || card.currentLocation || 'the current station';
  return `Card ${card.cardId} has been stuck at ${stageLabel} for ${minsStuck} min.`;
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
  let shiftEndHour = 16;
  let breakStartHour: number | undefined = undefined;
  let breakEndHour: number | undefined = undefined;

  if (typeof shiftStartOrConfig === 'number') {
    shiftStartHour = shiftStartOrConfig;
    shiftEndHour = shiftEnd ?? 16;
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

  checkStuckCards: (cards, thresholdMinutes) => {
    const now = Date.now();
    if (now - lastStuckCheck < STUCK_CHECK_INTERVAL_MS) return;
    lastStuckCheck = now;

    const activeCards = cards.filter(card =>
      card.status !== 'completed' &&
      card.status !== 'removed' &&
      card.status !== 'cancelled' &&
      !String(card.cardId ?? '').startsWith('TEST-')
    );

    // Enforce strict 10-minute maximum threshold (replacing hour-based calculations)
    const limitMinutes = Math.min(10, thresholdMinutes ?? 10);
    const thresholdMs = Math.max(1, limitMinutes) * 60 * 1000;
    const existingAlerts = get().alerts;
    const existingById = new Map(existingAlerts.map(alert => [alert.id, alert]));

    const stuckAlerts = activeCards
      .filter((card) => {
        const enteredAt = card.stageEnteredAt || card.updatedAt;
        if (!enteredAt) return false;
        const elapsedMs = now - new Date(enteredAt).getTime();
        return elapsedMs >= thresholdMs;
      })
      .map(card => {
        const stageId = card.currentStage || card.currentLocation || 'unknown';
        const id = `stuck:${card.cardId}:${stageId}`;
        const existing = existingById.get(id);
        const enteredAt = card.stageEnteredAt || card.updatedAt;
        const elapsedMs = now - new Date(enteredAt!).getTime();
        const minsStuck = Math.floor(elapsedMs / (1000 * 60));
        const ratio = elapsedMs / thresholdMs;

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
          message: buildStuckCardMessage(card, Math.max(1, minsStuck)),
          cardId: card.cardId,
          createdAt: existing?.createdAt || card.updatedAt || new Date().toISOString(),
          dismissed: existing?.dismissed ?? false,
        };
      });

    // Write new stuck card alerts to DB so the notification badge and page pick them up
    const newStuck = stuckAlerts.filter(a => !existingById.has(a.id));
    if (newStuck.length > 0) {
      const supabase = getSupabaseClient();
      if (supabase) {
        for (const alert of newStuck) {
          supabase.from('alerts').insert({
            card_id: alert.cardId,
            type: 'STUCK_CARD',
            title: 'Stuck Card',
            message: alert.message,
            severity: alert.severity === 'critical' ? 'high' : 'medium',
            is_read: false,
            created_at: alert.createdAt,
          }).then(({ error }) => {
            if (error && error.code !== '23505') {
              console.error('Failed to write stuck alert to DB:', error);
            }
          });
        }
      }
    }

    const nonStuckAlerts = existingAlerts.filter(alert => !alert.id.startsWith('stuck:'));

    set({
      alerts: [...stuckAlerts, ...nonStuckAlerts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    });
  },
}));
