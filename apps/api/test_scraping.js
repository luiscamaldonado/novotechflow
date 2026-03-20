const axios = require('axios');
const cheerio = require('cheerio');

async function testScraping() {
    try {
        console.log("Fetching set-icap...");
        const res = await axios.get('https://dolar.set-icap.com/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        const $ = cheerio.load(res.data);
        const promedioH = $('#promedioH').text();
        console.log("Set-Icap #promedioH text:", promedioH);
        
        console.log("Fetching Wilkinson...");
        const res2 = await axios.get('https://dolar.wilkinsonpc.com.co/dolar-hoy-spot-minuto-a-minuto/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        const $2 = cheerio.load(res2.data);
        const spotAverage = $2('.display-5.fw-bold.text-dark.lh-1.my-1 span').text();
        console.log("Wilkinson Spot Average text:", spotAverage);

    } catch (e) {
        console.error("Error:", e.message);
    }
}

testScraping();
