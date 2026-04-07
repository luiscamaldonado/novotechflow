require('dotenv').config();
const { JwtService } = require('@nestjs/jwt');

const jwtService = new JwtService({
  secret: process.env.JWT_SECRET,
  signOptions: { expiresIn: '12h' },
});

const payload = {
  sub: 'dd77b88a-2424-4b1b-8888-37222fe033c8',
  email: 'admin@novotechno.com',
  name: 'System Administrator',
  role: 'COMMERCIAL'
};

const token = jwtService.sign(payload);
console.log(token);
