const request = require('supertest');
const { app, Role, createAdminUser, loginUser, createAndLoginUser, createUser } = require('./testHelper');

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

test('list users, unauthorized for non-admin', async () => {
  const user = await createAndLoginUser({ roles: [{ role: Role.Diner }] });
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + user.token);
  expect(listUsersRes.status).toBe(403);
});

test('list users, authorized for admin', async () => {
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + testUserAuthToken);
  expect(listUsersRes.status).toBe(200);
  expect(listUsersRes.body.users.length).toBeGreaterThan(0);
});

test('delete user unauthorized', async () => {
  const deleteRes = await request(app).delete(`/api/user/${testUserId}`);
  expect(deleteRes.status).toBe(401);
});

test('delete user, unauthorized for non-admin', async () => {
  const user = await createAndLoginUser({ roles: [{ role: Role.Diner }] });
  const deleteRes = await request(app)
    .delete(`/api/user/${testUserId}`)
    .set('Authorization', 'Bearer ' + user.token);
  expect(deleteRes.status).toBe(403);
});

test('delete user, authorized for admin', async () => {
  const user = await createUser({ roles: [{ role: Role.Diner }] });
  const deleteRes = await request(app)
    .delete(`/api/user/${user.id}`)
    .set('Authorization', 'Bearer ' + testUserAuthToken);
  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body.message).toBe('OK');
});
