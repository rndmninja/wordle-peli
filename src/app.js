const path = require('path');
const express = require('express');
const app = express();

// Asettaa EJS-templatenginen ja määrittää views-kansion sijainnin.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
const routes = require('./routes');

// Antaa Expressille mahdollisuuden lukea JSON-dataa POST-pyyntöjen bodyssa.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Tarjoaa pelin CSS-tiedoston selaimelle.
app.use('/css', express.static(path.join(__dirname, '../views/css')));

// Liitetään erikseen tehdyt resurssireitit tähän sovellukseen.
app.use(routes);

const PORT = process.env.PORT || 3000;

// Test route
app.get('/', (req, res) => {
	res.send('App is running!');
});

app.listen(PORT, () => {
	console.log(`Server is running! http://localhost:${PORT}/`);
});
