const axios = require('axios');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();

class BGGApi {
  constructor(username) {
    this.username = username;
    this.baseUrl = 'https://boardgamegeek.com/xmlapi2';
    this.maxRetries = 3;  // número máximo de tentativas
    this.retryDelay = 3000;  // 3 segundos entre tentativas
  }

  async fetchCollection() {
    console.log('📦 Buscando coleção do BGG...');
    const collection = [];

    try {
      // Buscar jogos base
      console.log('📦 Buscando jogos base do BGG...');
      const baseGames = await this.fetchCollectionByType('boardgame', 'base');
      collection.push(...baseGames);

      // Buscar expansões
      console.log('📦 Buscando expansões do BGG...');
      const expansions = await this.fetchCollectionByType('boardgameexpansion', 'expansion');
      collection.push(...expansions);

      return collection;
    } catch (error) {
      console.error('❌ Erro ao buscar coleção do BGG:', error.message);
      return [];
    }
  }

  async fetchCollectionByType(subtype, label) {
    const url = `${this.baseUrl}/collection?username=${this.username}&own=1&subtype=${subtype}${subtype === 'boardgame' ? '&excludesubtype=boardgameexpansion' : ''}`;
    
    try {
      const response = await this.retryRequest(url, label);

      const result = await parser.parseStringPromise(response.data);
      if (!result.items) {
        console.error(`❌ Erro: Resposta inválida do BGG para ${label}`);
        return [];
      }

      const items = result.items.item || [];
      return items.map((item, index) => ({
        num: index + 1,
        id: item.$.objectid,
        name: item.name?.[0]?._ || 'Desconhecido',
        subtype: label,
        year: item.yearpublished?.[0] || 'N/A',
        image: item.image?.[0] || '',
        thumbnail: item.thumbnail?.[0] || '',
        numplays: parseInt(item.numplays?.[0] || '0', 10),
        comment: item.comment?.[0] || ''
      }));
    } catch (err) {
      console.error(`❌ Erro ao buscar coleção (${label}):`, err.message);
      return [];
    }
  }

  async retryRequest(url, label) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.get(url);
        
        // Se receber 202, espera e continua tentando
        if (response.status === 202) {
          console.log(`⏳ BGG está processando a requisição para ${label}. Tentativa ${attempt}/${this.maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          continue;
        }
        
        return response;
      } catch (error) {
        if (attempt === this.maxRetries) throw error;
        console.log(`⚠️ Tentativa ${attempt} falhou, tentando novamente...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
    throw new Error(`Máximo de tentativas excedido para ${label}`);
  }
}

module.exports = BGGApi;