const axios = require('axios');

async function testRequest() {
  try {
    const res = await axios.get('http://localhost:3000/clients/search?q=NUEVO', {
        headers: {
            'Authorization': 'Bearer YOUR_TOKEN_HERE'
        }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Error status:', err.response?.status);
    console.error('Error data:', err.response?.data);
    console.error('Error message:', err.message);
  }
}

testRequest();
