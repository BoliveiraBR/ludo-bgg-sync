const fs = require('fs');
const path = require('path');

class CollectionLoader {
  /**
   * Carrega uma coleção de jogos a partir de um arquivo
   * @param {string} filename Nome do arquivo a ser carregado
   * @returns {Array} Array com a coleção de jogos
   */
  static loadFromFile(filename) {
    try {
      // Resolve o caminho relativo ao diretório de dados
      const filePath = path.join(__dirname, '../../data', filename);
      
      // Verifica se o arquivo existe
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Arquivo não encontrado: ${filename}`);
        return [];
      }

      // Lê e processa o arquivo
      let data = fs.readFileSync(filePath, { encoding: 'utf8' });
      data = data.replace(/^\uFEFF/, ''); // remove BOM se presente
      return JSON.parse(data);
    } catch (error) {
      console.error(`❌ Erro ao carregar ${filename}:`, error.message);
      return [];
    }
  }

  /**
   * Salva uma coleção de jogos em arquivo
   * @param {Array} collection Coleção a ser salva
   * @param {string} filename Nome do arquivo de destino
   */
  static saveToFile(collection, filename) {
    try {
      const filePath = path.join(__dirname, '../../data', filename);
      fs.writeFileSync(
        filePath, 
        '\uFEFF' + JSON.stringify(collection, null, 2), 
        { encoding: 'utf8' }
      );
      console.log(`✔ ${collection.length} itens salvos em ${filename}`);
    } catch (error) {
      console.error(`❌ Erro ao salvar ${filename}:`, error.message);
    }
  }
}

module.exports = CollectionLoader;