const mysql = require('mysql2');
require('dotenv').config();

// Koneksi ke MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const db = pool.promise();

// Cek koneksi
db.getConnection()
    .then(conn => {
        console.log('MySQL Database Terhubung');
        conn.release();
    })
    .catch(err => console.error('MySQL Error:', err.message));

module.exports = db;