const fs = require('fs');
const BGGApi = require('./src/api/bggApi');

async function testBGGAPI() {
  try {
    console.log('🧪 Testando nova implementação da API do BGG...\n');
    
    // Carregar credenciais
    let credentials;
    try {
      credentials = JSON.parse(fs.readFileSync('./data/credentials.txt', 'utf8'));
    } catch (error) {
      console.error('❌ Erro ao carregar credenciais:', error.message);
      console.log('📝 Certifique-se de que o arquivo ./data/credentials.txt existe e contém:');
      console.log('{"BGG_USER": "seu_usuario"}');
      return;
    }
    
    if (!credentials.BGG_USER) {
      console.error('❌ Usuário BGG não encontrado nas credenciais');
      return;
    }
    
    // Criar instância da API
    const bggApi = new BGGApi(credentials.BGG_USER);
    
    // Testar conexão primeiro
    console.log('1️⃣ Testando conexão...');
    const connectionTest = await bggApi.testConnection();
    
    if (!connectionTest.success) {
      console.error(`❌ Falha na conexão: ${connectionTest.error}`);
      return;
    }
    
    console.log('✅ Conexão com BGG OK!\n');
    
    // Buscar coleção completa
    console.log('2️⃣ Buscando coleção completa...');
    const startTime = Date.now();
    
    try {
      const collection = await bggApi.fetchCollection();
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
      
      // Verificar estrutura dos dados
      if (collection.length > 0) {
        const firstGame = collection[0];
        console.log('\n🔍 Estrutura do primeiro jogo:');
        console.log('Campos disponíveis:', Object.keys(firstGame));
        
        // Verificar se todos os jogos têm ID
        const gamesWithoutId = collection.filter(game => !game.id);
        if (gamesWithoutId.length > 0) {
          console.warn(`⚠️ ${gamesWithoutId.length} jogos sem ID encontrados`);
        } else {
          console.log('✅ Todos os jogos possuem ID');
        }
      }
      
      // Comparar com arquivo existente se houver
      try {
        const fileData = JSON.parse(fs.readFileSync(`./data/BGGCollection-${credentials.BGG_USER}.txt`, 'utf8'));
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
      const testFileName = `./data/BGGTest-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(testFileName, JSON.stringify(collection, null, 2));
      console.log(`💾 Resultado salvo em: ${testFileName}`);
      
      console.log('\n✅ Teste da API do BGG concluído com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro ao buscar coleção:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar o teste
testBGGAPI().catch(console.error);
