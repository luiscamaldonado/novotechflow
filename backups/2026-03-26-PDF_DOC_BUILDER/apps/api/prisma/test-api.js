const axios = require('axios');

async function test() {
  try {
    // Login first
    const loginRes = await axios.post('http://localhost:3000/auth/login', {
      email: 'admin@novotechno.com',
      password: 'admin123',
    });
    const token = loginRes.data.access_token;
    console.log('Login OK, token received');

    // Get proposals
    const proposalsRes = await axios.get('http://localhost:3000/proposals', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`Proposals returned: ${proposalsRes.data.length}`);
    proposalsRes.data.forEach(p => {
      console.log(`  - ${p.proposalCode} | ${p.clientName} | ${p.status}`);
    });
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
  }
}
test();
