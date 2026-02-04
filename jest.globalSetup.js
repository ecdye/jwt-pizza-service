// Global setup runs once before all tests
const mysql = require('mysql2/promise');
const config = require('./src/config');

module.exports = async () => {
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
    throw err;
  }
};
