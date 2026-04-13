export interface EtatCapteur {
  id: string | number;
  timestamp: string;
  date_temps?: string | null;
  capteur1: number;
  capteur2: number;
  capteur3: number;
}

export interface PertesTable {
  id: string | number;
  date_temps: string;
  machine: string;
  capteur_from: string;
  capteur_to: string;
  nb_cartes_perdues: number;
  pertes_totale: number;
}

export interface TRG {
  id: string | number;
  timestamp: string;
  date_temps?: string | null;
  cartes_attendues: number;
  cartes_produites: number;
  cartes_bonnes: number;
  trg_pourcentage: number;
}

export interface TRS {
  id: string | number;
  timestamp: string;
  date_temps?: string | null;
  cartes_attendues: number;
  cartes_produites: number;
  cartes_bonnes: number;
  trs_pourcentage: number;
}

export interface Configuration {
  id: number;
  nb_cartes_attendues: number;
  gpio_capteur1: number;
  gpio_capteur2: number;
  gpio_capteur3: number;
  machine_name: string;
  cycle_time_seconds: number;
  loss_threshold: number;
  updated_at: string;
}

export interface Article {
  id: string | number;
  ref_sagem: string;
  designation: string;
  nb_montage: number;
  prix_unitaire: number;
}

export interface SystemNode {
  id: string | number;
  name: string;
  ip_address?: string | null;
  ip?: string | null;
  status: string;
  last_seen: string;
  type?: string | null;
}

export interface PerteParJour {
  jour: string;
  total_cartes: number;
  total_cout: number;
  machine: string;
}

export interface ProductionParJour {
  jour: string;
  machine1: number;
  machine2: number;
  machine3: number;
}

export interface PerteParMachine {
  machine: string;
  nb_incidents: number;
  total_cartes_perdues: number;
  cout_total: number;
}

export interface TodayLossSummary {
  totalCards: number;
  totalCost: number;
}
