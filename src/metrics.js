const config = require('./config');
const os = require('os');

// HTTP request metrics
const requests = {};
let totalRequests = 0;
const methodCounts = {
  GET: 0,
  POST: 0,
  PUT: 0,
  DELETE: 0,
  OTHER: 0,
};

// Auth metrics
let authSuccessCount = 0;
let authFailCount = 0;

// Active users gauge (not reset between intervals)
let activeUsers = 0;

// Pizza metrics
let pizzaSoldCount = 0;
let pizzaFailureCount = 0;
let pizzaRevenue = 0;

// Latency accumulators
let endpointLatencySum = 0;
let endpointLatencyCount = 0;
let pizzaLatencySum = 0;
let pizzaLatencyCount = 0;

// Middleware to track requests and endpoint latency
function requestTracker(req, res, next) {
  const start = Date.now();
  const endpoint = `[${req.method}] ${req.path}`;
  requests[endpoint] = (requests[endpoint] || 0) + 1;
  // Track totals and method-specific counts
  totalRequests++;
  const method = (req.method || 'OTHER').toUpperCase();
  if (methodCounts[method] !== undefined) {
    methodCounts[method]++;
  } else {
    methodCounts.OTHER++;
  }
  res.on('finish', () => {
    endpointLatencySum += Date.now() - start;
    endpointLatencyCount++;
  });
  next();
}

// Record an auth attempt result
function authAttempt(success) {
  if (success) {
    authSuccessCount++;
  } else {
    authFailCount++;
  }
}

// Adjust the active user count (delta: +1 for login/register, -1 for logout)
function activeUserChange(delta) {
  activeUsers = Math.max(0, activeUsers + delta);
}

// Record a pizza purchase (success flag, factory latency in ms, revenue in dollars)
function pizzaPurchase(success, latency, revenue) {
  if (success) {
    pizzaSoldCount++;
    pizzaRevenue += revenue;
  } else {
    pizzaFailureCount++;
  }
  pizzaLatencySum += latency;
  pizzaLatencyCount++;
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

// Helper to construct Grafana/OpenTelemetry-style metric
function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  attributes = { ...attributes, source: config.metrics?.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({ key: key, value: { stringValue: attributes[key] } });
  });

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

// Send metrics to Grafana (or any configured endpoint)
function sendMetricToGrafana(metrics) {
  // If no endpoint configured, skip sending (useful for tests)
  const endpointUrl = config.metrics?.endpointUrl || config.endpointUrl;
  const accountId = config.metrics?.accountId || config.accountId;
  const apiKey = config.metrics?.apiKey || config.apiKey;
  if (!endpointUrl || !accountId || !apiKey) {
    return;
  }
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(`${endpointUrl}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${accountId}:${apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

let metricsInterval = null;

// Periodically send metrics (per-minute to represent requests/minute)
// Only start the interval when an endpoint is configured and not running under tests.
const endpointUrl = config.metrics?.endpointUrl || config.endpointUrl;
if (process.env.NODE_ENV !== 'test' && endpointUrl) {
  metricsInterval = setInterval(() => {
    const metrics = [];

    // Per-endpoint counts (kept for compatibility)
    Object.keys(requests).forEach((endpoint) => {
        metrics.push(createMetric('requests', requests[endpoint], '1', 'sum', 'asInt', { endpoint }));
    });

    // Total requests in the interval
    metrics.push(createMetric('totalRequests', totalRequests, '1', 'sum', 'asInt', {}));

    // Requests by method (GET, POST, PUT, DELETE)
    ['GET', 'POST', 'PUT', 'DELETE'].forEach((m) => {
        metrics.push(createMetric('requests', methodCounts[m] || 0, '1', 'sum', 'asInt', { method: m }));
    });

    // Also include other methods if present
    if (methodCounts.OTHER > 0) {
        metrics.push(createMetric('requests', methodCounts.OTHER, '1', 'sum', 'asInt', { method: 'OTHER' }));
    }

    // Auth metrics
    metrics.push(createMetric('authAttempts', authSuccessCount, '1', 'sum', 'asInt', { result: 'success' }));
    metrics.push(createMetric('authAttempts', authFailCount, '1', 'sum', 'asInt', { result: 'failure' }));

    // Active users (gauge - current value, not a counter)
    metrics.push(createMetric('activeUsers', activeUsers, '1', 'gauge', 'asInt', {}));

    // Pizza metrics
    metrics.push(createMetric('pizzaSold', pizzaSoldCount, '1', 'sum', 'asInt', {}));
    metrics.push(createMetric('pizzaFailures', pizzaFailureCount, '1', 'sum', 'asInt', {}));
    metrics.push(createMetric('pizzaRevenue', pizzaRevenue, 'USD', 'sum', 'asDouble', {}));

    // Latency metrics (average over the interval)
    const avgEndpointLatency = endpointLatencyCount > 0 ? endpointLatencySum / endpointLatencyCount : 0;
    const avgPizzaLatency = pizzaLatencyCount > 0 ? pizzaLatencySum / pizzaLatencyCount : 0;
    metrics.push(createMetric('serviceLatency', avgEndpointLatency, 'ms', 'gauge', 'asDouble', {}));
    metrics.push(createMetric('pizzaCreationLatency', avgPizzaLatency, 'ms', 'gauge', 'asDouble', {}));

    // CPU and memory usage metrics
    const cpuUsage = getCpuUsagePercentage();
    const memoryUsage = getMemoryUsagePercentage();
    metrics.push(createMetric('cpuUsage', cpuUsage, '%', 'gauge', 'asDouble', {}));
    metrics.push(createMetric('memoryUsage', memoryUsage, '%', 'gauge', 'asDouble', {}));

    // Reset counters after pushing so the next interval reports per-minute deltas
    Object.keys(requests).forEach((k) => (requests[k] = 0));
    totalRequests = 0;
    Object.keys(methodCounts).forEach((k) => (methodCounts[k] = 0));
    authSuccessCount = 0;
    authFailCount = 0;
    pizzaSoldCount = 0;
    pizzaFailureCount = 0;
    pizzaRevenue = 0;
    endpointLatencySum = 0;
    endpointLatencyCount = 0;
    pizzaLatencySum = 0;
    pizzaLatencyCount = 0;
    // Note: activeUsers is a gauge and is NOT reset

    sendMetricToGrafana(metrics);
  }, 60000);
}

function stopMetrics() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
}

module.exports = { requestTracker, middleware: requestTracker, stopMetrics, authAttempt, activeUserChange, pizzaPurchase };
