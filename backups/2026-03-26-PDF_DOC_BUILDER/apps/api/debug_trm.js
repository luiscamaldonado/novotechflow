const axios = require('axios');
const cheerio = require('cheerio');

async function testExtraTrm() {
    const today = new Date().toISOString().split('T')[0];
    const results = {
      setIcapAverage: null,
      wilkinsonSpot: null
    };

    // 1. SET-ICAP Average (POST API)
    try {
      console.log("Fetching SET-ICAP for", today);
      const setIcapRes = await axios.post('https://proxy.set-icap.com/seticap/api/estadisticas/estadisticasPromedioCierre/', {
        fecha: today,
        mercado: 71,
        delay: 15
      }, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://dolar.set-icap.com/'
        },
        timeout: 5000
      });
      console.log("SET-ICAP RAW:", JSON.stringify(setIcapRes.data, null, 2));
      if (setIcapRes.data?.data?.avg) {
        results.setIcapAverage = parseFloat(setIcapRes.data.data.avg.replace(',', '.'));
      }
    } catch (e) {
      console.error("Error fetching SET-ICAP average:", e.message);
    }

    // 2. Wilkinson Spot Average (Scraping)
    try {
      console.log("Fetching Wilkinson...");
      const wilkinsonRes = await axios.get('https://dolar.wilkinsonpc.com.co/dolar-hoy-spot-minuto-a-minuto/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        timeout: 5000
      });
      const $ = cheerio.load(wilkinsonRes.data);
      const spotText = $('.display-5.fw-bold.text-dark.lh-1.my-1 span').first().text();
      console.log("Wilkinson Spot text found:", spotText);
      if (spotText) {
        results.wilkinsonSpot = parseFloat(spotText.replace(/\./g, '').replace(',', '.'));
      }
    } catch (e) {
      console.error("Error fetching Wilkinson spot:", e.message);
    }

    console.log("Final results:", results);
}

testExtraTrm();
