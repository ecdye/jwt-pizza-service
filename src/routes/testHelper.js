const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database');

/**
 * Creates a user with random credentials
 * @param {Object} additionalData - Additional user data (roles, etc.)
 * @returns {Object} User object with password
 */
async function createUser(additionalData = {}) {
  let user = { password: 'password123', ...additionalData };
  user.name = Math.random().toString(36).substring(2, 12);
  user.email = user.name + '@test.com';

  user = await DB.addUser(user);
  return { ...user, password: 'password123' };
}

/**
 * Creates an admin user with random credentials
 * @returns {Object} Admin user object with password
 */
async function createAdminUser() {
  return createUser({ roles: [{ role: Role.Admin }] });
}

/**
 * Logs in a user and returns authentication data
 * @param {Object} user - User object with email and password
 * @returns {Object} Object containing token, userId, and user data
 */
async function loginUser(user) {
  const loginRes = await request(app).put('/api/auth').send(user);
  return {
    token: loginRes.body.token,
    userId: loginRes.body.user.id,
    user: loginRes.body.user,
    response: loginRes,
  };
}

/**
 * Creates and logs in a user in one step
 * @param {Object} additionalData - Additional user data (roles, etc.)
 * @returns {Object} Object containing token, userId, user, and password
 */
async function createAndLoginUser(additionalData = {}) {
  const user = await createUser(additionalData);
  const loginData = await loginUser(user);
  return {
    ...loginData,
    password: user.password,
  };
}

/**
 * Validates that a string is a properly formatted JWT
 * @param {string} potentialJwt - String to validate
 */
function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

/**
 * Creates a random name for test entities
 * @param {string} prefix - Prefix for the name
 * @returns {string} Random name with timestamp
 */
function randomName(prefix = 'Test') {
  return `${prefix}${Date.now()}`;
}

module.exports = {
  createUser,
  createAdminUser,
  loginUser,
  createAndLoginUser,
  expectValidJwt,
  randomName,
  app,
  Role,
};
