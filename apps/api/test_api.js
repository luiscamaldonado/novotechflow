const axios = require('axios');

async function testApi() {
    try {
        console.log("Fetching set-icap PROXY API...");
        const res = await axios.get('https://proxy.set-icap.com/seticap/api/estadisticas/estadisticasPromedioCierre/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://dolar.set-icap.com/'
            },
            timeout: 10000
        });
        console.log("Response:", JSON.stringify(res.data, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    }
}

testApi();
