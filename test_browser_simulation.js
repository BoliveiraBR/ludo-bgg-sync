require('dotenv').config();
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function simulateBrowserBehavior() {
  console.log('🧪 Simulação de Comportamento de Browser\n');
  
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
  
  // Simular comportamento completo de browser
  console.log('🌐 SIMULANDO BROWSER COMPLETO...\n');
  
  // 1. Primeira requisição - como um browser faria
  console.log('1️⃣ Requisição inicial (como browser)');
  const response1 = await client.get('https://boardgamegeek.com/data_dumps/bg_ranks', {
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
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    }
  });
  
  console.log(`📄 HTML inicial: ${response1.data.length} chars`);
  
  // 2. Carregar recursos CSS/JS (simular)
  console.log('\n2️⃣ Simulando carregamento de recursos...');
  
  // Extrair URLs de CSS e JS
  const cssUrls = response1.data.match(/href=['"]([^'"]*\.css[^'"]*)['"]/g) || [];
  const jsUrls = response1.data.match(/src=['"]([^'"]*\.js[^'"]*)['"]/g) || [];
  
  console.log(`📄 CSS encontrados: ${cssUrls.length}`);
  console.log(`📄 JS encontrados: ${jsUrls.length}`);
  
  // Aguardar como se o JS estivesse carregando
  console.log('⏰ Aguardando 5 segundos (simulando JS loading)...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 3. Fazer requisições AJAX que o Angular/JS poderia fazer
  console.log('\n3️⃣ Simulando requisições AJAX do Angular...');
  
  const ajaxRequests = [
    // Possíveis requisições que o Angular faria
    { 
      url: 'https://boardgamegeek.com/data_dumps/bg_ranks',
      desc: 'Re-requisição da página',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'text/html, */*; q=0.01'
      }
    },
    {
      url: 'https://boardgamegeek.com/data_dumps/bg_ranks/content',
      desc: 'Conteúdo específico',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      }
    },
    {
      url: 'https://boardgamegeek.com/data_dumps/bg_ranks/data',
      desc: 'Dados específicos',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json'
      }
    },
    // Baseado nos endpoints que encontramos antes
    {
      url: 'https://api.geekdo.com/api/data_dumps/bg_ranks',
      desc: 'API externa (geekdo)',
      headers: {
        'Accept': 'application/json',
        'Origin': 'https://boardgamegeek.com',
        'Referer': 'https://boardgamegeek.com/data_dumps/bg_ranks'
      }
    }
  ];
  
  for (const request of ajaxRequests) {
    try {
      console.log(`📡 ${request.desc}: ${request.url}`);
      
      const response = await client.get(request.url, {
        headers: {
          ...request.headers,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000,
        validateStatus: () => true
      });
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Content-Type: ${response.headers['content-type'] || 'N/A'}`);
      
      if (response.status === 200 && response.data) {
        const dataStr = response.data.toString();
        const hasClickToDownload = dataStr.includes('Click to Download');
        const hasDownload = dataStr.toLowerCase().includes('download');
        const hasLinks = (dataStr.match(/<a[^>]*>/g) || []).length;
        
        console.log(`   Tamanho: ${dataStr.length} chars`);
        console.log(`   Links <a>: ${hasLinks}`);
        console.log(`   "download": ${hasDownload}`);
        console.log(`   "Click to Download": ${hasClickToDownload}`);
        
        if (hasClickToDownload) {
          console.log('   🎯🎯🎯 ENCONTROU "Click to Download"! 🎯🎯🎯');
          const fs = require('fs');
          fs.writeFileSync('./FOUND_CLICK_TO_DOWNLOAD.html', dataStr);
          console.log('   📄 Conteúdo salvo em: FOUND_CLICK_TO_DOWNLOAD.html');
          
          // Extrair o link
          const linkMatch = dataStr.match(/<a[^>]*href="([^"]*)"[^>]*>Click to Download<\/a>/);
          if (linkMatch) {
            console.log(`   🔗 LINK EXTRAÍDO: ${linkMatch[1]}`);
          }
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
    
    console.log('');
  }
  
  // 4. Última tentativa - requisição com todos os headers possíveis
  console.log('4️⃣ REQUISIÇÃO FINAL - Headers completos');
  
  const finalResponse = await client.get('https://boardgamegeek.com/data_dumps/bg_ranks', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document', 
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1'
    }
  });
  
  const hasClickToDownload = finalResponse.data.includes('Click to Download');
  const hasDownload = finalResponse.data.toLowerCase().includes('download');
  const hasLinks = (finalResponse.data.match(/<a[^>]*>/g) || []).length;
  
  console.log(`📄 Tamanho final: ${finalResponse.data.length} chars`);
  console.log(`📄 Links <a>: ${hasLinks}`);
  console.log(`📄 "download": ${hasDownload}`);
  console.log(`📄 "Click to Download": ${hasClickToDownload}`);
  
  if (!hasClickToDownload) {
    console.log('\n⚠️ AINDA NÃO ENCONTROU! Possíveis causões:');
    console.log('   1. Link carregado via JavaScript complexo');
    console.log('   2. Necessário interação do usuário');
    console.log('   3. Conteúdo carregado via WebSocket');
    console.log('   4. Página específica para seu usuário/permissões');
    console.log('   5. Requisição POST ou método específico necessário');
    
    // Salvar página final para análise manual
    const fs = require('fs');
    fs.writeFileSync('./final_page_analysis.html', finalResponse.data);
    console.log('   📄 Página salva para análise: final_page_analysis.html');
  }
  
  console.log('\n🏁 Simulação de browser concluída!');
}

simulateBrowserBehavior().catch(console.error);