const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret-key', // replace with a secure key in production
    resave: false,
    saveUninitialized: true,
}));

// MySQL connection setup
const db = mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'password',
    database: process.env.MYSQL_DATABASE || 'user_db'
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
    } else {
        console.log('Connected to MySQL database.');
    }
});

// Basic route
app.get('/', (req, res) => {
    res.send('Hello, World!');
});

// Test MySQL connection route
app.get('/db-test', (req, res) => {
    db.query('SELECT 1 + 1 AS solution', (err, results) => {
        if (err) {
            return res.status(500).send('Error querying the database.');
        }
        res.send(`Database connected! The solution to 1 + 1 is: ${results[0].solution}`);
    });
});

// Registration route
app.post('/auth/register', (req, res) => {
    const { username, email, password } = req.body;

    // Check if the user already exists
    db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], async (err, results) => {
        if (results.length > 0) {
            return res.status(400).send('User already exists.');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert the new user
        db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword], (err, result) => {
            if (err) {
                return res.status(500).send('Error registering user.');
            }
            res.status(201).send('User registered successfully!');
        });
    });
});

// Login route
app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;

    // Find user by username
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (results.length === 0) {
            return res.status(400).send('User not found.');
        }

        const user = results[0];

        // Compare the hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).send('Incorrect password.');
        }

        // Set session
        req.session.userId = user.id;
        res.send('User logged in successfully!');
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
