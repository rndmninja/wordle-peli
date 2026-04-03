const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

// Test route
app.get('/', (req, res) => {
	res.send('App is running!');
});

app.listen(PORT, () => {
	console.log(`Server is running!\n
                http://localhost:${PORT}/`);
});
