require('dotenv').config();
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function testGenerateEndpoint() {
  console.log('🧪 Testando Endpoint /data_dumps/bg_ranks/generate\n');
  
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
  
  // Testar o endpoint que retornou 200
  const endpointsToTest = [
    {
      url: 'https://boardgamegeek.com/data_dumps/bg_ranks/generate',
      method: 'POST',
      data: {},
      desc: 'POST vazio'
    },
    {
      url: 'https://boardgamegeek.com/data_dumps/bg_ranks/generate', 
      method: 'POST',
      data: { type: 'bg_ranks' },
      desc: 'POST com type'
    },
    {
      url: 'https://boardgamegeek.com/data_dumps/bg_ranks/generate',
      method: 'POST', 
      data: { format: 'csv', export: 'boardgames_ranks' },
      desc: 'POST com parâmetros'
    },
    {
      url: 'https://boardgamegeek.com/data_dumps/bg_ranks/generate',
      method: 'GET',
      data: null,
      desc: 'GET'
    }
  ];
  
  for (const test of endpointsToTest) {
    try {
      console.log(`📡 ${test.desc}: ${test.method} ${test.url}`);
      
      let response;
      const config = {
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://boardgamegeek.com/data_dumps/bg_ranks'
        },
        timeout: 20000,
        validateStatus: () => true
      };
      
      if (test.method === 'POST') {
        if (test.data) {
          config.headers['Content-Type'] = 'application/json';
          response = await client.post(test.url, test.data, config);
        } else {
          response = await client.post(test.url, {}, config);
        }
      } else {
        response = await client.get(test.url, config);
      }
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Content-Type: ${response.headers['content-type'] || 'N/A'}`);
      
      if (response.data) {
        const dataStr = response.data.toString();
        console.log(`   Size: ${dataStr.length} chars`);
        
        // Analisar resposta em detalhes
        const indicators = [
          { name: 'JSON', test: () => dataStr.trim().startsWith('{') || dataStr.trim().startsWith('[') },
          { name: 'S3 URL', test: () => dataStr.includes('s3.amazonaws.com') },
          { name: 'geek-export-stats', test: () => dataStr.includes('geek-export-stats') },
          { name: 'X-Amz-Signature', test: () => dataStr.includes('X-Amz-Signature') },
          { name: 'boardgames_ranks', test: () => dataStr.includes('boardgames_ranks') },
          { name: 'ZIP', test: () => dataStr.includes('.zip') },
          { name: 'Error/Success msg', test: () => dataStr.includes('error') || dataStr.includes('success') },
          { name: 'URL pattern', test: () => dataStr.match(/https?:\/\/[^\s"'<>]+/) }
        ];
        
        const foundIndicators = indicators.filter(ind => ind.test()).map(ind => ind.name);
        
        console.log(`   Indicadores: ${foundIndicators.join(', ') || 'nenhum'}`);
        
        // Se encontrou algo interessante
        if (foundIndicators.length > 0) {
          const fs = require('fs');
          const filename = `./generate_response_${test.method}_${foundIndicators.join('_').replace(/\W/g, '')}.txt`;
          fs.writeFileSync(filename, `Request: ${test.method} ${test.url}\nData: ${JSON.stringify(test.data)}\n\nStatus: ${response.status}\nContent-Type: ${response.headers['content-type']}\n\nResponse:\n${dataStr}`);
          console.log(`   📄 Resposta salva: ${filename}`);
        }
        
        // Se é JSON, parsear
        if (foundIndicators.includes('JSON')) {
          try {
            const jsonData = JSON.parse(dataStr);
            console.log(`   📊 JSON parsed successfully`);
            console.log(`   📋 Keys: ${Object.keys(jsonData).join(', ')}`);
            
            // Procurar por URLs no JSON
            const jsonStr = JSON.stringify(jsonData, null, 2);
            const urlMatches = jsonStr.match(/https?:\/\/[^\s"']+/g);
            if (urlMatches) {
              console.log(`   🔗 URLs no JSON:`);
              urlMatches.forEach((url, i) => {
                console.log(`      ${i+1}: ${url}`);
              });
            }
            
            // Se contém dados específicos
            if (jsonData.download_url || jsonData.url || jsonData.signed_url) {
              console.log(`   🎯🎯🎯 ENCONTROU URL DE DOWNLOAD! 🎯🎯🎯`);
              console.log(`   🔗 URL: ${jsonData.download_url || jsonData.url || jsonData.signed_url}`);
            }
            
          } catch (parseError) {
            console.log(`   ⚠️ Erro ao parsear JSON: ${parseError.message}`);
            // Mostrar início da resposta para debug
            console.log(`   📄 Início: ${dataStr.substring(0, 200)}...`);
          }
        }
        
        // Se não é JSON, mostrar amostra
        if (!foundIndicators.includes('JSON')) {
          if (dataStr.length < 300) {
            console.log(`   📄 Conteúdo completo: ${dataStr.trim()}`);
          } else {
            console.log(`   📄 Início: ${dataStr.substring(0, 150)}...`);
            console.log(`   📄 Fim: ...${dataStr.substring(dataStr.length - 150)}`);
          }
        }
        
        // Procurar URLs diretamente no texto
        const directUrls = dataStr.match(/https?:\/\/geek-export-stats\.s3\.amazonaws\.com[^\s"'<>]*/g);
        if (directUrls) {
          console.log(`   🔗 URLs S3 encontradas diretamente:`);
          directUrls.forEach((url, i) => {
            console.log(`      ${i+1}: ${url}`);
          });
        }
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}\n`);
    }
  }
  
  console.log('🏁 Teste do endpoint generate concluído!');
}

testGenerateEndpoint().catch(console.error);