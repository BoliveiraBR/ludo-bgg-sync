require('dotenv').config();
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function findAWSEndpoint() {
  console.log('🧪 Procurando Endpoint para URLs AWS Assinadas\n');
  
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
  
  // Baseado na URL que você forneceu, o BGG deve ter endpoints que geram URLs assinadas
  // Padrão da URL: geek-export-stats.s3.amazonaws.com/boardgames_export/boardgames_ranks_2025-08-08.zip
  
  const possibleEndpoints = [
    // Endpoints diretos
    '/api/exports/boardgames_ranks',
    '/api/exports/bg_ranks', 
    '/api/data_dumps/download',
    '/api/data_dumps/bg_ranks/download',
    '/api/files/download',
    
    // Baseado no formato da URL AWS
    '/api/aws/signed_url',
    '/api/aws/exports', 
    '/api/s3/export',
    
    // Endpoints específicos para data dumps
    '/data_dumps/bg_ranks/download_url',
    '/data_dumps/bg_ranks/signed_url',
    '/data_dumps/bg_ranks/export',
    
    // Endpoints JSON
    '/data_dumps/bg_ranks.json',
    '/api/data_dumps.json'
  ];
  
  console.log(`🔗 Testando ${possibleEndpoints.length} endpoints possíveis...\n`);
  
  for (const endpoint of possibleEndpoints) {
    try {
      const url = `https://boardgamegeek.com${endpoint}`;
      console.log(`📡 ${endpoint}`);
      
      const response = await client.get(url, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://boardgamegeek.com/data_dumps/bg_ranks'
        },
        timeout: 10000,
        validateStatus: () => true
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Content-Type: ${response.headers['content-type'] || 'N/A'}`);
      
      if (response.status === 200 && response.data) {
        const dataStr = response.data.toString();
        console.log(`   Size: ${dataStr.length} chars`);
        
        // Procurar por indicadores de AWS/S3
        const awsIndicators = [
          { name: 'S3 URL', test: () => dataStr.includes('s3.amazonaws.com') },
          { name: 'geek-export-stats', test: () => dataStr.includes('geek-export-stats') },
          { name: 'X-Amz-Signature', test: () => dataStr.includes('X-Amz-Signature') },
          { name: 'boardgames_ranks', test: () => dataStr.includes('boardgames_ranks') },
          { name: 'ZIP file', test: () => dataStr.includes('.zip') },
          { name: 'JSON response', test: () => dataStr.trim().startsWith('{') },
          { name: 'Download URL', test: () => dataStr.toLowerCase().includes('download') && dataStr.includes('http') }
        ];
        
        const foundIndicators = awsIndicators.filter(ind => ind.test()).map(ind => ind.name);
        
        if (foundIndicators.length > 0) {
          console.log(`   🎯 Indicadores AWS: ${foundIndicators.join(', ')}`);
          
          // Se encontrou algo relacionado ao S3/AWS
          if (foundIndicators.some(ind => ['S3 URL', 'geek-export-stats', 'X-Amz-Signature'].includes(ind))) {
            console.log(`   🎯🎯🎯 POSSÍVEL ENDPOINT ENCONTRADO! 🎯🎯🎯`);
            
            const fs = require('fs');
            const filename = `./aws_endpoint_${endpoint.replace(/\//g, '_')}.txt`;
            fs.writeFileSync(filename, `URL: ${url}\n\nStatus: ${response.status}\nContent-Type: ${response.headers['content-type']}\n\nResponse:\n${dataStr}`);
            console.log(`   📄 Resposta salva: ${filename}`);
            
            // Se é JSON, tentar parsear
            if (foundIndicators.includes('JSON response')) {
              try {
                const jsonData = JSON.parse(dataStr);
                console.log(`   📊 JSON keys: ${Object.keys(jsonData).join(', ')}`);
                
                // Procurar por URLs dentro do JSON
                const jsonStr = JSON.stringify(jsonData);
                if (jsonStr.includes('s3.amazonaws.com') || jsonStr.includes('geek-export-stats')) {
                  console.log(`   🔗 JSON contém URL S3!`);
                  
                  // Extrair URLs
                  const urlMatches = jsonStr.match(/https?:\/\/[^\s"']*/g);
                  if (urlMatches) {
                    console.log(`   📋 URLs encontradas:`);
                    urlMatches.forEach((match, i) => {
                      console.log(`      ${i+1}: ${match}`);
                    });
                  }
                }
              } catch (e) {
                console.log(`   ⚠️ Não é JSON válido: ${e.message}`);
              }
            }
            
            // Se contém URL diretamente no texto
            if (foundIndicators.includes('Download URL')) {
              const urlMatches = dataStr.match(/https?:\/\/geek-export-stats\.s3\.amazonaws\.com[^\s"']*/g);
              if (urlMatches) {
                console.log(`   🔗 URLs S3 extraídas:`);
                urlMatches.forEach((match, i) => {
                  console.log(`      ${i+1}: ${match.substring(0, 100)}...`);
                });
              }
            }
          }
        }
        
        // Mostrar primeira linha se for pequeno
        if (dataStr.length < 500) {
          console.log(`   📄 Conteúdo: ${dataStr.trim()}`);
        } else {
          console.log(`   📄 Primeira linha: ${dataStr.split('\n')[0].substring(0, 200)}...`);
        }
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}\n`);
    }
  }
  
  // Testar também métodos POST (alguns endpoints podem exigir POST)
  console.log('🔗 Testando endpoints com POST...\n');
  
  const postEndpoints = [
    '/api/exports/generate',
    '/api/data_dumps/generate', 
    '/data_dumps/bg_ranks/generate',
    '/api/aws/presigned_url'
  ];
  
  for (const endpoint of postEndpoints) {
    try {
      const url = `https://boardgamegeek.com${endpoint}`;
      console.log(`📡 POST ${endpoint}`);
      
      const response = await client.post(url, {
        type: 'bg_ranks',
        format: 'csv',
        export: 'boardgames_ranks'
      }, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://boardgamegeek.com/data_dumps/bg_ranks'
        },
        timeout: 15000,
        validateStatus: () => true
      });
      
      console.log(`   Status: ${response.status}`);
      
      if (response.status === 200 && response.data) {
        const dataStr = response.data.toString();
        const hasS3 = dataStr.includes('s3.amazonaws.com');
        const hasGeekExport = dataStr.includes('geek-export-stats');
        
        if (hasS3 || hasGeekExport) {
          console.log(`   🎯 Resposta contém URLs S3!`);
          
          const fs = require('fs');
          fs.writeFileSync(`./post_endpoint_${endpoint.replace(/\//g, '_')}.txt`, dataStr);
          console.log(`   📄 Resposta salva`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('🏁 Busca por endpoints AWS concluída!');
}

findAWSEndpoint().catch(console.error);