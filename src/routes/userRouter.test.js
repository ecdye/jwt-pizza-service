const request = require('supertest');
const { app, Role, createAdminUser, loginUser, createAndLoginUser } = require('./testHelper');

let testUser;
let testUserAuthToken;
let testUserId;

beforeAll(async () => {
        const user = await createAdminUser();
        const loginData = await loginUser(user);
        testUserAuthToken = loginData.token;
        testUserId = loginData.userId;
        testUser = loginData.user;
});

test('update', async () => {
        const updateRequest = { name: testUser.name, email: testUser.email, password: 'newpassword' };
        const getRes = await request(app).put(`/api/user/${testUserId}`).set('Authorization', `Bearer ${testUserAuthToken}`).send(updateRequest);
        expect(getRes.status).toBe(200);

        const expectedUser = { ...testUser, roles: [{ role: Role.Admin }] };
        delete expectedUser.password;
        expect(getRes.body.user).toMatchObject(expectedUser);
});

test('update user fails for different user without admin', async () => {
        const otherUserData = await createAndLoginUser({ roles: [{ role: Role.Diner }] });

        const updateRequest = { name: 'hacker', email: 'hacker@test.com', password: 'hacked' };
        const getRes = await request(app)
                .put(`/api/user/${testUserId}`)
                .set('Authorization', `Bearer ${otherUserData.token}`)
                .send(updateRequest);

        expect(getRes.status).toBe(403);
        expect(getRes.body.message).toBe('unauthorized');
});

test('update user with missing fields', async () => {
        // Test with undefined values - should handle gracefully
        const updateRequest = { name: undefined, email: testUser.email };
        const getRes = await request(app)
                .put(`/api/user/${testUserId}`)
                .set('Authorization', `Bearer ${testUserAuthToken}`)
                .send(updateRequest);

        expect(getRes.status).toBe(200);
});

test('update user with empty email should fail', async () => {
        const updateRequest = { name: testUser.name, email: '', password: 'test' };
        const getRes = await request(app)
                .put(`/api/user/${testUserId}`)
                .set('Authorization', `Bearer ${testUserAuthToken}`)
                .send(updateRequest);

        expect(getRes.status).toBe(400);
        expect(getRes.body.message).toBe('email cannot be empty');
});

test('update user with empty name should fail', async () => {
        const updateRequest = { name: '', email: testUser.email, password: 'test' };
        const getRes = await request(app)
                .put(`/api/user/${testUserId}`)
                .set('Authorization', `Bearer ${testUserAuthToken}`)
                .send(updateRequest);

        expect(getRes.status).toBe(400);
        expect(getRes.body.message).toBe('name cannot be empty');
});

test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
  const [, userToken] = await registerUser(request(app));
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(listUsersRes.status).toBe(200);
});

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}
