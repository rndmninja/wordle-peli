const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

// Lukee words.txt-tiedoston
const wordsPath = path.join(__dirname, 'words.txt');
let words = [];

// Käyttää rivinvaihtoja erottelemaan sanat ja suodattaa vain 5-kirjaimiset sanat
try {
	const data = fs.readFileSync(wordsPath, 'utf8');
	words = data
		.split('\n')
		.map(w => w.trim().toLowerCase())
		.filter(w => w.length === 5);
} catch (err) {
	console.error('Error reading words.txt:', err);
}

// API-endpoint satunnaisen sanan hakemiseksi
app.get('/random-word', (req, res) => {
	if (words.length === 0) {
		return res.status(500).json({ error: 'No words available' });
	}
	const randomWord = words[Math.floor(Math.random() * words.length)];
	res.json({ word: randomWord });
});

const PORT = process.env.PORT || 3000;

// Test route
app.get('/', (req, res) => {
	res.send('App is running!');
});

app.listen(PORT, () => {
	console.log(`Server is running! http://localhost:${PORT}/`);
});
