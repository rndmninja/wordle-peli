const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Muistiin tallennetut taulukot kolmelle perusresurssille.
// Nämä ovat väliaikaisia ja korvataan myöhemmin oikealla tietokannalla.
const users = [];
const games = [];
const guesses = [];

// Yksinkertaiset laskurit, jotta jokainen uusi tieto saa oman id:n.
let userId = 1;
let gameId = 1;
let guessId = 1;

// Palauttaa kaikki käyttäjät.
router.get('/users', (req, res) => {
	res.json(users);
});

// Luo uuden käyttäjän ja tallentaa sen muistiin.
router.post('/users', (req, res) => {
	const user = {
		id: userId++,
		name: req.body.name || 'Anonymous'
	};

	users.push(user);
	res.status(201).json(user);
});

// Palauttaa kaikki pelit.
router.get('/games', (req, res) => {
	res.json(games);
});

// Luo uuden pelin ja tallentaa sen muistiin.
router.post('/games', (req, res) => {
	const game = {
		id: gameId++,
		status: req.body.status || 'active'
	};

	games.push(game);
	res.status(201).json(game);
});

// Palauttaa kaikki arvaukset.
router.get('/guesses', (req, res) => {
	res.json(guesses);
});

// Luo uuden arvauksen ja tallentaa sen muistiin.
router.post('/guesses', (req, res) => {
	const guess = {
		id: guessId++,
		word: req.body.word || '',
		gameId: req.body.gameId || null
	};

	guesses.push(guess);
	res.status(201).json(guess);
});


// Renderöi pelisivun, jossa satunnainen sana on valmiina.
router.get('/game', (req, res) => {

	// Lukee words.txt-tiedoston ja suodattaa vain 5-kirjaimiset sanat
	// Kuten random-word endpoinitssa

	/*
		TODO: Pitäis tehä niin että words.txt luetaan vain kerran ja tallennetaan muistiin
		eikä joka ikiselle pelisivun lataukselle, 
		ja sitten voisi laittaa napin jossa voisi hakea uuden satunnaisen sanan ilman
		että koko sivu latautuu uudestaan
	*/
	
	const wordsPath = path.join(__dirname, 'words.txt');
	let words = [];
	try {
		const data = fs.readFileSync(wordsPath, 'utf8');
		words = data
			.split('\n')
			.map(w => w.trim().toLowerCase())
			.filter(w => w.length === 5);
	} catch (err) {
		return res.status(500).send('Error reading words.txt');
	}
	if (words.length === 0) {
		return res.status(500).send('No words available');
	}
	const randomWord = words[Math.floor(Math.random() * words.length)];
	res.render('game', { randomWord });
});

module.exports = router;