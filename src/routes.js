const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const router = express.Router();
const prisma = require('./prisma');

// Muistiin tallennetut taulukot kolmelle perusresurssille.
// Nämä ovat väliaikaisia ja korvataan myöhemmin oikealla tietokannalla.



const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const wordsPath = path.join(__dirname, 'words.txt');
let words = [];

try {
  const data = fs.readFileSync(wordsPath, 'utf8');
  words = data
    .split('\n')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length === WORD_LENGTH);
} catch (err) {
  console.error('Error reading words.txt:', err);
}

function chooseRandomWord() {
  if (words.length === 0) {
    return null;
  }
  return words[Math.floor(Math.random() * words.length)];
}

function createGameState(targetWord = chooseRandomWord()) {
  return {
    targetWord,
    guesses: [],
    message: 'Arvaa viiden kirjaimen sana.',
    isWon: false,
    isOver: false
  };
}

function ensureSessionGame(req) {
  if (!req.session.currentGame) {
    const targetWord = chooseRandomWord();
    if (!targetWord) {
      return null;
    }
    req.session.currentGame = createGameState(targetWord);
  }

  return req.session.currentGame;
}

function normalizeGuess(value) {
  return (value || '').trim().toLowerCase();
}

function scoreGuess(guessWord, targetWord) {
  const guessLetters = guessWord.split('');
  const targetLetters = targetWord.split('');
  const feedback = guessLetters.map(letter => ({ letter, status: 'absent' }));
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

function renderGame(req, res, statusCode = 200) {
  const gameState = ensureSessionGame(req);

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

// Palauttaa kaikki käyttäjät.
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const name = (req.body.name || '').trim();
  const password = req.body.password || '';
  const role = req.body.role === 'admin' ? 'admin' : 'player';

  if (!name || !password) {
    return res.status(400).json({ error: 'name and password are required' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, passwordHash, role },
    select: { id: true, name: true, role: true, createdAt: true }
  });

  res.status(201).json(user);
});

router.get('/games', requireAuth, async (req, res) => {
  const games = await prisma.game.findMany({
    where: req.currentUser.role === 'admin' ? {} : { userId: req.currentUser.id },
    include: { guesses: true }
  });
  res.json(games);
});

router.post('/games', requireAuth, async (req, res) => {
  const game = await prisma.game.create({
    data: {
      status: req.body.status || 'active',
      targetWord: chooseRandomWord(),
      userId: req.currentUser.id
    }
  });
  res.status(201).json(game);
});

router.get('/guesses', requireAuth, async (req, res) => {
  const guesses = await prisma.guess.findMany({
    where: req.currentUser.role === 'admin' ? {} : { userId: req.currentUser.id },
    include: { game: true }
  });
  res.json(guesses);
});

// Luo uuden arvauksen ja tallentaa sen muistiin.
router.post('/guesses', async (req, res) => {
	if (!req.body.word || req.body.gameId == null) {
		return res.status(400).json({ error: 'word and gameId are required' });
	}

	const guess = await prisma.guess.create({
		data: {
			word: req.body.word,
			gameId: req.body.gameId
		}});

	res.status(201).json(guess);
});

router.get('/game', requireAuth, (req, res) => renderGame(req, res));

router.get('/random-word', requireAuth, (req, res) => {
  const randomWord = chooseRandomWord();

  if (!randomWord) {
    return res.status(500).json({ error: 'No words available' });
  }

  return res.json({ word: randomWord });
});

router.post('/game/guess', requireAuth, (req, res) => {
  const gameState = ensureSessionGame(req);

  if (!gameState) {
    return res.status(500).send('No words available');
  }

  if (gameState.isOver) {
    gameState.message = 'Peli on jo päättynyt. Käynnistä uusi sana myöhemmin.';
    return renderGame(req, res);
  }

  const guessWord = normalizeGuess(req.body.guess);

  if (guessWord.length !== WORD_LENGTH) {
    gameState.message = `Arvauksen pitää olla ${WORD_LENGTH} kirjainta.`;
    return renderGame(req, res, 400);
  }

  if (!words.includes(guessWord)) {
    gameState.message = 'Sanaa ei loydy sanalistasta.';
    return renderGame(req, res, 400);
  }

  const feedback = scoreGuess(guessWord, gameState.targetWord);
  gameState.guesses.push({ feedback, word: guessWord });

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

  return renderGame(req, res);
});

router.post('/game/new-word', requireAuth, (req, res) => {
  const nextWord = chooseRandomWord();

  if (!nextWord) {
    return res.status(500).json({ message: 'No words available' });
  }

  req.session.currentGame = createGameState(nextWord);
  req.session.currentGame.message = 'Uusi sana arvottu. Aloita arvaus.';

  return res.json({
    boardRows: buildBoardRows(req.session.currentGame),
    message: req.session.currentGame.message
  });
});

module.exports = router;

// Admin säädökset 
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Forbidden');
  }
  next();
}


router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany();

  res.send(users);
});