// Global teardown runs once after all tests
const metrics = require('./src/metrics');

module.exports = async () => {
  // Stop the metrics interval if it was started
  metrics.stopMetrics();
};
