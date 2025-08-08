require('dotenv').config();
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function testCSVDownload() {
  console.log('🧪 Teste de Download Direto CSV BGG\n');
  
  const bggLogin = process.env.MASTER_BGG_LOGIN;
  const bggPassword = process.env.MASTER_BGG_PASSWORD;
  
  if (!bggLogin || !bggPassword) {
    console.log('❌ Credenciais não configuradas');
    return;
  }
  
  // Fazer login
  const cookieJar = new tough.CookieJar();
  const client = wrapper(axios.create({ jar: cookieJar }));
  
  try {
    console.log('🔐 Fazendo login...');
    await client.post('https://boardgamegeek.com/login/api/v1', {
      credentials: { username: bggLogin, password: bggPassword }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    
    console.log('✅ Login realizado');
    
    console.log('📥 Baixando CSV diretamente...');
    const csvResponse = await client.get('https://boardgamegeek.com/data_dumps/bg_ranks', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/csv,application/csv,*/*'
      },
      timeout: 60000, // 1 minuto para teste
    });
    
    console.log(`✅ CSV baixado!`);
    console.log(`   Status: ${csvResponse.status}`);
    console.log(`   Tamanho: ${(csvResponse.data.length / 1024).toFixed(2)} KB`);
    console.log(`   Tipo: ${typeof csvResponse.data}`);
    
    // Verificar se parece com CSV
    const firstLines = csvResponse.data.split('\n').slice(0, 5);
    console.log(`\n📄 Primeiras linhas:`);
    firstLines.forEach((line, i) => {
      console.log(`   ${i+1}: ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
    });
    
    // Verificar cabeçalhos esperados
    const expectedColumns = ['id', 'name', 'yearpublished', 'rank', 'bayesaverage'];
    const headers = firstLines[0] ? firstLines[0].split(',') : [];
    
    console.log(`\n📊 Análise de cabeçalhos:`);
    console.log(`   Encontrados: ${headers.length} colunas`);
    console.log(`   Cabeçalhos: ${headers.slice(0, 10).join(', ')}${headers.length > 10 ? '...' : ''}`);
    
    const matches = expectedColumns.filter(col => headers.includes(col));
    console.log(`   ✅ Cabeçalhos esperados encontrados: ${matches.join(', ')}`);
    
    if (matches.length >= 3) {
      console.log('\n🎯 SUCESSO: CSV parece estar no formato correto!');
    } else {
      console.log('\n⚠️ ATENÇÃO: CSV pode não estar no formato esperado');
    }
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Dados: ${error.response.data.substring(0, 200)}...`);
    }
  }
}

testCSVDownload().catch(console.error);