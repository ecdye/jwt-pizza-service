const request = require('supertest');
const { app, expectValidJwt } = require('./testHelper');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
        testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
        const registerRes = await request(app).post('/api/auth').send(testUser);
        testUserAuthToken = registerRes.body.token;
        expectValidJwt(testUserAuthToken);
});

test('login', async () => {
        const loginRes = await request(app).put('/api/auth').send(testUser);
        expect(loginRes.status).toBe(200);
        expectValidJwt(loginRes.body.token);

        const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
        delete expectedUser.password;
        expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('logout', async () => {
        const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
        expect(logoutRes.status).toBe(200);
});

test('register fails with missing name', async () => {
        const invalidUser = { email: 'test@test.com', password: 'password' };
        const res = await request(app).post('/api/auth').send(invalidUser);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('name, email, and password are required');
});

test('register fails with missing email', async () => {
        const invalidUser = { name: 'Test User', password: 'password' };
        const res = await request(app).post('/api/auth').send(invalidUser);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('name, email, and password are required');
});

test('register fails with missing password', async () => {
        const invalidUser = { name: 'Test User', email: 'test@test.com' };
        const res = await request(app).post('/api/auth').send(invalidUser);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('name, email, and password are required');
});

test('login fails with missing credentials', async () => {
        const res = await request(app).put('/api/auth').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('email and password are required');
});

test('register with duplicate email should fail', async () => {
        const duplicateUser = { name: 'Duplicate', email: testUser.email, password: 'password' };
        const res = await request(app).post('/api/auth').send(duplicateUser);
        expect(res.status).toBe(409);
        expect(res.body.message).toBe('user already exists');
});
