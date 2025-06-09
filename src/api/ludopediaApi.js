const axios = require('axios');

class LudopediaApi {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseUrl = 'https://ludopedia.com.br/api/v1';
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 segundos entre tentativas
    this.pageSize = 100; // Máximo permitido pela API
    this.requestDelay = 500; // Delay entre requisições para evitar rate limiting
  }

  async fetchCollection() {
    console.log('📦 Buscando coleção da Ludopedia...');
    
    if (!this.accessToken) {
      throw new Error('Token de acesso da Ludopedia não fornecido');
    }

    try {
      // Testar conexão primeiro
      await this.testConnection();
      
      const collection = [];
      let totalFetched = 0;
      
      // Buscar jogos base
      console.log('📦 Buscando jogos base da Ludopedia...');
      const baseGames = await this.fetchCollectionByType('b', 'base');
      collection.push(...baseGames);
      totalFetched += baseGames.length;
      console.log(`✅ ${baseGames.length} jogos base carregados`);
      
      // Buscar expansões
      console.log('📦 Buscando expansões da Ludopedia...');
      const expansions = await this.fetchCollectionByType('e', 'expansion');
      collection.push(...expansions);
      totalFetched += expansions.length;
      console.log(`✅ ${expansions.length} expansões carregadas`);

      console.log(`📊 Ludopedia: Total de ${totalFetched} jogos carregados`);
      console.log(`📊 Ludopedia: ${baseGames.length} jogos base, ${expansions.length} expansões`);
      
      return collection;
      
    } catch (error) {
      console.error('❌ Erro ao buscar coleção da Ludopedia:', error.message);
      throw error;
    }
  }

  async fetchCollectionByType(tipoJogo, subtypeLabel) {
    console.log(`📄 Carregando ${subtypeLabel === 'base' ? 'jogos base' : 'expansões'}...`);
    
    const collection = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        console.log(`📄 Página ${currentPage} (${subtypeLabel})...`);
        
        const pageData = await this.fetchCollectionPage(tipoJogo, currentPage);
        
        if (pageData && pageData.length > 0) {
          const processedGames = this.processGames(pageData, subtypeLabel, collection.length);
          collection.push(...processedGames);
          
          console.log(`📊 Página ${currentPage}: ${processedGames.length} jogos carregados`);
          
          // Se recebeu menos que o tamanho da página, não há mais páginas
          hasMorePages = pageData.length === this.pageSize;
          currentPage++;
          
          // Proteção contra loop infinito
          if (currentPage > 100) {
            console.warn('⚠️ Limite máximo de páginas atingido (100), parando...');
            break;
          }
          
          // Delay entre requisições para evitar rate limiting
          if (hasMorePages) {
            await new Promise(resolve => setTimeout(resolve, this.requestDelay));
          }
        } else {
          hasMorePages = false;
        }
        
      } catch (error) {
        console.error(`❌ Erro ao buscar página ${currentPage} (${subtypeLabel}):`, error.message);
        
        // Se for erro de autenticação, parar imediatamente
        if (error.response?.status === 401) {
          throw new Error('Token de acesso da Ludopedia expirado ou inválido');
        }
        
        // Para outros erros, parar após algumas tentativas
        hasMorePages = false;
      }
    }
    
    console.log(`✅ ${subtypeLabel}: ${collection.length} jogos carregados em ${currentPage - 1} páginas`);
    return collection;
  }

  async fetchCollectionPage(tipoJogo, page) {
    const url = `${this.baseUrl}/colecao`;
    const params = {
      lista: 'colecao',
      tp_jogo: tipoJogo,
      page: page,
      rows: this.pageSize,
      ordem: 'nomecomo'
    };
    
    try {
      const response = await this.retryRequest(url, params);
      
      if (!response.data || !response.data.colecao) {
        console.warn(`⚠️ Página ${page}: Resposta inválida da API da Ludopedia`);
        return [];
      }

      return response.data.colecao;
      
    } catch (error) {
      console.error(`❌ Erro ao buscar página ${page}:`, error.message);
      throw error;
    }
  }

  async retryRequest(url, params) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'User-Agent': 'BGG-Ludopedia-Sync/1.0',
            'Accept': 'application/json'
          },
          params: params,
          timeout: 30000 // 30 segundos de timeout
        });
        
        return response;
        
      } catch (error) {
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Se for erro de rate limiting (429), espera mais tempo
        const delay = error.response?.status === 429 ? this.retryDelay * 2 : this.retryDelay;
        
        console.log(`⚠️ Ludopedia: Tentativa ${attempt}/${this.maxRetries} falhou (${error.response?.status || error.code}), tentando novamente em ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  processGames(rawGames, subtypeLabel, currentIndex) {
    if (!Array.isArray(rawGames)) {
      console.warn('⚠️ Dados da coleção da Ludopedia não são um array válido');
      return [];
    }

    return rawGames.map((jogo, index) => {
      try {
        return {
          num: currentIndex + index + 1,
          id: String(jogo.id_jogo || ''),
          name: String(jogo.nm_jogo || 'Jogo Desconhecido').trim(),
          type: subtypeLabel,
          isExpansion: subtypeLabel === 'expansion',
          year: String(jogo.nr_ano_publicacao || jogo.ano || 'N/A'),
          rating: this.parseRating(jogo.vl_nota || jogo.nota),
          favorite: this.parseFavorite(jogo.fl_favorito || jogo.favorito),
          comment: String(jogo.comentario || ''),
          cost: this.parseCost(jogo.vl_custo || jogo.custo),
          link: String(jogo.link || ''),
          // Campos adicionais da Ludopedia
          ludopediaId: String(jogo.id_jogo || ''),
          thumbnail: String(jogo.thumbnail || ''),
          image: String(jogo.imagem || jogo.image || '')
        };
      } catch (error) {
        console.warn(`⚠️ Erro ao processar jogo da Ludopedia:`, error.message, jogo);
        return null;
      }
    }).filter(game => game !== null && game.id); // Remove jogos inválidos
  }

  parseRating(rating) {
    if (!rating) return null;
    const parsed = parseFloat(rating);
    return isNaN(parsed) ? null : parsed;
  }

  parseFavorite(favorite) {
    if (typeof favorite === 'boolean') return favorite;
    if (typeof favorite === 'string') {
      return favorite === '1' || favorite.toLowerCase() === 'true';
    }
    if (typeof favorite === 'number') {
      return favorite === 1;
    }
    return false;
  }

  parseCost(cost) {
    if (!cost) return null;
    const parsed = parseFloat(cost);
    return isNaN(parsed) ? null : parsed;
  }

  // Método para testar a conexão com a API
  async testConnection() {
    try {
      console.log('🔍 Testando conexão com a API da Ludopedia...');
      
      const response = await axios.get(`${this.baseUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'User-Agent': 'BGG-Ludopedia-Sync/1.0'
        },
        timeout: 10000
      });
      
      if (response.data && (response.data.usuario || response.data.user)) {
        const username = response.data.usuario || response.data.user || response.data.name;
        console.log(`✅ Conexão com Ludopedia OK. Usuário: ${username}`);
        return { success: true, user: username };
      } else {
        console.warn('⚠️ Resposta inesperada da API da Ludopedia');
        return { success: false, error: 'Resposta inválida' };
      }
      
    } catch (error) {
      console.error('❌ Erro ao testar conexão com Ludopedia:', error.message);
      
      if (error.response?.status === 401) {
        throw new Error('Token de acesso da Ludopedia expirado ou inválido');
      }
      
      throw new Error(`Falha na conexão com Ludopedia: ${error.message}`);
    }
  }
}

module.exports = LudopediaApi;