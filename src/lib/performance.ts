// Performance monitoring and metrics collection

interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Metric[] = [];
  private enabled: boolean;
  private reportInterval: number;
  private maxMetrics: number;

  private constructor() {
    this.enabled = process.env.NODE_ENV === 'production';
    this.reportInterval = 5 * 60 * 1000; // 5 minutes
    this.maxMetrics = 1000;
    this.setupReporting();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public track(metric: Omit<Metric, 'timestamp'>) {
    if (!this.enabled) return;

    this.metrics.push({
      ...metric,
      timestamp: Date.now(),
    });

    // Prevent memory leaks by limiting the number of stored metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  public measure<T>(name: string, fn: () => Promise<T>, tags: Record<string, string> = {}): Promise<T> {
    const start = performance.now();
    return fn()
      .then((result) => {
        const duration = performance.now() - start;
        this.track({
          name,
          value: duration,
          tags: { ...tags, success: 'true' },
        });
        return result;
      })
      .catch((error) => {
        const duration = performance.now() - start;
        this.track({
          name,
          value: duration,
          tags: { ...tags, success: 'false', error: error.message },
        });
        throw error;
      });
  }

  public getMetrics() {
    return [...this.metrics];
  }

  public clear() {
    this.metrics = [];
  }

  private setupReporting() {
    if (typeof window === 'undefined') {
      // Server-side reporting
      setInterval(() => this.reportMetrics(), this.reportInterval);
    } else {
      // Client-side reporting
      window.addEventListener('beforeunload', () => this.reportMetrics());
    }
  }

  private async reportMetrics() {
    if (this.metrics.length === 0) return;

    const metricsToReport = [...this.metrics];
    this.clear();

    try {
      // In a real app, you'd send these metrics to a monitoring service
      if (process.env.NODE_ENV === 'development') {
        console.groupCollapsed('[Performance Metrics]');
        console.table(metricsToReport);
        console.groupEnd();
      }

      // Example: Send to an analytics endpoint
      // await fetch('/api/analytics/metrics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ metrics: metricsToReport }),
      // });
    } catch (error) {
      console.error('Failed to report metrics:', error);
    }
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

// Helper function to measure function execution time
export async function measure<T>(
  name: string,
  fn: () => Promise<T>,
  tags: Record<string, string> = {}
): Promise<T> {
  return performanceMonitor.measure(name, fn, tags);
}

// Web Vitals monitoring for Next.js
export function reportWebVitals(metric: any) {
  performanceMonitor.track({
    name: metric.name,
    value: metric.value,
    tags: {
      type: 'web-vital',
      id: metric.id,
      label: metric.label || 'web-vital',
      navigationType: metric.navigationType || '',
    },
  });
}
