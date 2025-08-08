require('dotenv').config();
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function testFullPageLoad() {
  console.log('🧪 Teste de Carregamento Completo da Página\n');
  
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
  
  console.log('✅ Login realizado');
  
  try {
    console.log('📡 Carregando página com headers completos de browser...');
    
    const response = await client.get('https://boardgamegeek.com/data_dumps/bg_ranks', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'max-age=0'
      },
      timeout: 30000
    });
    
    console.log(`✅ Página carregada: ${response.status}`);
    console.log(`📄 Tamanho: ${(response.data.length / 1024).toFixed(2)} KB`);
    
    // Salvar página completa
    const fs = require('fs');
    fs.writeFileSync('./bgg_full_page.html', response.data);
    console.log('📄 Página completa salva: ./bgg_full_page.html');
    
    // Buscar variações do link de download de forma mais agressiva
    const variations = [
      /Click\s*to\s*[Dd]ownload/,
      /[Dd]ownload/,
      /href="([^"]*\.zip)"/,
      /href="([^"]*csv[^"]*)"/,
      /href="([^"]*dump[^"]*)"/,
      /data-url="([^"]*)"/,
      /onclick="[^"]*download[^"]*"/i,
      /"url":\s*"([^"]*\.zip)"/,
      /"download":\s*"([^"]*)"/
    ];
    
    console.log('\n🔍 Buscando padrões de download:');
    
    variations.forEach((pattern, i) => {
      const matches = response.data.match(pattern);
      if (matches) {
        console.log(`   ✅ Padrão ${i+1} encontrado: ${matches[0]}`);
        if (matches[1]) {
          console.log(`      URL extraída: ${matches[1]}`);
        }
      }
    });
    
    // Procurar por todos os links href
    console.log('\n🔗 Analisando todos os links:');
    const allHrefs = response.data.match(/href="([^"]*)"/g);
    if (allHrefs) {
      console.log(`   Total de links encontrados: ${allHrefs.length}`);
      
      const suspiciousLinks = allHrefs.filter(href => 
        href.toLowerCase().includes('download') ||
        href.toLowerCase().includes('csv') ||
        href.toLowerCase().includes('zip') ||
        href.toLowerCase().includes('dump') ||
        href.toLowerCase().includes('file')
      );
      
      if (suspiciousLinks.length > 0) {
        console.log(`   🎯 Links suspeitos (${suspiciousLinks.length}):`);
        suspiciousLinks.forEach(link => {
          console.log(`      ${link}`);
        });
      } else {
        console.log('   ❌ Nenhum link relacionado a download encontrado');
      }
    }
    
    // Buscar por JavaScript que pode carregar o link dinamicamente
    console.log('\n⚙️ Procurando por JavaScript relacionado:');
    const jsPatterns = [
      /data_dumps?/gi,
      /download/gi,
      /\.csv/gi,
      /\.zip/gi
    ];
    
    jsPatterns.forEach((pattern, i) => {
      const matches = response.data.match(pattern);
      if (matches && matches.length > 1) { // Mais de uma ocorrência
        console.log(`   JS Padrão ${i+1}: ${matches.length} ocorrências de ${pattern}`);
        
        // Mostrar contexto das primeiras ocorrências
        const contexts = [];
        let lastIndex = 0;
        for (let j = 0; j < Math.min(3, matches.length); j++) {
          const index = response.data.indexOf(matches[j], lastIndex);
          if (index !== -1) {
            const start = Math.max(0, index - 50);
            const end = Math.min(response.data.length, index + matches[j].length + 50);
            contexts.push(response.data.substring(start, end));
            lastIndex = index + matches[j].length;
          }
        }
        
        contexts.forEach((context, k) => {
          console.log(`      Contexto ${k+1}: ...${context.trim()}...`);
        });
      }
    });
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
  }
}

testFullPageLoad().catch(console.error);