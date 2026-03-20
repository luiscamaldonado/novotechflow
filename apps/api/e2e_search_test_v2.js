const { JwtService } = require('@nestjs/jwt');

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
    const res = await fetch('http://localhost:3000/clients/search?q=NUEVO', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Results: ${data.results?.length}`);
    console.log(JSON.stringify(data.results?.slice(0, 5), null, 2));
  } catch (err) {
    console.error('Error message:', err.message);
  }
}

testRequest();
