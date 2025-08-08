require('dotenv').config();
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function testBGGLogin() {
  console.log('🧪 Teste de Login BGG - Iniciando...\n');
  
  // Verificar variáveis de ambiente
  const bggLogin = process.env.MASTER_BGG_LOGIN;
  const bggPassword = process.env.MASTER_BGG_PASSWORD;
  
  console.log(`📋 MASTER_BGG_LOGIN: ${bggLogin ? `${bggLogin} ✅` : 'NÃO DEFINIDO ❌'}`);
  console.log(`📋 MASTER_BGG_PASSWORD: ${bggPassword ? `${bggPassword.substring(0, 3)}*** ✅` : 'NÃO DEFINIDO ❌'}\n`);
  
  if (!bggLogin || !bggPassword) {
    console.log('❌ Credenciais não configuradas no .env');
    return;
  }
  
  // Criar cliente com cookies
  const cookieJar = new tough.CookieJar();
  const client = wrapper(axios.create({ jar: cookieJar }));
  
  try {
    console.log('🔐 Tentativa 1: Login via API JSON (atual)');
    console.log('URL: https://boardgamegeek.com/login/api/v1');
    console.log('Método: POST');
    console.log('Body:', JSON.stringify({
      credentials: {
        username: bggLogin,
        password: '***'
      }
    }));
    
    const loginResponse1 = await client.post('https://boardgamegeek.com/login/api/v1', 
      {
        credentials: {
          username: bggLogin,
          password: bggPassword
        }
      }, 
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 15000
      }
    );
    
    console.log(`✅ Status: ${loginResponse1.status} ${loginResponse1.statusText}`);
    console.log(`📄 Response headers:`, Object.keys(loginResponse1.headers));
    console.log(`📄 Response data:`, loginResponse1.data);
    
    // Verificar cookies
    const cookies = cookieJar.getCookiesSync('https://boardgamegeek.com');
    console.log(`🍪 Cookies recebidos: ${cookies.length}`);
    cookies.forEach(cookie => {
      console.log(`   - ${cookie.key}: ${cookie.value.substring(0, 20)}${cookie.value.length > 20 ? '...' : ''}`);
    });
    
    // Testar acesso à página protegida
    console.log('\n📡 Testando acesso à página de data dumps...');
    const pageResponse = await client.get('https://boardgamegeek.com/data_dumps/bg_ranks', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000
    });
    
    console.log(`✅ Página acessada: ${pageResponse.status} ${pageResponse.statusText}`);
    console.log(`📄 Tamanho da página: ${pageResponse.data.length} chars`);
    
    // Procurar pelo link de download
    const downloadLinkMatch = pageResponse.data.match(/<a[^>]*href="([^"]*)"[^>]*>Click to Download<\/a>/);
    
    if (downloadLinkMatch) {
      console.log(`✅ Link "Click to Download" encontrado: ${downloadLinkMatch[1]}`);
    } else {
      console.log('❌ Link "Click to Download" NÃO encontrado');
      
      // Salvar página completa para análise
      const fs = require('fs');
      fs.writeFileSync('./bgg_page_debug.html', pageResponse.data, 'utf8');
      console.log('📄 Página completa salva em: ./bgg_page_debug.html');
      
      // Procurar por variações de texto
      const variations = [
        'Click to Download',
        'Click to download', 
        'download',
        'Download',
        'DOWNLOAD',
        'csv',
        'zip',
        'file',
        'data dump',
        'bg_ranks'
      ];
      
      console.log('\n📄 Procurando variações de texto:');
      variations.forEach(term => {
        const matches = pageResponse.data.match(new RegExp(`.{0,100}${term}.{0,100}`, 'gi'));
        if (matches) {
          console.log(`\n🔍 "${term}" encontrado ${matches.length}x:`);
          matches.slice(0, 3).forEach((match, i) => {
            console.log(`   ${i+1}. "${match.trim()}"`);
          });
        }
      });
      
      // Procurar por links em geral
      console.log('\n🔗 Todos os links na página:');
      const allLinks = pageResponse.data.match(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi);
      if (allLinks) {
        allLinks.slice(0, 10).forEach((link, i) => {
          console.log(`   ${i+1}. ${link}`);
        });
        if (allLinks.length > 10) {
          console.log(`   ... e mais ${allLinks.length - 10} links`);
        }
      }
    }
    
  } catch (error) {
    console.log(`❌ Erro no teste: ${error.message}`);
    
    if (error.response) {
      console.log(`📄 Status: ${error.response.status} ${error.response.statusText}`);
      console.log(`📄 Headers:`, Object.keys(error.response.headers));
      console.log(`📄 Data:`, error.response.data);
    }
  }
  
  console.log('\n🔄 Tentativa 2: Login via formulário tradicional (fallback)');
  
  try {
    // Limpar cookies
    const newCookieJar = new tough.CookieJar();
    const newClient = wrapper(axios.create({ jar: newCookieJar }));
    
    const loginResponse2 = await newClient.post('https://boardgamegeek.com/login', 
      new URLSearchParams({
        'username': bggLogin,
        'password': bggPassword,
        'B1': 'Login'
      }), 
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        maxRedirects: 5,
        timeout: 15000
      }
    );
    
    console.log(`✅ Status: ${loginResponse2.status} ${loginResponse2.statusText}`);
    
    const cookies2 = newCookieJar.getCookiesSync('https://boardgamegeek.com');
    console.log(`🍪 Cookies recebidos: ${cookies2.length}`);
    cookies2.forEach(cookie => {
      console.log(`   - ${cookie.key}: ${cookie.value.substring(0, 20)}${cookie.value.length > 20 ? '...' : ''}`);
    });
    
    // Testar acesso à página protegida
    console.log('\n📡 Testando acesso à página de data dumps (método tradicional)...');
    const pageResponse2 = await newClient.get('https://boardgamegeek.com/data_dumps/bg_ranks', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000
    });
    
    console.log(`✅ Página acessada: ${pageResponse2.status} ${pageResponse2.statusText}`);
    
    // Procurar pelo link de download
    const downloadLinkMatch2 = pageResponse2.data.match(/<a[^>]*href="([^"]*)"[^>]*>Click to Download<\/a>/);
    
    if (downloadLinkMatch2) {
      console.log(`✅ Link "Click to Download" encontrado: ${downloadLinkMatch2[1]}`);
    } else {
      console.log('❌ Link "Click to Download" NÃO encontrado no método tradicional também');
    }
    
  } catch (error2) {
    console.log(`❌ Erro no teste tradicional: ${error2.message}`);
  }
  
  console.log('\n🏁 Teste concluído!');
}

// Executar teste
testBGGLogin().catch(console.error);