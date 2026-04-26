const request = require('supertest');
const app = require('../app');
const prisma = require('../prisma');

describe('Authentication and authorization', () => {
  afterAll(async () => {
    await prisma.guess.deleteMany();
    await prisma.game.deleteMany();
    await prisma.user.deleteMany({
      where: { name: { in: ['TestUser123', 'SecondUser123', 'AdminUser123'] } }
    });
    await prisma.$disconnect();
  });

  it('registers a user and stores a password hash instead of the plain password', async () => {
    const res = await request(app)
      .post('/register')
      .type('form')
      .send({ name: 'TestUser123', password: 'secret123', role: 'player' });

    expect(res.statusCode).toBe(302);

    const user = await prisma.user.findFirst({ where: { name: 'TestUser123' } });
    expect(user).not.toBeNull();
    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash).not.toBe('secret123');
  });

  it('blocks unauthenticated access to protected routes', async () => {
    const res = await request(app).get('/games').set('Accept', 'application/json');
    expect(res.statusCode).toBe(401);
  });

  it('prevents one user from creating guesses for another user game', async () => {
    const agent1 = request.agent(app);
    await agent1
      .post('/register')
      .type('form')
      .send({ name: 'SecondUser123', password: 'secret123', role: 'player' });

    const ownGameRes = await agent1.post('/games').set('Accept', 'application/json').send({});
    expect(ownGameRes.statusCode).toBe(201);
    const gameId = ownGameRes.body.id;

    const agent2 = request.agent(app);
    await agent2
      .post('/login')
      .type('form')
      .send({ name: 'TestUser123', password: 'secret123' });

    const forbiddenRes = await agent2
      .post('/guesses')
      .set('Accept', 'application/json')
      .send({ word: 'kissa', gameId });

    expect(forbiddenRes.statusCode).toBe(403);
  });
});
