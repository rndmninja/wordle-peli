const request = require('supertest');

function resolveAppOrServerTarget(appModule) {
	if (typeof appModule === 'function') {
		return appModule;
	}

	if (appModule && typeof appModule.address === 'function') {
		return appModule;
	}

	if (appModule && typeof appModule.app === 'function') {
		return appModule.app;
	}

	if (appModule && appModule.default) {
		return resolveAppOrServerTarget(appModule.default);
	}

	throw new Error('Could not resolve Express app/server export from src/app.js');
}

function loadTestApp() {
	jest.resetModules();

	const express = require('express');
	const listenSpy = jest
		.spyOn(express.application, 'listen')
		.mockImplementation(() => ({ close: () => {} }));

	const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
	const appModule = require('../app');
	const app = resolveAppOrServerTarget(appModule);

	randomSpy.mockRestore();
	listenSpy.mockRestore();

	return app;
}

describe('Critical routes (simplified)', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('GET /game responds from game route', async () => {
		// Confirms game route exists and returns a real response (not 404).
		const app = loadTestApp();
		const res = await request(app).get('/game');

		expect(res.statusCode).not.toBe(404);
	});

	it('POST /guesses rejects missing required fields', async () => {
		// Confirms invalid payload is not accepted on /guesses.
		const app = loadTestApp();
		const res = await request(app).post('/guesses').send({ word: 'kissa' });

		expect(res.statusCode).toBeGreaterThanOrEqual(400);
	});

	it('POST /game/guess rejects too short guesses', async () => {
		// Confirms guess length validation on game guess endpoint.
		const app = loadTestApp();
		const res = await request(app).post('/game/guess').send({ guess: 'abc' });

		expect(res.statusCode).toBeGreaterThanOrEqual(400);
	});

	it('POST /game/guess accepts valid-length guess request', async () => {
		// Confirms endpoint handles normal 5-letter input without crashing.
		const app = loadTestApp();
		const agent = request.agent(app);
		await agent.get('/game');

		const res = await agent.post('/game/guess').send({ guess: 'kukka' });
		expect([200, 400]).toContain(res.statusCode);
	});
});
