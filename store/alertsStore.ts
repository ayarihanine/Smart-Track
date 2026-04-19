import { create } from 'zustand';

type AlertSeverity = 'warning' | 'error';
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
    const thresholdMs = Math.max(0.1, thresholdHours) * 60 * 60 * 1000;
    const now = Date.now();
    const existingAlerts = get().alerts;
    const existingById = new Map(existingAlerts.map(alert => [alert.id, alert]));

    const stuckAlerts = cards
      .filter(card => (
        card.status !== 'completed' &&
        now - new Date(card.updatedAt).getTime() > thresholdMs
      ))
      .map(card => {
        const id = `stuck_card:${card.cardId}`;
        const existing = existingById.get(id);
        const hoursStuck = Math.max(1, Math.floor((now - new Date(card.updatedAt).getTime()) / (60 * 60 * 1000)));

        return {
          id,
          type: 'stuck_card' as const,
          severity: hoursStuck >= Math.max(2, thresholdHours * 2) ? 'error' as const : 'warning' as const,
          message: buildStuckCardMessage(card, hoursStuck),
          cardId: card.cardId,
          createdAt: existing?.createdAt || card.updatedAt || new Date().toISOString(),
          dismissed: existing?.dismissed ?? false,
        };
      });

    const nonStuckAlerts = existingAlerts.filter(alert => alert.type !== 'stuck_card');

    set({
      alerts: [...stuckAlerts, ...nonStuckAlerts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    });
  },
}));
