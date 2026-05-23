import { getSupabaseClient } from './supabase';
import { EtatCapteur } from '@/types';

// ============================================================================
// SENSOR CONFIGURATION
// ============================================================================

export async function getSensorConfiguration() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('configuration')
      .select('*')
      .single();

    if (error) throw error;

    return {
      gpio_capteur1: data.gpio_capteur1,
      gpio_capteur2: data.gpio_capteur2,
      gpio_capteur3: data.gpio_capteur3,
      cycle_time_seconds: data.cycle_time_seconds,
      machine_name: data.machine_name,
      loss_threshold: data.loss_threshold,
      serial_port: data.serial_port,
    };
  } catch (error) {
    console.error('getSensorConfiguration failed', error);
    return null;
  }
}

export function mapGpioToSensorId(gpioPin: number): string {
  const mapping: Record<number, string> = {
    17: 'capteur1',
    26: 'capteur2',
    16: 'capteur3',
  };
  return mapping[gpioPin] || 'unknown';
}

// ============================================================================
// LATEST SENSOR STATE - CORRECTED IMPLEMENTATION
// ============================================================================

/**
 * Get the latest sensor state by aggregating the most recent sensor_events
 * This replaces getLatestEtatCapteur() to use real-time data
 */
export async function getLatestSensorState(): Promise<EtatCapteur> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      id: 0,
      timestamp: new Date().toISOString(),
      date_temps: null,
      capteur1: 0,
      capteur2: 0,
      capteur3: 0,
    };
  }

  try {
    // Get the latest sensor events for each sensor
    const { data: events, error } = await supabase
      .from('sensor_events')
      .select('sensor_id, raw_value, created_at, gpio_pin')
      .order('created_at', { ascending: false })
      .limit(10);  // Get enough to ensure we have latest for each sensor

    if (error) throw error;

    // Aggregate into single state object - take first occurrence of each sensor
    const state: Record<string, number> = {
      capteur1: 0,
      capteur2: 0,
      capteur3: 0,
    };

    const sensorMap = new Map<string, any>();
    const timestamps = new Map<string, string>();

    for (const event of events || []) {
      if (!sensorMap.has(event.sensor_id)) {
        sensorMap.set(event.sensor_id, event);
        timestamps.set(event.sensor_id, event.created_at);
        state[event.sensor_id] = event.raw_value;
      }
    }

    // Use the most recent timestamp from all sensors
    let latestTimestamp = new Date().toISOString();
    let maxTime = 0;
    timestamps.forEach((ts) => {
      const time = new Date(ts).getTime();
      if (time > maxTime) {
        maxTime = time;
        latestTimestamp = ts;
      }
    });

    return {
      id: Date.now(),
      timestamp: latestTimestamp,
      date_temps: latestTimestamp,
      capteur1: state.capteur1,
      capteur2: state.capteur2,
      capteur3: state.capteur3,
    };
  } catch (error) {
    console.error('getLatestSensorState failed', error);
    return {
      id: 0,
      timestamp: new Date().toISOString(),
      date_temps: null,
      capteur1: 0,
      capteur2: 0,
      capteur3: 0,
    };
  }
}

/**
 * Get multiple latest sensor states (for trend analysis)
 * Aggregates sensor_events into time buckets
 */
export async function getLatestSensorStates(limit = 2): Promise<EtatCapteur[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    // Get recent sensor events (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: events, error } = await supabase
      .from('sensor_events')
      .select('*')
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group events by time bucket (e.g., 1 second intervals)
    const buckets = new Map<string, Map<string, number>>();
    const bucketTimestamps = new Map<string, string>();

    for (const event of events || []) {
      // Round timestamp to nearest second
      const bucketTime = new Date(new Date(event.created_at).getTime() - (new Date(event.created_at).getTime() % 1000));
      const bucketKey = bucketTime.toISOString();

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, new Map());
        bucketTimestamps.set(bucketKey, event.created_at);
      }

      const bucket = buckets.get(bucketKey)!;
      if (!bucket.has(event.sensor_id)) {
        bucket.set(event.sensor_id, event.raw_value);
      }
    }

    // Convert buckets to EtatCapteur array
    const states: EtatCapteur[] = [];
    const sortedBuckets = Array.from(buckets.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .slice(0, limit);

    for (const [bucketKey, bucket] of sortedBuckets) {
      states.push({
        id: states.length,
        timestamp: bucketKey,
        date_temps: bucketTimestamps.get(bucketKey) || bucketKey,
        capteur1: bucket.get('capteur1') || 0,
        capteur2: bucket.get('capteur2') || 0,
        capteur3: bucket.get('capteur3') || 0,
      });
    }

    return states;
  } catch (error) {
    console.error('getLatestSensorStates failed', error);
    return [];
  }
}

// ============================================================================
// SENSOR DATA AGGREGATION
// ============================================================================

/**
 * Aggregate recent sensor events into etat_capteur table
 * This should be called periodically (e.g., every 5 seconds) to populate etat_capteur
 */
export async function aggregateSensorDataToEtatCapteur(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const config = await getSensorConfiguration();
    const cycleTime = config?.cycle_time_seconds || 5;

    // Get latest sensor events from the last cycle
    const cycleStartTime = new Date(Date.now() - cycleTime * 1000).toISOString();

    const { data: events, error } = await supabase
      .from('sensor_events')
      .select('*')
      .gte('created_at', cycleStartTime)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Aggregate by sensor - take the latest value for each
    const latest: Record<string, number> = {
      capteur1: 0,
      capteur2: 0,
      capteur3: 0,
    };

    const seen = new Set<string>();
    for (const event of events || []) {
      if (!seen.has(event.sensor_id)) {
        latest[event.sensor_id] = event.raw_value;
        seen.add(event.sensor_id);
      }
    }

    // Insert into etat_capteur
    const { error: insertError } = await supabase
      .from('etat_capteur')
      .insert({
        date_temps: new Date().toISOString(),
        capteur1: latest.capteur1,
        capteur2: latest.capteur2,
        capteur3: latest.capteur3,
      });

    if (insertError) {
      console.error('Failed to insert aggregated sensor data:', insertError);
    }
  } catch (error) {
    console.error('aggregateSensorDataToEtatCapteur failed', error);
  }
}

// ============================================================================
// SENSOR HEALTH MONITORING
// ============================================================================

/**
 * Check if a sensor is responding (has recent data)
 */
export async function checkSensorHealth(sensorId: string, timeoutSeconds = 30): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const timeoutTime = new Date(Date.now() - timeoutSeconds * 1000).toISOString();

    const { data, error } = await supabase
      .from('sensor_events')
      .select('created_at')
      .eq('sensor_id', sensorId)
      .gte('created_at', timeoutTime)
      .limit(1);

    if (error) throw error;

    return (data || []).length > 0;
  } catch (error) {
    console.error(`checkSensorHealth for ${sensorId} failed`, error);
    return false;
  }
}

/**
 * Get all sensor health status
 */
export async function getAllSensorHealth(timeoutSeconds = 30): Promise<Record<string, boolean>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { capteur1: false, capteur2: false, capteur3: false };

  try {
    const health = {
      capteur1: await checkSensorHealth('capteur1', timeoutSeconds),
      capteur2: await checkSensorHealth('capteur2', timeoutSeconds),
      capteur3: await checkSensorHealth('capteur3', timeoutSeconds),
    };

    return health;
  } catch (error) {
    console.error('getAllSensorHealth failed', error);
    return { capteur1: false, capteur2: false, capteur3: false };
  }
}

// ============================================================================
// SENSOR DATA VALIDATION
// ============================================================================

/**
 * Validate sensor data is within expected range
 */
export function validateSensorValue(value: any): boolean {
  const num = Number(value);
  // Binary sensors should be 0 or 1
  return num === 0 || num === 1;
}

/**
 * Validate timestamp is recent
 */
export function validateTimestamp(timestamp: string, maxAgeSeconds = 60): boolean {
  const time = new Date(timestamp).getTime();
  const now = Date.now();
  const ageSeconds = (now - time) / 1000;
  return ageSeconds <= maxAgeSeconds;
}

// ============================================================================
// SENSOR EVENT HISTORY
// ============================================================================

/**
 * Get sensor event history for a specific sensor
 */
export async function getSensorEventHistory(sensorId: string, limitMinutes = 60): Promise<any[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const startTime = new Date(Date.now() - limitMinutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('sensor_events')
      .select('*')
      .eq('sensor_id', sensorId)
      .gte('created_at', startTime)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error(`getSensorEventHistory for ${sensorId} failed`, error);
    return [];
  }
}

/**
 * Get all sensor events within a time range
 */
export async function getSensorEventsInRange(startTime: string, endTime: string): Promise<any[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('sensor_events')
      .select('*')
      .gte('created_at', startTime)
      .lte('created_at', endTime)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('getSensorEventsInRange failed', error);
    return [];
  }
}

// ============================================================================
// SENSOR STATISTICS
// ============================================================================

/**
 * Calculate sensor statistics for a time period
 */
export async function getSensorStatistics(sensorId: string, limitMinutes = 60): Promise<any> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const startTime = new Date(Date.now() - limitMinutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('sensor_events')
      .select('raw_value, created_at')
      .eq('sensor_id', sensorId)
      .gte('created_at', startTime);

    if (error) throw error;

    const events = data || [];
    const values = events.map((e: any) => e.raw_value);

    if (values.length === 0) {
      return {
        sensorId,
        count: 0,
        highCount: 0,
        lowCount: 0,
        highPercentage: 0,
        lowPercentage: 0,
        lastValue: null,
        lastUpdate: null,
      };
    }

    const highCount = values.filter((v: number) => v === 1).length;
    const lowCount = values.filter((v: number) => v === 0).length;

    return {
      sensorId,
      count: values.length,
      highCount,
      lowCount,
      highPercentage: (highCount / values.length) * 100,
      lowPercentage: (lowCount / values.length) * 100,
      lastValue: values[0],
      lastUpdate: events[0]?.created_at,
    };
  } catch (error) {
    console.error(`getSensorStatistics for ${sensorId} failed`, error);
    return null;
  }
}
