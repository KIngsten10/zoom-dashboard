const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '@Pinkman10',
  database: 'zoom_integration',
});

module.exports = pool;
