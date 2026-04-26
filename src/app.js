const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const app = express();

// Asettaa EJS-templatenginen ja määrittää views-kansion sijainnin.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

const routes = require('./routes');

// Lisää turvallisuusheaderit oletuksena kaikkiin vastauksiin.
app.use(helmet());

// Antaa Expressille mahdollisuuden lukea JSON-dataa POST-pyyntöjen bodyssa.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const guessLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	message: { error: 'Too many requests, try again later.' }
});

// Tarjoaa pelin CSS-tiedoston selaimelle.
app.use('/css', express.static(path.join(__dirname, '../views/css')));

// Rajoittaa arvausreitin pyyntömäärää bottispämmin estämiseksi.
app.use('/game/guess', guessLimiter);

// Liitetään erikseen tehdyt resurssireitit tähän sovellukseen.
app.use(routes);

const PORT = process.env.PORT || 3000;

// Test route
app.get('/', (req, res) => {
	res.send('App is running!');
});

module.exports = app;