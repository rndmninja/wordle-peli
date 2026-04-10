const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const prisma = require('./prisma');
const { status } = require('express/lib/response');

// Muistiin tallennetut taulukot kolmelle perusresurssille.
// Nämä ovat väliaikaisia ja korvataan myöhemmin oikealla tietokannalla.
const users = [];
const games = [];
const guesses = [];

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

// Luetaan words.txt kerran ja valitaan yksi sana muistiin.
const wordsPath = path.join(__dirname, 'words.txt');
let words = [];
let randomWordInMemory = null;
let currentGame = null;

try {
	const data = fs.readFileSync(wordsPath, 'utf8');
	words = data
		.split('\n')
		.map(w => w.trim().toLowerCase())
		.filter(w => w.length === 5);

	if (words.length > 0) {
		randomWordInMemory = words[Math.floor(Math.random() * words.length)];
		currentGame = createGameState();
	}
} catch (err) {
	console.error('Error reading words.txt:', err);
}

function createGameState() {
	return {
		targetWord: randomWordInMemory,
		guesses: [],
		message: 'Arvaa viiden kirjaimen sana.',
		isWon: false,
		isOver: false
	};
}

function ensureGameState() {
	if (!currentGame && randomWordInMemory) {
		currentGame = createGameState();
	}

	return currentGame;
}

function normalizeGuess(value) {
	return (value || '').trim().toLowerCase();
}

function scoreGuess(guessWord, targetWord) {
	const guessLetters = guessWord.split('');
	const targetLetters = targetWord.split('');
	const feedback = guessLetters.map(letter => ({
		letter,
		status: 'absent'
	}));
	const availableLetters = targetLetters.slice();

	for (let index = 0; index < guessLetters.length; index += 1) {
		if (guessLetters[index] === targetLetters[index]) {
			feedback[index].status = 'correct';
			availableLetters[index] = null;
		}
	}

	for (let index = 0; index < guessLetters.length; index += 1) {
		if (feedback[index].status === 'correct') {
			continue;
		}

		const letterIndex = availableLetters.indexOf(guessLetters[index]);
		if (letterIndex !== -1) {
			feedback[index].status = 'present';
			availableLetters[letterIndex] = null;
		}
	}

	return feedback;
}

function buildBoardRows(gameState) {
	return Array.from({ length: MAX_GUESSES }, (_, rowIndex) => {
		const guess = gameState.guesses[rowIndex];

		if (guess) {
			return guess.feedback;
		}

		return Array.from({ length: WORD_LENGTH }, () => ({
			letter: '',
			status: 'empty'
		}));
	});
}

function renderGame(res, statusCode = 200) {
	const gameState = ensureGameState();

	if (!gameState) {
		return res.status(500).send('No words available');
	}

	return res.status(statusCode).render('game', {
		boardRows: buildBoardRows(gameState),
		gameState,
		maxGuesses: MAX_GUESSES,
		remainingGuesses: Math.max(MAX_GUESSES - gameState.guesses.length, 0),
		wordLength: WORD_LENGTH
	});
}

function chooseRandomWord() {
	if (words.length === 0) {
		return null;
	}

	const randomIndex = Math.floor(Math.random() * words.length);
	return words[randomIndex];
}

// Yksinkertaiset laskurit, jotta jokainen uusi tieto saa oman id:n.
let userId = 1;
let gameId = 1;
let guessId = 1;

// Palauttaa kaikki käyttäjät.
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

// Luo uuden käyttäjän ja tallentaa sen muistiin.
router.post('/users', async (req, res) => {
  const user = await prisma.user.create({
    data: {
      name: req.body.name || 'Anonymous'
    }
  });
  res.status(201).json(user);
});

// Palauttaa kaikki pelit.
router.get('/games', async (req, res) => {
	const games = await prisma.game.findMany();
	res.json(games);
});

// Luo uuden pelin ja tallentaa sen muistiin.
router.post('/games', async (req, res) => {
	const game = await prisma.game.create({
		data: {
			status: req.body.status || 'active',
			targetWord: chooseRandomWord(), 
			userId: req.body.userId || null  // voi linkittää peli session käyttäjään, on null jos ei määritetty
		}
	});
	res.status(201).json(game);
});

// Palauttaa kaikki arvaukset.
router.get('/guesses', async (req, res) => {
	const guesses = await prisma.guess.findMany();
	res.json(guesses);
});

// Luo uuden arvauksen ja tallentaa sen muistiin.
router.post('/guesses', async (req, res) => {
	const guess = await prisma.guess.create({
		data: {
			id: guessId++,
			word: req.body.word || '',
			gameId: req.body.gameId || null
		}});

	guesses.push(guess);
	res.status(201).json(guess);
});


// Renderöi pelisivun, jossa satunnainen sana on valmiina.
router.get('/game', (req, res) => {
	return renderGame(res);
});

// Palauttaa satunnaisen sanan sanalistasta.
router.get('/random-word', (req, res) => {
	const randomWord = chooseRandomWord();

	if (!randomWord) {
		return res.status(500).json({ error: 'No words available' });
	}

	return res.json({ word: randomWord });
});

// Vastaanottaa uuden arvauksen ja päivittää pelitilan.
router.post('/game/guess', (req, res) => {
	const gameState = ensureGameState();

	if (!gameState) {
		return res.status(500).send('No words available');
	}

	if (gameState.isOver) {
		gameState.message = 'Peli on jo päättynyt. Käynnistä uusi sana myöhemmin.';
		return renderGame(res);
	}

	const guessWord = normalizeGuess(req.body.guess);

	if (guessWord.length !== WORD_LENGTH) {
		gameState.message = `Arvauksen pitää olla ${WORD_LENGTH} kirjainta.`;
		return renderGame(res, 400);
	}

	if (!words.includes(guessWord)) {
		gameState.message = 'Sanaa ei löydy sanalistasta.';
		return renderGame(res, 400);
	}

	const feedback = scoreGuess(guessWord, gameState.targetWord);
	gameState.guesses.push({
		feedback,
		word: guessWord
	});

	if (guessWord === gameState.targetWord) {
		gameState.isWon = true;
		gameState.isOver = true;
		gameState.message = `Oikein! Sana oli ${gameState.targetWord.toUpperCase()}.`;
	} else if (gameState.guesses.length >= MAX_GUESSES) {
		gameState.isOver = true;
		gameState.message = `Yritykset loppuivat. Oikea sana oli ${gameState.targetWord.toUpperCase()}.`;
	} else {
		gameState.message = 'Arvaus lisättiin.';
	}

	return renderGame(res);

});

// Arpoo uuden sanan ilman sivun uudelleenlatausta.
router.post('/game/new-word', (req, res) => {
	const nextWord = chooseRandomWord();

	if (!nextWord) {
		return res.status(500).json({ message: 'No words available' });
	}

	randomWordInMemory = nextWord;
	currentGame = createGameState();
	currentGame.message = 'Uusi sana arvottu. Aloita arvaus.';

	return res.json({
		boardRows: buildBoardRows(currentGame),
		message: currentGame.message
	});
});

module.exports = router;