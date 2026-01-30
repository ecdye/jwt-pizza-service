// Set NODE_ENV to test before anything else
process.env.NODE_ENV = 'test';

const mysql = require('mysql2/promise');
const config = require('./src/config');

// Global setup for all tests
beforeAll(async () => {
  console.log('Dropping test database to start fresh...');

  try {
    const connection = await mysql.createConnection({
      ...(config.db.connection.socketPath
        ? { socketPath: config.db.connection.socketPath }
        : { host: config.db.connection.host }),
      user: config.db.connection.user,
      password: config.db.connection.password,
      connectTimeout: config.db.connection.connectTimeout,
    });

    try {
      await connection.query(`DROP DATABASE IF EXISTS ${config.db.connection.database}`);
      console.log(`Dropped test database: ${config.db.connection.database}`);
    } finally {
      connection.end();
    }
  } catch (err) {
    console.error('Failed to drop test database:', err.message);
  }
});

// Clean up after all tests
afterAll(async () => {
  // Drain the connection pool
  const { DB } = require('./src/database/database');
  // Note: The DB singleton will be garbage collected after tests complete
});
