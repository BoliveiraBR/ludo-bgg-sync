require('dotenv').config();
const BGGApi = require('../api/bggApi');
const LudopediaApi = require('../api/ludopediaApi');
const CollectionLoader = require('../collection/loader');
const CollectionMatcher = require('../comparison/matcher');
const ChatGPTMatcher = require('../comparison/chatGptMatch');

async function main() {
  const bggApi = new BGGApi(process.env.ID_BGG);
  const ludoApi = new LudopediaApi(process.env.LUDO_ACCESS_TOKEN);
  const chatGptMatcher = new ChatGPTMatcher(process.env.OPENAI_API_KEY);

  // Carregar coleções
  //const bggCollection = CollectionLoader.loadFromFile('BGGCollection.txt');
  //const ludoCollection = CollectionLoader.loadFromFile('LudopediaCollection.txt');

  // Carregar coleções via API
  console.log('📦 Carregando coleções via APIs...');
  
  const [bggCollection, ludoCollection] = await Promise.all([
    bggApi.fetchCollection(),
    ludoApi.fetchCollection()
  ]);

  // Salvar coleções em arquivo para uso futuro
  CollectionLoader.saveToFile(bggCollection, 'BGGCollection.txt');
  CollectionLoader.saveToFile(ludoCollection, 'LudopediaCollection.txt');

  // Verificar se as coleções foram carregadas
  if (!bggCollection.length || !ludoCollection.length) {
    console.error('❌ Erro: Uma ou ambas as coleções não puderam ser carregadas via API');
    return;
  }

  //console.log(`✔ Carregados ${bggCollection.length} itens do BGG`);
  //console.log(`✔ Carregados ${ludoCollection.length} itens da Ludopedia`);
  console.log(`✔ Carregados ${bggCollection.length} itens do BGG via API`);
  console.log(`✔ Carregados ${ludoCollection.length} itens da Ludopedia via API`);

  // Comparar coleções usando match exato
  const comparison = CollectionMatcher.compareCollections(bggCollection, ludoCollection);
  
  // Buscar matches adicionais via ChatGPT para os jogos que não deram match
  const extraMatches = await chatGptMatcher.findMatches(
    comparison.onlyInBGG,
    comparison.onlyInLudo
  );

  // Combinar resultados
  const allMatches = [
    ...comparison.matches.map(name => [name, name]), // matches exatos
    ...extraMatches // matches do ChatGPT
  ];

  // Atualizar listas removendo os jogos que foram encontrados via ChatGPT
  const matchedFromBGG = new Set(extraMatches.map(m => m[1].toLowerCase()));
  const matchedFromLudo = new Set(extraMatches.map(m => m[0].toLowerCase()));

  const updatedOnlyInBGG = comparison.onlyInBGG
    .filter(game => !matchedFromBGG.has(game.toLowerCase()));
  const updatedOnlyInLudo = comparison.onlyInLudo
    .filter(game => !matchedFromLudo.has(game.toLowerCase()));

  // Preparar linhas de output
  const outputLines = [];

  // Adicionar jogos em comum
  outputLines.push('🧩 Jogos em comum:');
  allMatches.forEach(([ludoName, bggName]) => {
    if (ludoName === bggName) {
      outputLines.push(`- ${ludoName}`);
    } else {
      outputLines.push(`- ${ludoName} ⇄ ${bggName}`);
    }
  });
  outputLines.push('');

  // Adicionar jogos exclusivos do BGG
  outputLines.push('📘 Somente no BGG:');
  updatedOnlyInBGG.forEach(game => outputLines.push(`- ${game}`));
  outputLines.push('');

  // Adicionar jogos exclusivos da Ludopedia
  outputLines.push('📙 Somente na Ludopedia:');
  updatedOnlyInLudo.forEach(game => outputLines.push(`- ${game}`));

  // Salvar resultado em arquivo
  CollectionLoader.saveToFile(outputLines, 'CollectionComparison.txt');

  // Exibir estatísticas
  console.log('\n📊 Estatísticas da comparação de jogos base:');
  console.log(`✔ Total de matches exatos: ${comparison.matches.length}`);
  console.log(`🤖 Matches encontrados via ChatGPT: ${extraMatches.length}`);
  console.log(`📘 Somente no BGG: ${updatedOnlyInBGG.length}`);
  console.log(`📙 Somente na Ludopedia: ${updatedOnlyInLudo.length}`);
  console.log('📄 Resultado completo salvo em CollectionComparison.txt');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});