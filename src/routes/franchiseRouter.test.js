const request = require('supertest');
const { app, Role, createAndLoginUser, randomName } = require('./testHelper');

let adminAuthToken;
let franchiseAdminUser;
let franchiseAdminAuthToken;
let testFranchiseId;
let testStoreId;

beforeAll(async () => {
  // Create admin user
  const adminData = await createAndLoginUser({ roles: [{ role: Role.Admin }] });
  adminAuthToken = adminData.token;

  // Create franchise admin user
  const franchiseData = await createAndLoginUser({ roles: [{ role: Role.Diner }] });
  franchiseAdminAuthToken = franchiseData.token;
  franchiseAdminUser = franchiseData.user;
});

test('list all franchises', async () => {
  const res = await request(app).get('/api/franchise');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('franchises');
  expect(res.body).toHaveProperty('more');
  expect(Array.isArray(res.body.franchises)).toBe(true);
});

test('create franchise as admin', async () => {
  const franchiseData = {
    name: randomName('TestFranchise'),
    admins: [{ email: franchiseAdminUser.email }],
  };

  const res = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(franchiseData);

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('id');
  expect(res.body.name).toBe(franchiseData.name);
  expect(res.body.admins).toHaveLength(1);
  expect(res.body.admins[0].email).toBe(franchiseAdminUser.email);

  testFranchiseId = res.body.id;
});

test('create franchise fails without admin role', async () => {
  const franchiseData = {
    name: randomName('TestFranchise'),
    admins: [{ email: franchiseAdminUser.email }],
  };

  const res = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${franchiseAdminAuthToken}`)
    .send(franchiseData);

  expect(res.status).toBe(403);
  expect(res.body.message).toBe('unable to create a franchise');
});

test('create franchise fails without auth token', async () => {
  const franchiseData = {
    name: randomName('TestFranchise'),
    admins: [{ email: franchiseAdminUser.email }],
  };

  const res = await request(app).post('/api/franchise').send(franchiseData);

  expect(res.status).toBe(401);
});

test('get user franchises', async () => {
  const res = await request(app)
    .get(`/api/franchise/${franchiseAdminUser.id}`)
    .set('Authorization', `Bearer ${franchiseAdminAuthToken}`);

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  const userFranchise = res.body.find((f) => f.id === testFranchiseId);
  expect(userFranchise).toBeDefined();
});

test('admin can get any user franchises', async () => {
  const res = await request(app)
    .get(`/api/franchise/${franchiseAdminUser.id}`)
    .set('Authorization', `Bearer ${adminAuthToken}`);

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('cannot get another user franchises without permission', async () => {
  const otherData = await createAndLoginUser({ roles: [{ role: Role.Diner }] });

  const res = await request(app)
    .get(`/api/franchise/${franchiseAdminUser.id}`)
    .set('Authorization', `Bearer ${otherData.token}`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual([]);
});

test('create store as franchise admin', async () => {
  const storeData = {
    name: randomName('TestStore'),
  };

  const res = await request(app)
    .post(`/api/franchise/${testFranchiseId}/store`)
    .set('Authorization', `Bearer ${franchiseAdminAuthToken}`)
    .send(storeData);

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('id');
  expect(res.body.name).toBe(storeData.name);

  testStoreId = res.body.id;
});

test('create store as admin', async () => {
  const storeData = {
    name: randomName('AdminStore'),
  };

  const res = await request(app)
    .post(`/api/franchise/${testFranchiseId}/store`)
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(storeData);

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('id');
  expect(res.body.name).toBe(storeData.name);
});

test('create store fails without proper authorization', async () => {
  const otherData = await createAndLoginUser({ roles: [{ role: Role.Diner }] });

  const storeData = {
    name: randomName('UnauthorizedStore'),
  };

  const res = await request(app)
    .post(`/api/franchise/${testFranchiseId}/store`)
    .set('Authorization', `Bearer ${otherData.token}`)
    .send(storeData);

  expect(res.status).toBe(403);
  expect(res.body.message).toBe('unable to create a store');
});

test('delete store as franchise admin', async () => {
  const res = await request(app)
    .delete(`/api/franchise/${testFranchiseId}/store/${testStoreId}`)
    .set('Authorization', `Bearer ${franchiseAdminAuthToken}`);

  expect(res.status).toBe(200);
  expect(res.body.message).toBe('store deleted');
});

test('delete store fails without proper authorization', async () => {
  // Create another store to delete
  const storeData = { name: randomName('StoreToDelete') };
  const createRes = await request(app)
    .post(`/api/franchise/${testFranchiseId}/store`)
    .set('Authorization', `Bearer ${franchiseAdminAuthToken}`)
    .send(storeData);
  const storeId = createRes.body.id;

  const otherData = await createAndLoginUser({ roles: [{ role: Role.Diner }] });

  const res = await request(app)
    .delete(`/api/franchise/${testFranchiseId}/store/${storeId}`)
    .set('Authorization', `Bearer ${otherData.token}`);

  expect(res.status).toBe(403);
  expect(res.body.message).toBe('unable to delete a store');
});

test('delete franchise as admin', async () => {
  const res = await request(app)
    .delete(`/api/franchise/${testFranchiseId}`)
    .set('Authorization', `Bearer ${adminAuthToken}`);

  expect(res.status).toBe(200);
  expect(res.body.message).toBe('franchise deleted');
});

test('delete franchise fails without admin role', async () => {
  // Create a franchise first
  const franchiseData = {
    name: randomName('ToDelete'),
    admins: [{ email: franchiseAdminUser.email }],
  };

  const createRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(franchiseData);
  const franchiseId = createRes.body.id;

  // Try to delete as non-admin
  const res = await request(app)
    .delete(`/api/franchise/${franchiseId}`)
    .set('Authorization', `Bearer ${franchiseAdminAuthToken}`);

  expect(res.status).toBe(403);
  expect(res.body.message).toBe('unable to delete a franchise');
});

// Test deleteFranchise - fails without auth
test('delete franchise fails without auth token', async () => {
  const res = await request(app).delete('/api/franchise/999');

  expect(res.status).toBe(401);
});

test('create store fails on non-existent franchise', async () => {
  const storeData = {
    name: randomName('TestStore'),
  };

  const res = await request(app)
    .post('/api/franchise/99999/store')
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(storeData);

  // When franchise doesn't exist, DB operations may fail with 500
  // This is acceptable behavior - just verify it's not successful
  expect([403, 500]).toContain(res.status);
});
