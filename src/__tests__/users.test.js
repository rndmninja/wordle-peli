const request = require('supertest');
const app = require('../app');
const prisma = require('../prisma');

describe('POST /users (database test)', () => {

	afterAll(async () => {
		await prisma.user.deleteMany({
			where: { name: 'TestUser123' }
		});
	});

	it('creates a user in the database', async () => {
		const res = await request(app)
			.post('/users')
			.send({ name: 'TestUser123' });

		expect(res.statusCode).toBe(201);
		expect(res.body).toHaveProperty('id');
		expect(res.body.name).toBe('TestUser123');

		const user = await prisma.user.findFirst({
			where: { name: 'TestUser123' }
		});

		expect(user).not.toBeNull();
		expect(user.name).toBe('TestUser123');
	});
});
