const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// Add this line at the top with other requires
const ejs = require('ejs');

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Ensure your views are in a 'views' directory


// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret-key', // Replace with a secure key in production
    resave: false,
    saveUninitialized: true,
}));

// Serve static files (like HTML)
app.use(express.static(path.join(__dirname))); // Serve files from the root directory

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

// Basic route to serve the welcome page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // Serve the welcome page
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

// Serve the registration page
app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

// Serve the login page
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve the additional info page
app.get('/additional-info.html', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('You must log in first.');
    }
    res.sendFile(path.join(__dirname, 'additional-info.html'));
});

// Registration route
app.post('/auth/register', (req, res) => {
    const { username, email, password, name, surname, birthdate, gender } = req.body;

    // Check if the user already exists
    db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], async (err, results) => {
        if (results.length > 0) {
            return res.status(400).send('User already exists.');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert the new user
        db.query('INSERT INTO users (username, email, password, name, surname, birthdate, gender) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [username, email, hashedPassword, name, surname, birthdate, gender], (err, result) => {
            if (err) {
                return res.status(500).send('Error registering user.');
            }
            req.session.userId = result.insertId; // Store user ID in session
            res.redirect('/additional-info.html'); // Redirect to additional info page
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
        req.session.username = user.username; // Store username in session
        res.redirect(`/profile.html`); // Redirect to profile page
    });
});

// Serve profile page with dynamic URL based on username
app.get('/:username', (req, res) => {
    const { username } = req.params;

    db.query('SELECT u.id, u.username, up.profile_description, up.interested_gender, up.pet, up.hobbies FROM users u LEFT JOIN user_profile up ON u.id = up.id WHERE u.username = ?', [username], (err, results) => {
        if (err) {
            return res.status(500).send('Error fetching user information.');
        }
        if (results.length === 0) {
            return res.status(404).send('User not found.');
        }

        const userData = results[0];
        res.render('profile', { user: userData }); // Render profile page dynamically
    });
});

// Handle additional user info submission
app.post('/auth/additional-info', (req, res) => {
    const { profile_description, interested_gender, pet, hobbies } = req.body;
    const userId = req.session.userId;

    // Convert hobbies array to string
    const hobbiesString = Array.isArray(hobbies) ? hobbies.join(',') : hobbies;

    db.query('INSERT INTO user_profile (id, profile_description, interested_gender, pet, hobbies) VALUES (?, ?, ?, ?, ?)',
        [userId, profile_description, interested_gender, pet, hobbiesString], (err, result) => {
            if (err) {
                return res.status(500).send('Error saving additional info.');
            }
            res.redirect(`/profile`); // Redirect to profile page
        });
});

// Fetch user profile information
app.get('/api/user', (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).send('You must log in first.');
    }

    // Fetch user info and profile
    db.query('SELECT u.username, up.profile_description, up.interested_gender, up.pet, up.hobbies FROM users u LEFT JOIN user_profile up ON u.id = up.id WHERE u.id = ?',
        [userId], (err, results) => {
            if (err) {
                return res.status(500).send('Error fetching user information.');
            }
            res.json(results[0]); // Send back user profile
        });
});

// Update user profile information
app.post('/api/user/update', (req, res) => {
    const { profile_description, interested_gender, pet, hobbies } = req.body;
    const userId = req.session.userId; // Get the user ID from session

    // Convert hobbies array to string
    const hobbiesString = Array.isArray(hobbies) ? hobbies.join(',') : hobbies;

    db.query('UPDATE user_profile SET profile_description = ?, interested_gender = ?, pet = ?, hobbies = ? WHERE id = ?',
        [profile_description, interested_gender, pet, hobbiesString, userId], (err, result) => {
            if (err) {
                return res.status(500).send('Error updating profile.');
            }
            res.send('Profile updated successfully!');
        });
});

// Explore users based on filters
app.get('/api/users', (req, res) => {
    const { minAge, maxAge, gender } = req.query;
    let query = 'SELECT * FROM users';
    const params = [];

    const today = new Date();
    const ageCutOff = (age) => {
        const birthDate = new Date();
        birthDate.setFullYear(today.getFullYear() - age);
        return birthDate.toISOString().split('T')[0];
    };

    if (minAge) {
        query += ' WHERE birthdate <= ?';
        params.push(ageCutOff(minAge));
    }
    if (maxAge) {
        query += (params.length > 0 ? ' AND' : ' WHERE') + ' birthdate >= ?';
        params.push(ageCutOff(maxAge));
    }
    if (gender) {
        query += (params.length > 0 ? ' AND' : ' WHERE') + ' gender = ?';
        params.push(gender);
    }

    db.query(query, params, (error, results) => {
        if (error) {
            console.error('Error fetching users:', error);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

// Logout route
app.post('/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Error logging out.');
    }
    res.redirect('/'); // Redirect to homepage
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
