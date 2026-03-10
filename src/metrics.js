const config = require('./config');

// Metrics stored in memory
const requests = {};
let totalRequests = 0;
const methodCounts = {
  GET: 0,
  POST: 0,
  PUT: 0,
  DELETE: 0,
  OTHER: 0,
};

// (greetingChanged metric removed)

// Middleware to track requests
function requestTracker(req, res, next) {
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
  next();
}

// Helper to construct Grafana/OpenTelemetry-style metric
function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  attributes = { ...attributes, source: config.source };

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

  fetch(`${config.endpointUrl}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${config.accountId}:${config.apiKey}`, 'Content-Type': 'application/json' },
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

// Periodically send metrics (per-minute to represent requests/minute)
setInterval(() => {
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

  // Reset counters after pushing so the next interval reports per-minute deltas
  Object.keys(requests).forEach((k) => (requests[k] = 0));
  totalRequests = 0;
  Object.keys(methodCounts).forEach((k) => (methodCounts[k] = 0));

  sendMetricToGrafana(metrics);
}, 60000);

module.exports = { requestTracker, middleware: requestTracker };
