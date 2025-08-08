require('dotenv').config();
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function testCSVEndpoints() {
  console.log('🧪 Teste de Endpoints CSV BGG\n');
  
  const bggLogin = process.env.MASTER_BGG_LOGIN;
  const bggPassword = process.env.MASTER_BGG_PASSWORD;
  
  // Fazer login
  const cookieJar = new tough.CookieJar();
  const client = wrapper(axios.create({ jar: cookieJar }));
  
  await client.post('https://boardgamegeek.com/login/api/v1', {
    credentials: { username: bggLogin, password: bggPassword }
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
  
  console.log('✅ Login realizado\n');
  
  // Endpoints possíveis para CSV
  const endpoints = [
    'https://boardgamegeek.com/data_dumps/bg_ranks.csv',
    'https://boardgamegeek.com/data_dumps/bg_ranks?format=csv',
    'https://boardgamegeek.com/data_dumps/bg_ranks/download',
    'https://boardgamegeek.com/data_dumps/bg_ranks/csv',
    'https://boardgamegeek.com/xmlapi2/data_dumps/bg_ranks',
    'https://api.geekdo.com/data_dumps/bg_ranks',
    'https://boardgamegeek.com/api/data_dumps/bg_ranks.csv',
    'https://boardgamegeek.com/exports/bg_ranks.csv',
    'https://boardgamegeek.com/data/bg_ranks.csv'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🔗 Testando: ${endpoint}`);
      
      const response = await client.get(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/csv,application/csv,text/plain,*/*'
        },
        timeout: 10000,
        validateStatus: () => true
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Content-Type: ${response.headers['content-type'] || 'N/A'}`);
      console.log(`   Tamanho: ${(response.data.length / 1024).toFixed(2)} KB`);
      
      // Verificar se parece com CSV
      const firstLine = response.data.split('\n')[0] || '';
      const isCSV = firstLine.includes(',') && 
                   (firstLine.toLowerCase().includes('id') || 
                    firstLine.toLowerCase().includes('name') ||
                    firstLine.toLowerCase().includes('rank'));
      
      if (isCSV) {
        console.log(`   🎯 PARECE SER CSV! Primeira linha: ${firstLine.substring(0, 100)}...`);
        
        // Salvar amostra
        const fs = require('fs');
        fs.writeFileSync('./sample_csv.txt', response.data.substring(0, 2000));
        console.log(`   📄 Amostra salva em: ./sample_csv.txt`);
      } else if (response.data.startsWith('<!DOCTYPE') || response.data.startsWith('<html')) {
        console.log(`   📄 HTML retornado`);
      } else {
        console.log(`   📄 Primeira linha: ${firstLine.substring(0, 100)}...`);
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}\n`);
    }
  }
  
  // Tentar também via XMLHttpRequest simulado (pode ser que seja carregado via JS)
  console.log('🔄 Tentando métodos alternativos...\n');
  
  try {
    console.log('📡 Testando com headers de XMLHttpRequest...');
    const xhr = await client.get('https://boardgamegeek.com/data_dumps/bg_ranks', {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'text/csv,application/csv,application/json,*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    console.log(`   Status: ${xhr.status}`);
    console.log(`   Content-Type: ${xhr.headers['content-type']}`);
    console.log(`   Tamanho: ${(xhr.data.length / 1024).toFixed(2)} KB`);
    
    const firstLine = xhr.data.split('\n')[0] || '';
    if (firstLine.includes(',')) {
      console.log(`   🎯 POSSÍVEL CSV: ${firstLine.substring(0, 100)}...`);
    }
    
  } catch (error) {
    console.log(`   ❌ Erro XMLHttpRequest: ${error.message}`);
  }
}

testCSVEndpoints().catch(console.error);