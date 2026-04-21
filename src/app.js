const path = require('path');
const express = require('express');
const session = require('express-session');
const prisma = require('./prisma');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

const routes = require('./routes');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/css', express.static(path.join(__dirname, '../views/css')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax'
    }
  })
);

app.use(async (req, res, next) => {
  res.locals.currentUser = null;
  if (!req.session.userId) {
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, name: true, role: true }
    });

    if (!user) {
      req.session.userId = null;
      return next();
    }

    req.currentUser = user;
    res.locals.currentUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
});

app.use(routes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Server error');
});

module.exports = app;
