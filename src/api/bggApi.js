const axios = require('axios');
const xml2js = require('xml2js');

class BGGApi {
  constructor(username) {
    this.username = username;
    this.baseUrl = 'https://boardgamegeek.com/xmlapi2';
    this.maxRetries = 5;  // Aumentado para lidar melhor com o BGG
    this.retryDelay = 5000;  // Aumentado para 5 segundos
    this.requestTimeout = 30000;  // 30 segundos de timeout
    this.parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      trim: true
    });
  }

  async fetchCollection() {
    console.log(`📦 Buscando coleção do BGG para usuário: ${this.username}...`);
    
    if (!this.username) {
      throw new Error('Nome de usuário BGG não fornecido');
    }

    try {
      // Verificar se o usuário existe primeiro
      await this.validateUser();
      
      const collection = [];
      let totalFetched = 0;
      
      // Buscar jogos base
      console.log('📦 Buscando jogos base do BGG...');
      const baseGames = await this.fetchCollectionByType('boardgame', 'base');
      collection.push(...baseGames);
      totalFetched += baseGames.length;
      console.log(`✅ ${baseGames.length} jogos base carregados`);
      
      // Buscar expansões
      console.log('📦 Buscando expansões do BGG...');
      const expansions = await this.fetchCollectionByType('boardgameexpansion', 'expansion');
      collection.push(...expansions);
      totalFetched += expansions.length;
      console.log(`✅ ${expansions.length} expansões carregadas`);

      console.log(`📊 BGG: Total de ${totalFetched} jogos carregados`);
      console.log(`📊 BGG: ${baseGames.length} jogos base, ${expansions.length} expansões`);
      
      return collection;
      
    } catch (error) {
      console.error('❌ Erro ao buscar coleção do BGG:', error.message);
      throw error;
    }
  }

  async validateUser() {
    try {
      console.log(`🔍 Validando usuário BGG: ${this.username}...`);
      
      const url = `${this.baseUrl}/user?name=${this.username}`;
      const response = await this.retryRequest(url, 'validação de usuário', false);
      
      const result = await this.parser.parseStringPromise(response.data);
      
      if (!result.user || result.user.name !== this.username) {
        throw new Error(`Usuário BGG '${this.username}' não encontrado`);
      }
      
      console.log(`✅ Usuário BGG validado: ${this.username} (ID: ${result.user.id})`);
      return true;
      
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Usuário BGG '${this.username}' não existe`);
      }
      throw new Error(`Erro ao validar usuário BGG: ${error.message}`);
    }
  }

  async fetchCollectionByType(subtype, label) {
    // Include version=1 to get version/edition information
    const url = `${this.baseUrl}/collection?username=${this.username}&own=1&subtype=${subtype}&version=1${subtype === 'boardgame' ? '&excludesubtype=boardgameexpansion' : ''}`;
    
    try {
      const response = await this.retryRequest(url, label);

      const result = await this.parser.parseStringPromise(response.data);
      if (!result.items) {
        console.error(`❌ Erro: Resposta inválida do BGG para ${label}`);
        return [];
      }

      const items = result.items.item || [];
      return this.processGames(items, label);
      
    } catch (err) {
      console.error(`❌ Erro ao buscar coleção (${label}):`, err.message);
      return [];
    }
  }

  processGames(items, label) {
    if (!Array.isArray(items)) {
      console.warn('⚠️ Items não é um array válido');
      return [];
    }

    return items.map((item, index) => {
      try {
        return {
          num: index + 1,
          id: String(item.objectid || item.$.objectid || ''),
          name: String(this.extractName(item) || 'Desconhecido'),
          subtype: String(item.subtype || item.$.subtype || label),
          type: label,
          isExpansion: label === 'expansion',
          year: String(item.yearpublished || item.yearpublished?.[0] || 'N/A'),
          image: String(item.image || item.image?.[0] || ''),
          thumbnail: String(item.thumbnail || item.thumbnail?.[0] || ''),
          numplays: this.parseNumber(item.numplays || item.numplays?.[0] || '0'),
          comment: String(item.comment || item.comment?.[0] || ''),
          // Campos específicos do BGG
          bggId: String(item.objectid || item.$.objectid || ''),
          versionId: String(item.collid || item.versionid || item.$?.versionid || '0'), // Use collid as unique identifier, fallback to versionid or default
          owned: true, // Sempre true pois estamos buscando jogos owned
          rating: this.parseRating(item.rating),
          bggRating: this.parseRating(item.rating)
        };
      } catch (error) {
        console.warn(`⚠️ Erro ao processar jogo do BGG:`, error.message, item);
        return null;
      }
    }).filter(game => game !== null && game.id); // Remove jogos inválidos
  }

  extractName(item) {
    // Diferentes estruturas possíveis do nome no XML do BGG
    if (item.name) {
      if (typeof item.name === 'string') {
        return item.name;
      }
      if (Array.isArray(item.name)) {
        return item.name[0]?._ || item.name[0] || '';
      }
      if (typeof item.name === 'object') {
        return item.name._ || item.name.value || '';
      }
    }
    return '';
  }

  parseNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  parseRating(rating) {
    if (!rating) return null;
    const parsed = parseFloat(rating);
    return isNaN(parsed) ? null : parsed;
  }

  async retryRequest(url, label) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: this.requestTimeout,
          headers: {
            'User-Agent': 'BGG-Ludopedia-Sync/1.0'
          }
        });
        
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

  // Método para testar conexão com BGG
  async testConnection() {
    try {
      console.log('🔍 Testando conexão com BGG...');
      
      const response = await axios.get(`${this.baseUrl}/collection?username=boardgamegeek&own=1&page=1`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'BGG-Ludopedia-Sync/1.0'
        }
      });
      
      if (response.status === 200) {
        console.log('✅ Conexão com BGG OK');
        return { success: true };
      } else {
        console.warn('⚠️ Resposta inesperada do BGG');
        return { success: false, error: 'Resposta inválida' };
      }
      
    } catch (error) {
      console.error('❌ Erro ao testar conexão com BGG:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = BGGApi;