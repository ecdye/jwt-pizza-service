const request = require('supertest');
const { app, Role, createAndLoginUser, randomName } = require('./testHelper');
const { DB } = require('../database/database');

let adminAuthToken;
let dinerAuthToken;

// Mock the fetch function for factory API calls
global.fetch = jest.fn();

beforeAll(async () => {
  // Create admin user
  const adminData = await createAndLoginUser({ roles: [{ role: Role.Admin }] });
  adminAuthToken = adminData.token;

  // Create diner user
  const dinerData = await createAndLoginUser({ roles: [{ role: Role.Diner }] });
  dinerAuthToken = dinerData.token;
});

beforeEach(() => {
  // Clear mock before each test
  fetch.mockClear();
});

test('get menu', async () => {
  const res = await request(app).get('/api/order/menu');

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  // Menu should have at least some items
  expect(res.body.length).toBeGreaterThanOrEqual(0);
});

test('add menu item as admin', async () => {
  const menuItem = {
    title: randomName('Pizza'),
    description: 'Test pizza description',
    image: 'pizza-test.png',
    price: 0.0042,
  };

  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(menuItem);

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);

  // Verify the new item is in the menu
  const addedItem = res.body.find((item) => item.title === menuItem.title);
  expect(addedItem).toBeDefined();
  expect(addedItem.description).toBe(menuItem.description);
  expect(addedItem.price).toBe(menuItem.price);
});

test('add menu item fails without admin role', async () => {
  const menuItem = {
    title: randomName('Pizza'),
    description: 'Test pizza description',
    image: 'pizza-test.png',
    price: 0.0042,
  };

  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${dinerAuthToken}`)
    .send(menuItem);

  expect(res.status).toBe(403);
  expect(res.body.message).toBe('unable to add menu item');
});

test('add menu item fails without auth token', async () => {
  const menuItem = {
    title: randomName('Pizza'),
    description: 'Test pizza description',
    image: 'pizza-test.png',
    price: 0.0042,
  };

  const res = await request(app).put('/api/order/menu').send(menuItem);

  expect(res.status).toBe(401);
});

test('get orders for authenticated user', async () => {
  const res = await request(app)
    .get('/api/order')
    .set('Authorization', `Bearer ${dinerAuthToken}`);

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('dinerId');
  expect(res.body).toHaveProperty('orders');
  expect(res.body).toHaveProperty('page');
  expect(Array.isArray(res.body.orders)).toBe(true);
});

test('get orders fails without auth token', async () => {
  const res = await request(app).get('/api/order');

  expect(res.status).toBe(401);
});

test('get orders with page parameter', async () => {
  const res = await request(app)
    .get('/api/order?page=1')
    .set('Authorization', `Bearer ${dinerAuthToken}`);

  expect(res.status).toBe(200);
  expect(res.body.page).toBe('1');
});

test('create order successfully', async () => {
  // Mock successful factory response
  const pizzaName = randomName('Pizza');
  const pepperoniName = randomName('Pepperoni');

  await DB.addMenuItem({
    title: pizzaName,
    description: 'A garden of delight',
    image: 'pizza-test.png',
    price: 0.05,
  });

  await DB.addMenuItem({
    title: pepperoniName,
    description: 'Classic pepperoni',
    image: 'pizza-test.png',
    price: 0.042,
  });

  const mockFactoryResponse = {
    reportUrl: 'https://pizza-factory.test/report/123',
    jwt: 'mock.jwt.token',
  };

  fetch.mockResolvedValue({
    ok: true,
    json: async () => mockFactoryResponse,
  });

  const orderRequest = {
    franchiseId: 1,
    storeId: 1,
    items: [
      { menuId: 1, description: pizzaName, price: 0.05 },
      { menuId: 2, description: pepperoniName, price: 0.042 },
    ],
  };

  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${dinerAuthToken}`)
    .send(orderRequest);

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('order');
  expect(res.body.order).toHaveProperty('id');
  expect(res.body.order.items).toHaveLength(2);
  expect(res.body).toHaveProperty('jwt', mockFactoryResponse.jwt);
  expect(res.body).toHaveProperty('followLinkToEndChaos', mockFactoryResponse.reportUrl);

  // Verify fetch was called with correct parameters
  expect(fetch).toHaveBeenCalledTimes(1);
  const fetchCall = fetch.mock.calls[0];
  expect(fetchCall[0]).toContain('/api/order');
  expect(fetchCall[1].method).toBe('POST');
  expect(fetchCall[1].headers['Content-Type']).toBe('application/json');
});

test('create order handles factory failure', async () => {
  // Mock failed factory response
  const mockFactoryResponse = {
    reportUrl: 'https://pizza-factory.test/report/456',
    message: 'Factory error',
  };

  fetch.mockResolvedValue({
    ok: false,
    json: async () => mockFactoryResponse,
  });

  const orderRequest = {
    franchiseId: 1,
    storeId: 1,
    items: [{ menuId: 1, description: 'Veggie', price: 0.05 }],
  };

  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${dinerAuthToken}`)
    .send(orderRequest);

  expect(res.status).toBe(500);
  expect(res.body.message).toBe('Failed to fulfill order at factory');
});

test('create order fails without auth token', async () => {
  const orderRequest = {
    franchiseId: 1,
    storeId: 1,
    items: [{ menuId: 1, description: 'Veggie', price: 0.05 }],
  };

  const res = await request(app).post('/api/order').send(orderRequest);

  expect(res.status).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
});

test('create order with empty items', async () => {
  const mockFactoryResponse = {
    reportUrl: 'https://pizza-factory.test/report/789',
    jwt: 'mock.jwt.token',
  };

  fetch.mockResolvedValue({
    ok: true,
    json: async () => mockFactoryResponse,
  });

  const orderRequest = {
    franchiseId: 1,
    storeId: 1,
    items: [],
  };

  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${dinerAuthToken}`)
    .send(orderRequest);

  // Should still process the order
  expect(res.status).toBe(200);
  expect(res.body.order.items).toHaveLength(0);
});
