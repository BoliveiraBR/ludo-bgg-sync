require('dotenv').config();
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function testDynamicContent() {
  console.log('🧪 Teste de Conteúdo Dinâmico BGG\n');
  
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
  
  // Primeira requisição - HTML inicial
  console.log('1️⃣ PRIMEIRA REQUISIÇÃO - HTML inicial');
  const response1 = await client.get('https://boardgamegeek.com/data_dumps/bg_ranks', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  
  console.log(`📄 Tamanho: ${response1.data.length} chars`);
  console.log(`📄 Links <a>: ${(response1.data.match(/<a[^>]*>/g) || []).length}`);
  console.log(`📄 "Click to Download": ${response1.data.includes('Click to Download')}`);
  
  // Analisar JavaScript/Angular
  console.log('\n🔍 ANÁLISE DO JAVASCRIPT:');
  
  const jsPatterns = [
    { name: 'ng-app', regex: /ng-app="([^"]*)"/ },
    { name: 'Angular modules', regex: /angular\.module\([^)]*\)/g },
    { name: 'AJAX calls', regex: /\$http|axios|fetch|XMLHttpRequest/g },
    { name: 'API endpoints', regex: /\/api\/[^"'\s]*/g },
    { name: 'Data loading', regex: /data[_-]?dump|bg[_-]?rank/gi }
  ];
  
  jsPatterns.forEach(pattern => {
    const matches = response1.data.match(pattern.regex);
    if (matches) {
      console.log(`   ${pattern.name}: ${matches.length} encontradas`);
      if (matches.length < 5) {
        matches.forEach(match => console.log(`      - ${match}`));
      } else {
        console.log(`      - ${matches.slice(0, 3).join(', ')}... (+${matches.length - 3})`);
      }
    } else {
      console.log(`   ${pattern.name}: ❌ não encontrado`);
    }
  });
  
  // Procurar por possíveis endpoints AJAX
  console.log('\n🔍 PROCURANDO ENDPOINTS AJAX:');
  
  const urlPatterns = [
    /["']\/[^"'\s]*data[^"'\s]*["']/gi,
    /["']\/api\/[^"'\s]*["']/gi,
    /["']https?:\/\/[^"'\s]*dump[^"'\s]*["']/gi,
    /url\s*:\s*["']([^"']*)["']/gi
  ];
  
  urlPatterns.forEach((pattern, i) => {
    const matches = response1.data.match(pattern);
    if (matches) {
      console.log(`   Padrão ${i+1}: ${matches.length} URLs encontradas`);
      matches.slice(0, 5).forEach(match => console.log(`      - ${match}`));
    }
  });
  
  // Segunda requisição com delay (simular JS loading)
  console.log('\n2️⃣ SEGUNDA REQUISIÇÃO - Após 3 segundos');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const response2 = await client.get('https://boardgamegeek.com/data_dumps/bg_ranks', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache'
    }
  });
  
  console.log(`📄 Tamanho: ${response2.data.length} chars`);
  console.log(`📄 Diferença: ${response2.data.length - response1.data.length} chars`);
  console.log(`📄 Links <a>: ${(response2.data.match(/<a[^>]*>/g) || []).length}`);
  console.log(`📄 "Click to Download": ${response2.data.includes('Click to Download')}`);
  
  // Terceira requisição com headers de AJAX
  console.log('\n3️⃣ TERCEIRA REQUISIÇÃO - Headers AJAX');
  
  const response3 = await client.get('https://boardgamegeek.com/data_dumps/bg_ranks', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://boardgamegeek.com/data_dumps/bg_ranks'
    }
  });
  
  console.log(`📄 Tamanho: ${response3.data.length} chars`);
  console.log(`📄 Content-Type: ${response3.headers['content-type']}`);
  console.log(`📄 Links <a>: ${(response3.data.match(/<a[^>]*>/g) || []).length}`);
  console.log(`📄 "Click to Download": ${response3.data.includes('Click to Download')}`);
  
  // Tentar endpoints específicos que podem retornar JSON/dados
  console.log('\n4️⃣ TESTANDO ENDPOINTS ESPECÍFICOS:');
  
  const endpointsToTest = [
    '/data_dumps/bg_ranks/data',
    '/data_dumps/bg_ranks.json', 
    '/api/data_dumps/bg_ranks',
    '/xmlapi2/data_dumps/bg_ranks'
  ];
  
  for (const endpoint of endpointsToTest) {
    try {
      const testUrl = `https://boardgamegeek.com${endpoint}`;
      console.log(`\n🔗 Testando: ${testUrl}`);
      
      const testResponse = await client.get(testUrl, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 5000,
        validateStatus: () => true
      });
      
      console.log(`   Status: ${testResponse.status}`);
      console.log(`   Content-Type: ${testResponse.headers['content-type'] || 'N/A'}`);
      console.log(`   Tamanho: ${testResponse.data.length} chars`);
      
      if (testResponse.status === 200) {
        const hasDownload = testResponse.data.toString().toLowerCase().includes('download');
        const hasClickToDownload = testResponse.data.toString().includes('Click to Download');
        console.log(`   Contém "download": ${hasDownload}`);
        console.log(`   Contém "Click to Download": ${hasClickToDownload}`);
        
        if (hasClickToDownload) {
          console.log('   🎯 ENCONTROU LINK! Salvando resposta...');
          const fs = require('fs');
          fs.writeFileSync(`./found_endpoint_${endpoint.replace(/\//g, '_')}.txt`, testResponse.data);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }
  
  // Comparar com arquivo salvo anteriormente (se existir)
  console.log('\n5️⃣ COMPARAÇÃO COM ARQUIVO ANTERIOR:');
  
  const fs = require('fs');
  if (fs.existsSync('./bgg_page_debug.html')) {
    const previousContent = fs.readFileSync('./bgg_page_debug.html', 'utf8');
    console.log(`📄 Arquivo anterior: ${previousContent.length} chars`);
    console.log(`📄 Arquivo atual: ${response1.data.length} chars`);
    console.log(`📄 São idênticos: ${previousContent === response1.data}`);
    
    if (previousContent !== response1.data) {
      console.log('⚠️ Conteúdo mudou! Salvando nova versão...');
      fs.writeFileSync('./bgg_page_new.html', response1.data);
    }
  }
  
  console.log('\n🏁 Teste concluído!');
}

testDynamicContent().catch(console.error);