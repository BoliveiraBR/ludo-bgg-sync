require('dotenv').config();
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function testApiEndpoints() {
  console.log('🧪 Teste de Endpoints API BGG\n');
  
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
  
  // Endpoints API encontrados na análise anterior
  const apiEndpoints = [
    '/api/amazon',
    '/api/files', 
    '/api/geekitems',
    '/api/collectionstatsgraph',
    '/api/images',
    '/api/data', // Pode ser relacionado
    '/api/export', // Pode ser relacionado
    '/api/download', // Pode ser relacionado
    // Variações possíveis baseadas no contexto
    '/api/data_dumps',
    '/api/datadumps', 
    '/api/bg_ranks',
    '/api/ranks',
    '/api/csv',
    '/api/files/data_dumps',
    '/api/files/bg_ranks'
  ];
  
  console.log(`🔗 Testando ${apiEndpoints.length} endpoints API...\n`);
  
  for (const endpoint of apiEndpoints) {
    try {
      const url = `https://boardgamegeek.com${endpoint}`;
      console.log(`📡 ${endpoint}`);
      
      const response = await client.get(url, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000,
        validateStatus: () => true // Aceitar qualquer status
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Content-Type: ${response.headers['content-type'] || 'N/A'}`);
      console.log(`   Size: ${response.data ? response.data.length : 0} chars`);
      
      if (response.status === 200 && response.data) {
        const dataStr = response.data.toString();
        
        // Verificar se contém dados interessantes
        const indicators = [
          { name: 'JSON', test: () => dataStr.startsWith('{') || dataStr.startsWith('[') },
          { name: 'CSV', test: () => dataStr.includes(',') && dataStr.includes('\n') },
          { name: 'Download link', test: () => dataStr.toLowerCase().includes('download') },
          { name: 'ZIP/CSV file', test: () => dataStr.includes('.zip') || dataStr.includes('.csv') },
          { name: 'Data dump', test: () => dataStr.toLowerCase().includes('data') && dataStr.toLowerCase().includes('dump') },
          { name: 'Click to Download', test: () => dataStr.includes('Click to Download') }
        ];
        
        const foundIndicators = indicators.filter(ind => ind.test()).map(ind => ind.name);
        
        if (foundIndicators.length > 0) {
          console.log(`   🎯 Indicadores: ${foundIndicators.join(', ')}`);
          
          // Se encontrou algo interessante, salvar amostra
          if (foundIndicators.includes('Click to Download') || foundIndicators.includes('Download link')) {
            const fs = require('fs');
            const filename = `./api_response_${endpoint.replace(/\//g, '_')}.txt`;
            fs.writeFileSync(filename, dataStr.substring(0, 5000)); // Primeiros 5KB
            console.log(`   📄 Amostra salva: ${filename}`);
          }
          
          // Se é JSON, tentar parsear
          if (foundIndicators.includes('JSON')) {
            try {
              const jsonData = JSON.parse(dataStr);
              console.log(`   📊 JSON keys: ${Object.keys(jsonData).slice(0, 5).join(', ')}`);
            } catch (e) {
              console.log(`   ⚠️ Não é JSON válido`);
            }
          }
          
          // Se pode ser CSV, mostrar primeira linha
          if (foundIndicators.includes('CSV')) {
            const firstLine = dataStr.split('\n')[0];
            console.log(`   📄 Primeira linha CSV: ${firstLine.substring(0, 100)}...`);
          }
        }
        
        // Mostrar primeira linha para debug se for pequeno
        if (dataStr.length < 200) {
          console.log(`   📄 Conteúdo: ${dataStr.trim()}`);
        }
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}\n`);
    }
  }
  
  // Testar parâmetros específicos nos endpoints que funcionaram
  console.log('🔗 Testando endpoints com parâmetros...\n');
  
  const parametersToTest = [
    { endpoint: '/api/files', params: '?type=data_dump' },
    { endpoint: '/api/files', params: '?category=bg_ranks' },
    { endpoint: '/api/files', params: '/bg_ranks' },
    { endpoint: '/api/files', params: '/data_dumps' },
    { endpoint: '/api/geekitems', params: '?objecttype=datadump' },
    { endpoint: '/api/geekitems', params: '?type=file' }
  ];
  
  for (const test of parametersToTest) {
    try {
      const url = `https://boardgamegeek.com${test.endpoint}${test.params}`;
      console.log(`📡 ${test.endpoint}${test.params}`);
      
      const response = await client.get(url, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 10000,
        validateStatus: () => true
      });
      
      console.log(`   Status: ${response.status}`);
      
      if (response.status === 200 && response.data) {
        const dataStr = response.data.toString();
        const hasDownload = dataStr.toLowerCase().includes('download');
        const hasClickToDownload = dataStr.includes('Click to Download');
        
        console.log(`   Contém "download": ${hasDownload}`);
        console.log(`   Contém "Click to Download": ${hasClickToDownload}`);
        
        if (hasClickToDownload) {
          console.log('   🎯🎯🎯 FOUND IT! 🎯🎯🎯');
          const fs = require('fs');
          fs.writeFileSync('./FOUND_ENDPOINT.txt', `URL: ${url}\n\n${dataStr}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('🏁 Teste de APIs concluído!');
}

testApiEndpoints().catch(console.error);