#!/usr/bin/env node

const axios = require('axios');

async function testLoadCollections() {
  try {
    console.log('🧪 Testando carregamento de coleções do arquivo...');
    
    const response = await axios.post('http://localhost:8080/api/collections', {
      loadType: 'file'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = response.data;
    
    console.log('\n📊 Resultados:');
    console.log(`BGG Collection: ${data.bggCollection.length} jogos`);
    console.log(`Ludopedia Collection: ${data.ludoCollection.length} jogos`);
    
    if (data.bggCollection.length > 0) {
      const bggBase = data.bggCollection.filter(g => !g.isExpansion).length;
      const bggExp = data.bggCollection.filter(g => g.isExpansion).length;
      console.log(`BGG: ${bggBase} base games, ${bggExp} expansions`);
      console.log('Sample BGG game:', JSON.stringify(data.bggCollection[0], null, 2));
    }
    
    if (data.ludoCollection.length > 0) {
      const ludoBase = data.ludoCollection.filter(g => !g.isExpansion).length;
      const ludoExp = data.ludoCollection.filter(g => g.isExpansion).length;
      console.log(`Ludopedia: ${ludoBase} base games, ${ludoExp} expansions`);
      console.log('Sample Ludo game:', JSON.stringify(data.ludoCollection[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

async function testFindMatches() {
  try {
    console.log('\n🔍 Testando busca de matches...');
    
    // Primeiro carregar as coleções
    const collectionsResponse = await axios.post('http://localhost:8080/api/collections', {
      loadType: 'file'
    });
    
    const { bggCollection, ludoCollection } = collectionsResponse.data;
    
    // Depois buscar matches
    const matchesResponse = await axios.post('http://localhost:8080/api/match-collections', {
      bggCollection,
      ludoCollection
    });
    
    const matchData = matchesResponse.data;
    
    console.log('\n🎯 Resultados dos Matches:');
    console.log(`Perfect matches: ${matchData.matches.length}`);
    console.log(`Only in BGG: ${matchData.onlyInBGG.length}`);
    console.log(`Only in Ludopedia: ${matchData.onlyInLudo.length}`);
    console.log(`Previous matches: ${matchData.previousMatchCount}`);
    
    if (matchData.matches.length > 0) {
      console.log('Sample match:', JSON.stringify(matchData.matches[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Erro nos matches:', error.response?.data || error.message);
  }
}

async function main() {
  await testLoadCollections();
  await testFindMatches();
}

main().catch(console.error);
