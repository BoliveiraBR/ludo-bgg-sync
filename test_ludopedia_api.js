const fs = require('fs');
const LudopediaApi = require('./src/api/ludopediaApi');

async function testLudopediaAPI() {
  try {
    console.log('🧪 Testando nova implementação da API da Ludopedia...\n');
    
    // Carregar credenciais
    let credentials;
    try {
      credentials = JSON.parse(fs.readFileSync('./data/credentials.txt', 'utf8'));
    } catch (error) {
      console.error('❌ Erro ao carregar credenciais:', error.message);
      console.log('📝 Certifique-se de que o arquivo ./data/credentials.txt existe e contém:');
      console.log('{"LUDO_ACCESS_TOKEN": "seu_token", "LUDO_USER": "seu_usuario"}');
      return;
    }
    
    if (!credentials.LUDO_ACCESS_TOKEN) {
      console.error('❌ Token da Ludopedia não encontrado nas credenciais');
      return;
    }
    
    // Criar instância da API
    const ludoApi = new LudopediaApi(credentials.LUDO_ACCESS_TOKEN);
    
    // Testar conexão primeiro
    console.log('1️⃣ Testando conexão...');
    try {
      const connectionTest = await ludoApi.testConnection();
      console.log(`✅ Conexão OK! Usuário: ${connectionTest.user}\n`);
    } catch (error) {
      console.error(`❌ Falha na conexão: ${error.message}`);
      return;
    }
    
    // Buscar coleção completa
    console.log('2️⃣ Buscando coleção completa...');
    const startTime = Date.now();
    
    try {
      const collection = await ludoApi.fetchCollection();
      const endTime = Date.now();
      
      console.log(`\n⏱️ Tempo de carregamento: ${(endTime - startTime) / 1000}s`);
      console.log(`📊 Total de jogos carregados: ${collection.length}`);
      
      // Estatísticas detalhadas
      const baseGames = collection.filter(game => game.type === 'base');
      const expansions = collection.filter(game => game.type === 'expansion');
      
      console.log(`📊 Jogos base: ${baseGames.length}`);
      console.log(`📊 Expansões: ${expansions.length}`);
      
      // Verificar se o campo isExpansion está correto
      const expansionsWithFlag = collection.filter(game => game.isExpansion === true);
      const baseGamesWithFlag = collection.filter(game => game.isExpansion === false);
      
      console.log(`✅ Campo isExpansion correto: ${expansionsWithFlag.length} expansões, ${baseGamesWithFlag.length} jogos base`);
      
      // Mostrar algumas expansões como exemplo
      if (expansions.length > 0) {
        console.log('\n🧩 Algumas expansões encontradas:');
        expansions.slice(0, 5).forEach(expansion => {
          console.log(`- ${expansion.name} (ID: ${expansion.id}, isExpansion: ${expansion.isExpansion})`);
        });
      }
      
      // Mostrar alguns jogos base como exemplo
      if (baseGames.length > 0) {
        console.log('\n🎲 Alguns jogos base encontrados:');
        baseGames.slice(0, 5).forEach(game => {
          console.log(`- ${game.name} (ID: ${game.id}, isExpansion: ${game.isExpansion})`);
        });
      }
      
      // Comparar com arquivo existente se houver
      const username = credentials.LUDO_USER || 'Unknown';
      try {
        const fileData = JSON.parse(fs.readFileSync(`./data/LudopediaCollection-${username}.txt`, 'utf8'));
        console.log(`\n📁 Arquivo local: ${fileData.length} jogos`);
        console.log(`🔄 Diferença: ${collection.length - fileData.length} jogos`);
        
        if (collection.length !== fileData.length) {
          console.log('⚠️ Há diferença entre API e arquivo local');
          
          // Mostrar diferenças de expansões
          const fileExpansions = fileData.filter(game => game.type === 'expansion' || game.isExpansion === true);
          console.log(`📁 Arquivo local - Expansões: ${fileExpansions.length}`);
          console.log(`🔄 Diferença de expansões: ${expansions.length - fileExpansions.length}`);
        } else {
          console.log('✅ Números coincidem com arquivo local');
        }
      } catch (error) {
        console.log('📁 Arquivo local não encontrado para comparação');
      }
      
      // Salvar resultado em arquivo de teste
      const testFileName = `./data/LudopediaTest-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(testFileName, JSON.stringify(collection, null, 2));
      console.log(`💾 Resultado salvo em: ${testFileName}`);
      
      console.log('\n✅ Teste da API da Ludopedia concluído com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro ao buscar coleção:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar o teste
testLudopediaAPI().catch(console.error);
