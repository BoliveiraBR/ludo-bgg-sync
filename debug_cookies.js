require('dotenv').config();
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function debugCookies() {
  console.log('🧪 Debug de Cookies BGG\n');
  
  const bggLogin = process.env.MASTER_BGG_LOGIN;
  const bggPassword = process.env.MASTER_BGG_PASSWORD;
  
  console.log(`Credenciais: ${bggLogin} / ${bggPassword ? 'senha definida' : 'sem senha'}`);
  
  // Criar cliente com debug de cookies
  const cookieJar = new tough.CookieJar();
  const client = wrapper(axios.create({ 
    jar: cookieJar,
    withCredentials: true
  }));
  
  try {
    console.log('\n1️⃣ Fazendo login...');
    
    const loginResponse = await client.post('https://boardgamegeek.com/login/api/v1', 
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
          'Accept': 'application/json',
          'Origin': 'https://boardgamegeek.com',
          'Referer': 'https://boardgamegeek.com/'
        },
        timeout: 15000
      }
    );
    
    console.log(`✅ Status: ${loginResponse.status} ${loginResponse.statusText}`);
    console.log(`📄 Response data:`, loginResponse.data);
    
    // Analisar headers de resposta
    console.log(`\n📋 Response headers:`);
    Object.keys(loginResponse.headers).forEach(key => {
      if (key.toLowerCase().includes('cookie') || key.toLowerCase().includes('set-cookie')) {
        console.log(`   ${key}: ${loginResponse.headers[key]}`);
      }
    });
    
    console.log(`\n🍪 Cookies no jar após login:`);
    const cookies = cookieJar.getCookiesSync('https://boardgamegeek.com');
    console.log(`   Total: ${cookies.length} cookies`);
    
    if (cookies.length === 0) {
      console.log('❌ NENHUM COOKIE RECEBIDO!');
      
      // Tentar método alternativo
      console.log('\n2️⃣ Tentando método tradicional...');
      
      const cookieJar2 = new tough.CookieJar();
      const client2 = wrapper(axios.create({ jar: cookieJar2 }));
      
      const loginResponse2 = await client2.post('https://boardgamegeek.com/login', 
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
      
      console.log(`✅ Status método tradicional: ${loginResponse2.status}`);
      
      const cookies2 = cookieJar2.getCookiesSync('https://boardgamegeek.com');
      console.log(`🍪 Cookies método tradicional: ${cookies2.length}`);
      
      if (cookies2.length > 0) {
        cookies2.forEach(cookie => {
          console.log(`   - ${cookie.key}: ${cookie.value.substring(0, 20)}...`);
        });
        
        // Testar acesso com cookies tradicionais
        console.log('\n📡 Testando acesso à página com método tradicional...');
        const pageTest = await client2.get('https://boardgamegeek.com/data_dumps/bg_ranks');
        console.log(`   Página: ${pageTest.status} - ${pageTest.data.length} chars`);
        
        const hasDownloadLink = pageTest.data.includes('Click to Download');
        console.log(`   Link "Click to Download": ${hasDownloadLink ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'}`);
        
      }
      
    } else {
      cookies.forEach(cookie => {
        console.log(`   - ${cookie.key}: ${cookie.value.substring(0, 20)}...`);
        console.log(`     Domain: ${cookie.domain}, Path: ${cookie.path}`);
        console.log(`     HttpOnly: ${cookie.httpOnly}, Secure: ${cookie.secure}`);
      });
      
      // Verificar cookies essenciais
      const hasSessionId = cookies.some(c => c.key === 'SessionID' || c.key === 'sessionid');
      const hasBggUsername = cookies.some(c => c.key === 'bgg_username');
      const hasBggPassword = cookies.some(c => c.key === 'bgg_password');
      
      console.log(`\n🔍 Análise de cookies:`);
      console.log(`   SessionID: ${hasSessionId ? '✅' : '❌'}`);
      console.log(`   bgg_username: ${hasBggUsername ? '✅' : '❌'}`);
      console.log(`   bgg_password: ${hasBggPassword ? '✅' : '❌'}`);
      
      if (hasSessionId) {
        console.log('\n📡 Testando acesso à página protegida...');
        const pageResponse = await client.get('https://boardgamegeek.com/data_dumps/bg_ranks');
        console.log(`   Status: ${pageResponse.status}`);
        
        const hasDownloadLink = pageResponse.data.includes('Click to Download');
        console.log(`   Link "Click to Download": ${hasDownloadLink ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'}`);
        
        if (!hasDownloadLink) {
          // Salvar página para análise
          const fs = require('fs');
          fs.writeFileSync('./debug_page.html', pageResponse.data);
          console.log('   📄 Página salva como debug_page.html');
        }
      }
    }
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Headers:`, Object.keys(error.response.headers));
      console.log(`   Data:`, error.response.data);
    }
  }
}

debugCookies().catch(console.error);