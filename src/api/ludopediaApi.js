const axios = require('axios');

class LudopediaApi {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseUrl = 'https://ludopedia.com.br/api/v1';
  }

  async fetchCollection() {
    console.log('📦 Buscando coleção da Ludopedia...');
    const collection = [];

    try {
      // Buscar jogos base
      await this.fetchCollectionByType('b', 'base', collection);
      
      // Buscar expansões
      await this.fetchCollectionByType('e', 'expansion', collection);

      return collection;
    } catch (error) {
      console.error('❌ Erro ao buscar coleção da Ludopedia:', error.message);
      return [];
    }
  }

  async fetchCollectionByType(tipoJogo, subtypeLabel, allLudoCollection = []) {
    const pageSize = 100;
    let currentPage = 1;

    while (true) {
      const url = `${this.baseUrl}/colecao?lista=colecao&tp_jogo=${tipoJogo}&page=${currentPage}&rows=${pageSize}&ordem=nomecomo`;
      try {
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`
          }
        });

        const data = response.data;
        if (!data || !data.colecao || data.colecao.length === 0) break;

        const mapped = data.colecao.map((jogo) => ({
          num: allLudoCollection.length + 1,
          id: jogo.id_jogo,
          name: jogo.nm_jogo.trim(),
          year: jogo.nr_ano_publicacao || '',
          link: jogo.link,
          type: subtypeLabel,
          rating: jogo.vl_nota || null,
          favorite: !!jogo.fl_favorito,
          comment: jogo.comentario || '',
          cost: jogo.vl_custo || null
        }));

        allLudoCollection.push(...mapped);

        if (data.colecao.length < pageSize) break;

        currentPage++;
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`❌ Erro ao buscar tipo=${tipoJogo} página=${currentPage}:`, error.message);
        break;
      }
    }
    
    return allLudoCollection;
  }
}

module.exports = LudopediaApi;