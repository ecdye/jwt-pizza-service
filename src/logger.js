const crypto = require('crypto');
const config = require('./config.js');

class Logger {
  httpLogger = (req, res, next) => {
    req.traceId = crypto.randomUUID();
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        traceId: req.traceId,
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
      };
      const level = this._statusToLogLevel(res.statusCode);
      this.log('http', level, logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  dbLogger(traceId, query) {
    this.log('database', 'info', { traceId, query: this._sanitize(query) });
  }

  factoryLogger(traceId, orderInfo) {
    this.log('factory', 'info', { traceId, ...orderInfo });
  }

  unhandledErrorLogger(err) {
    this.log('unhandledError', 'error', {
      traceId: err.traceId,
      message: err.message,
      stack: err.stack,
    });
  }

  log(type, level, logData) {
    const labels = { component: config.logging.source, level, type };
    const values = [
      [
        `${Date.now() * 1000000}`,
        JSON.stringify(this._sanitize(logData)),
      ],
    ];
    const logEvent = { streams: [{ stream: labels, values }] };
    this._sendLogToGrafana(logEvent);
  }

  _statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  _sanitize(logData) {
    if (typeof logData === 'string') {
      // Try to parse JSON strings so we can sanitize their keys
      try {
        const parsed = JSON.parse(logData);
        if (typeof parsed === 'object' && parsed !== null) {
          return JSON.stringify(this._sanitize(parsed));
        }
      } catch {
        // Not JSON, apply regex sanitization
      }
      return logData.replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, '***');
    }
    if (typeof logData !== 'object' || logData === null) {
      return logData;
    }
    if (Array.isArray(logData)) {
      return logData.map((item) => this._sanitize(item));
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(logData)) {
      if (/^(password|token|authorization|apiKey|api_key|secret)$/i.test(key)) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = this._sanitize(value);
      }
    }
    return sanitized;
  }

  _sendLogToGrafana(event) {
    const endpointUrl = config.logging?.endpointUrl;
    const accountId = config.logging?.accountId;
    const apiKey = config.logging?.apiKey;
    if (!endpointUrl || !accountId || !apiKey) {
      return;
    }
    try {
      const body = JSON.stringify(event);
      const res = fetch(endpointUrl, {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accountId}:${apiKey}`,
        },
      });
      if (res && typeof res.then === 'function') {
        res.then((r) => {
          if (!r.ok) console.log('Failed to send log to Grafana');
        }).catch((error) => {
          console.log('Error sending log to Grafana', error.message);
        });
      }
    } catch (error) {
      console.log('Error sending log to Grafana', error.message);
    }
  }
}

const logger = new Logger();
module.exports = logger;
