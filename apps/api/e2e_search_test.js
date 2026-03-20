const { JwtService } = require('@nestjs/jwt');
const axios = require('axios');

const jwtService = new JwtService({
  secret: 'super-secret-novotechflow-key-change-me',
  signOptions: { expiresIn: '12h' },
});

const payload = {
  sub: 'dd77b88a-2424-4b1b-8888-37222fe033c8',
  email: 'admin@novotechno.com',
  name: 'System Administrator',
  role: 'COMMERCIAL'
};

const token = jwtService.sign(payload);

async function testRequest() {
  try {
    const res = await axios.get('http://localhost:3000/clients/search?q=NUEVO', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    console.log(`Results: ${res.data.results.length}`);
    console.log(JSON.stringify(res.data.results.slice(0, 5), null, 2));
  } catch (err) {
    console.error('Error status:', err.response?.status);
    console.error('Error message:', err.message);
  }
}

testRequest();
