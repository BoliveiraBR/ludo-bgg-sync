require('dotenv').config({ path: __dirname + '/.env' });

module.exports = {
  bgg: {
    username: process.env.ID_BGG,
    baseUrl: 'https://boardgamegeek.com/xmlapi2'
  },
  ludopedia: {
    accessToken: process.env.LUDO_ACCESS_TOKEN,
    baseUrl: 'https://ludopedia.com.br/api/v1'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  }
};