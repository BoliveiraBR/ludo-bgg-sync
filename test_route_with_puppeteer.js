require('dotenv').config();
const axios = require('axios');

async function testRouteWithPuppeteer() {
  console.log('🧪 Teste da Rota com Puppeteer Integrado\n');
  
  try {
    // Iniciar o servidor temporariamente para teste
    console.log('🚀 Simulando chamada para rota /api/import-bgg-games...');
    
    const startTime = Date.now();
    
    // Fazer requisição para a rota (usando localhost se servidor estiver rodando)
    const response = await axios.get('http://localhost:3000/api/import-bgg-games', {
      timeout: 300000, // 5 minutos timeout devido ao Puppeteer
      validateStatus: () => true // Aceitar qualquer status para debug
    });
    
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`📊 Status: ${response.status}`);
    console.log(`⏱️ Tempo total: ${totalTime} segundos`);
    console.log(`📦 Content-Type: ${response.headers['content-type'] || 'N/A'}`);
    
    if (response.data) {
      const dataStr = response.data.toString();
      console.log(`📄 Response size: ${dataStr.length} chars`);
      
      if (response.status === 200) {
        console.log('🎉 SUCESSO! Rota funcionou com Puppeteer');
        console.log(`📋 Response: ${dataStr.substring(0, 500)}...`);
      } else {
        console.log('❌ Erro na rota:');
        console.log(`📋 Response: ${dataStr.substring(0, 1000)}`);
      }
    }
    
    console.log(`\n💭 ANÁLISE:`);
    console.log(`   - Rota respondeu: ${response.status === 200 ? '✅' : '❌'}`);
    console.log(`   - Tempo razoável: ${totalTime < 120 ? '✅' : '⚠️'} (${totalTime}s)`);
    console.log(`   - Puppeteer integrado: ${response.data && response.data.includes ? (response.data.includes('Puppeteer') ? '✅' : '❓') : '❓'}`);
    
  } catch (error) {
    console.error(`❌ Erro no teste: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log(`\n💡 DICA: O servidor não está rodando em localhost:3000`);
      console.log(`   Para testar, execute em outro terminal:`);
      console.log(`   cd ${process.cwd()}`);
      console.log(`   node src/interfaces/web/server.js`);
    } else if (error.code === 'ENOTFOUND') {
      console.log(`\n💡 DICA: Problema de conectividade. Verifique a conexão.`);
    } else {
      console.log(`\n📋 Detalhes do erro:`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${error.response.data ? error.response.data.substring(0, 500) : 'N/A'}`);
      }
    }
  }
  
  console.log(`\n🏁 Teste da rota concluído!`);
}

testRouteWithPuppeteer().catch(console.error);