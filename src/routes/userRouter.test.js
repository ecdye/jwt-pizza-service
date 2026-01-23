const request = require('supertest');
const { app, Role, createAdminUser, loginUser } = require('./testHelper');

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
