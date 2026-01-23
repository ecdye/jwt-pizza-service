const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database');

let testUser;
let testUserAuthToken;
let testUserId;

beforeAll(async () => {
        const user = await createAdminUser();
        const loginRes = await request(app).put('/api/auth').send(user);
        testUserAuthToken = loginRes.body.token;
        testUserId = loginRes.body.user.id;
        testUser = loginRes.body.user;
});

test('update', async () => {
        const updateRequest = { name: testUser.name, email: testUser.email, password: 'newpassword' };
        const getRes = await request(app).put(`/api/user/${testUserId}`).set('Authorization', `Bearer ${testUserAuthToken}`).send(updateRequest);
        expect(getRes.status).toBe(200);

        const expectedUser = { ...testUser, roles: [{ role: Role.Admin }] };
        delete expectedUser.password;
        expect(getRes.body.user).toMatchObject(expectedUser);
});

async function createAdminUser() {
        let user = { password: 'b', roles: [{ role: Role.Admin }] };
        user.name = Math.random().toString(36).substring(2, 12);
        user.email = user.name + '@admin.com';

        user = await DB.addUser(user);
        return { ...user, password: 'b' };
}
