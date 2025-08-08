require('dotenv').config();
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function testDirectAWSUrl() {
  console.log('🧪 Teste Direto com URL AWS Construída\n');
  
  // URL pattern from user: geek-export-stats.s3.amazonaws.com/boardgames_export/boardgames_ranks_2025-08-08.zip
  // Try to construct URL for today's date
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
  const directUrl = `https://geek-export-stats.s3.amazonaws.com/boardgames_export/boardgames_ranks_${today}.zip`;
  
  console.log(`📅 Data de hoje: ${today}`);
  console.log(`🔗 URL construída: ${directUrl}`);
  
  const bggLogin = process.env.MASTER_BGG_LOGIN;
  const bggPassword = process.env.MASTER_BGG_PASSWORD;
  
  // Fazer login primeiro
  const cookieJar = new tough.CookieJar();
  const client = wrapper(axios.create({ jar: cookieJar }));
  
  console.log('🔐 Fazendo login no BGG...');
  await client.post('https://boardgamegeek.com/login/api/v1', {
    credentials: { username: bggLogin, password: bggPassword }
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
  
  console.log('✅ Login realizado\n');
  
  // Tentar acessar URL direta
  console.log('📡 Tentando acessar URL AWS direta...');
  
  try {
    const response = await client.head(directUrl, {
      timeout: 30000,
      validateStatus: () => true
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📦 Content-Length: ${response.headers['content-length'] || 'N/A'}`);
    console.log(`🗂️ Content-Type: ${response.headers['content-type'] || 'N/A'}`);
    
    if (response.status === 200) {
      console.log('🎉 URL direta FUNCIONOU!');
      console.log('🚀 Podemos usar esta abordagem na produção!');
      return { success: true, url: directUrl };
    } else if (response.status === 403) {
      console.log('🔒 Acesso negado (403) - URL requer assinatura');
    } else if (response.status === 404) {
      console.log('❓ Arquivo não encontrado (404) - talvez data incorreta');
    } else {
      console.log(`❌ Erro: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Erro na requisição: ${error.message}`);
  }
  
  // Se URL de hoje não funcionou, tentar datas recentes
  console.log('\n🔄 Testando datas recentes...');
  
  for (let daysAgo = 1; daysAgo <= 7; daysAgo++) {
    const testDate = new Date();
    testDate.setDate(testDate.getDate() - daysAgo);
    const dateStr = testDate.toISOString().slice(0, 10);
    
    const testUrl = `https://geek-export-stats.s3.amazonaws.com/boardgames_export/boardgames_ranks_${dateStr}.zip`;
    
    console.log(`📅 Testando ${dateStr}...`);
    
    try {
      const response = await client.head(testUrl, {
        timeout: 10000,
        validateStatus: () => true
      });
      
      console.log(`   Status: ${response.status}`);
      
      if (response.status === 200) {
        console.log(`🎉 ARQUIVO ENCONTRADO para data ${dateStr}!`);
        console.log(`🔗 URL: ${testUrl}`);
        console.log(`📦 Size: ${response.headers['content-length'] || 'N/A'} bytes`);
        return { success: true, url: testUrl, date: dateStr };
      }
    } catch (error) {
      console.log(`   Erro: ${error.message}`);
    }
  }
  
  console.log('\n❌ Nenhuma URL direta funcionou');
  console.log('💭 CONCLUSÃO:');
  console.log('   - URLs AWS diretas não funcionam sem assinatura');
  console.log('   - Precisamos encontrar o endpoint correto para gerar URLs assinadas');
  console.log('   - Ou investigar como o frontend Angular faz isso');
  
  return { success: false };
}

testDirectAWSUrl().catch(console.error);