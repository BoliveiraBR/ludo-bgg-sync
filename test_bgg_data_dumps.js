require('dotenv').config();
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function testDataDumpPages() {
  console.log('🧪 Teste de Páginas de Data Dumps BGG\n');
  
  const bggLogin = process.env.MASTER_BGG_LOGIN;
  const bggPassword = process.env.MASTER_BGG_PASSWORD;
  
  if (!bggLogin || !bggPassword) {
    console.log('❌ Credenciais não configuradas');
    return;
  }
  
  // Fazer login primeiro
  const cookieJar = new tough.CookieJar();
  const client = wrapper(axios.create({ jar: cookieJar }));
  
  try {
    await client.post('https://boardgamegeek.com/login/api/v1', {
      credentials: { username: bggLogin, password: bggPassword }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    
    console.log('✅ Login realizado');
    
    // URLs para testar
    const urlsToTest = [
      'https://boardgamegeek.com/data_dumps/bg_ranks',
      'https://boardgamegeek.com/data_dumps',
      'https://boardgamegeek.com/data-dumps',
      'https://boardgamegeek.com/data_dumps/bg_ranks/',
      'https://boardgamegeek.com/datadumps',
      'https://boardgamegeek.com/xmlapi/data_dumps',
      'https://boardgamegeek.com/api/data_dumps',
      'https://boardgamegeek.com/data_dumps/game_ranks',
      'https://boardgamegeek.com/data_dumps/games'
    ];
    
    for (const url of urlsToTest) {
      try {
        console.log(`\n🔗 Testando: ${url}`);
        
        const response = await client.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          timeout: 10000,
          validateStatus: () => true // Aceitar qualquer status
        });
        
        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log(`   Tamanho: ${response.data.length} chars`);
        
        // Procurar por indicadores de data dumps
        const indicators = ['Click to Download', 'csv', 'zip', 'download', 'data dump', 'bg_ranks'];
        const found = [];
        
        indicators.forEach(term => {
          if (response.data.toLowerCase().includes(term.toLowerCase())) {
            found.push(term);
          }
        });
        
        if (found.length > 0) {
          console.log(`   ✅ Indicadores encontrados: ${found.join(', ')}`);
          
          // Se encontrou "Click to Download", extrair o link
          const downloadMatch = response.data.match(/<a[^>]*href="([^"]*)"[^>]*>Click to Download<\/a>/i);
          if (downloadMatch) {
            console.log(`   🎯 LINK ENCONTRADO: ${downloadMatch[1]}`);
          }
          
          // Salvar página promissora
          if (found.includes('Click to Download')) {
            const fs = require('fs');
            const filename = `./bgg_datadump_${url.split('/').pop()}.html`;
            fs.writeFileSync(filename, response.data);
            console.log(`   📄 Página salva: ${filename}`);
          }
          
        } else {
          console.log(`   ❌ Nenhum indicador encontrado`);
        }
        
      } catch (error) {
        console.log(`   ❌ Erro: ${error.message}`);
      }
    }
    
    // Testar URLs diretas de arquivos
    console.log(`\n🗂️ Testando URLs diretas de arquivos:`);
    
    const currentDate = new Date();
    const directUrls = [];
    
    // Últimos 3 meses
    for (let i = 0; i < 3; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      
      directUrls.push(
        `https://cf.geekdo-files.com/dumps/bgg_db_${year}_${month}.csv.zip`,
        `https://files.boardgamegeek.com/dumps/bgg_db_${year}_${month}.csv.zip`,
        `https://boardgamegeek.com/files/bgg_db_${year}_${month}.csv.zip`
      );
    }
    
    for (const url of directUrls) {
      try {
        const response = await client.head(url, { timeout: 5000 });
        console.log(`   ✅ ${url} - Status: ${response.status}`);
        
        if (response.headers['content-length']) {
          const sizeInMB = (parseInt(response.headers['content-length']) / 1024 / 1024).toFixed(2);
          console.log(`      Tamanho: ${sizeInMB} MB`);
        }
        
      } catch (error) {
        console.log(`   ❌ ${url} - ${error.message}`);
      }
    }
    
  } catch (loginError) {
    console.log(`❌ Erro no login: ${loginError.message}`);
  }
}

testDataDumpPages().catch(console.error);