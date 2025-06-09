#!/usr/bin/env node

const CollectionLoader = require('./src/collection/loader');
const CollectionMatcher = require('./src/comparison/matcher');

async function testMatcherDirect() {
  console.log('🧪 Testando CollectionMatcher diretamente (ignorando matches prévios)...');
  
  // Carregar coleções
  const bggCollection = CollectionLoader.loadFromFile('BGGCollection-AcemanBR.txt');
  const ludoCollection = CollectionLoader.loadFromFile('LudopediaCollection-AcemanBR.txt');
  
  console.log(`\n📊 Coleções carregadas:`);
  console.log(`BGG: ${bggCollection.length} jogos`);
  console.log(`Ludopedia: ${ludoCollection.length} jogos`);
  
  // Testar o matcher
  const comparison = CollectionMatcher.compareCollections(bggCollection, ludoCollection);
  
  console.log(`\n🎯 Resultados do Matcher (SEM filtrar matches prévios):`);
  console.log(`Perfect matches: ${comparison.matches.length}`);
  console.log(`Only in BGG: ${comparison.onlyInBGG.length}`);
  console.log(`Only in Ludopedia: ${comparison.onlyInLudo.length}`);
  
  if (comparison.matches.length > 0) {
    console.log('\n🎮 Primeiros 5 matches encontrados:');
    comparison.matches.slice(0, 5).forEach((match, index) => {
      console.log(`${index + 1}. ${match}`);
    });
  }
  
  // Verificar tipos de jogos nos matches
  if (bggCollection.length > 0 && ludoCollection.length > 0) {
    const bggByType = bggCollection.reduce((acc, game) => {
      const type = game.isExpansion ? 'expansion' : 'base';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    const ludoByType = ludoCollection.reduce((acc, game) => {
      const type = game.isExpansion ? 'expansion' : 'base';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`\n📈 Distribuição por tipo:`);
    console.log(`BGG: ${bggByType.base || 0} base, ${bggByType.expansion || 0} expansões`);
    console.log(`Ludopedia: ${ludoByType.base || 0} base, ${ludoByType.expansion || 0} expansões`);
  }
}

testMatcherDirect().catch(console.error);
