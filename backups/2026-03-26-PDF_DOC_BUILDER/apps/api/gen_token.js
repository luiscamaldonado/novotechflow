const jwt = require('jsonwebtoken');

const secret = 'super-secret-novotechflow-key-change-me';

const payload = {
  sub: 'dd77b88a-2424-4b1b-8888-37222fe033c8', // Admin ID I found earlier
  email: 'admin@novotechno.com',
  name: 'System Administrator',
  role: 'COMMERCIAL'
};

const token = jwt.sign(payload, secret, { expiresIn: '1h' });
console.log(token);
