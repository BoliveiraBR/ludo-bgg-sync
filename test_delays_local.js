require('dotenv').config();
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function testDelaysLocal() {
  console.log('🧪 Teste Local - Delays Progressivos\n');
  
  const bggLogin = process.env.MASTER_BGG_LOGIN;
  const bggPassword = process.env.MASTER_BGG_PASSWORD;
  
  if (!bggLogin || !bggPassword) {
    console.log('❌ Credenciais não configuradas');
    return;
  }
  
  // Fazer login - EXATAMENTE como no servidor
  const cookieJar = new tough.CookieJar();
  const client = wrapper(axios.create({ jar: cookieJar }));
  
  console.log('🔐 Fazendo login no BGG via API JSON...');
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
        'Accept': 'application/json'
      },
      timeout: 15000
    }
  );
  
  console.log(`✅ Login realizado (status: ${loginResponse.status})`);
  
  // Verificar se login foi bem-sucedido (204 No Content é sucesso para esta API)
  if (loginResponse.status !== 204 && loginResponse.status !== 200) {
    throw new Error(`Falha no login BGG: ${loginResponse.status} - ${loginResponse.statusText}`);
  }
  
  // Processar cookies manualmente dos headers Set-Cookie - EXATAMENTE como no servidor
  const setCookieHeaders = loginResponse.headers['set-cookie'] || [];
  console.log(`🍪 Headers Set-Cookie recebidos: ${setCookieHeaders.length}`);
  
  // Extrair cookies válidos (não os "deleted")
  const validCookies = {};
  setCookieHeaders.forEach(cookieHeader => {
    // Pegar apenas a primeira parte (nome=valor)
    const cookiePart = cookieHeader.split(';')[0];
    const [name, value] = cookiePart.split('=', 2);
    
    // Ignorar cookies "deleted" ou vazios
    if (value && value !== 'deleted' && value.trim() !== '') {
      validCookies[name] = value;
      console.log(`   - ${name}: ${value.substring(0, 20)}...`);
    }
  });
  
  // Verificar cookies essenciais
  const hasSessionId = 'SessionID' in validCookies;
  const hasBggUsername = 'bggusername' in validCookies;
  const hasBggPassword = 'bggpassword' in validCookies;
  
  console.log(`🔍 Cookies válidos encontrados:`);
  console.log(`   SessionID: ${hasSessionId ? '✅' : '❌'}`);
  console.log(`   bggusername: ${hasBggUsername ? '✅' : '❌'}`);
  console.log(`   bggpassword: ${hasBggPassword ? '✅' : '❌'}`);
  
  if (!hasSessionId) {
    throw new Error('Login BGG falhou - SessionID não recebido. Verifique suas credenciais.');
  }
  
  // Se não temos os cookies bgg_username/bgg_password no jar, adicionar manualmente
  if (!hasBggUsername || !hasBggPassword) {
    console.log('⚠️ Cookies bgg não estão no jar, tentando adicionar manualmente...');
    
    // Adicionar cookies manualmente ao jar
    if (validCookies['bggusername']) {
      cookieJar.setCookieSync(`bggusername=${validCookies['bggusername']}; Path=/; Domain=boardgamegeek.com`, 'https://boardgamegeek.com');
    }
    if (validCookies['bggpassword']) {
      cookieJar.setCookieSync(`bggpassword=${validCookies['bggpassword']}; Path=/; Domain=boardgamegeek.com`, 'https://boardgamegeek.com');
    }
    
    // Verificar se funcionou
    const updatedCookies = cookieJar.getCookiesSync('https://boardgamegeek.com');
    console.log(`🔄 Cookies no jar após correção: ${updatedCookies.length}`);
  }
  
  // TESTE DE DELAYS PROGRESSIVOS - EXATAMENTE como no servidor
  console.log('\n📡 Iniciando teste de delays progressivos...');
  
  let pageHtml = null;
  let downloadLinkMatch = null;
  const maxAttempts = 5;
  const delays = [0, 3000, 8000, 15000, 30000]; // 0s, 3s, 8s, 15s, 30s
  
  const startTime = Date.now();
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`\n🔄 Tentativa ${attempt + 1}/${maxAttempts}${delays[attempt] > 0 ? ` (aguardando ${delays[attempt]/1000}s)` : ''}...`);
    
    // Aguardar se necessário
    if (delays[attempt] > 0) {
      console.log(`⏰ Aguardando ${delays[attempt]/1000} segundos...`);
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
    
    const pageResponse = await client.get('https://boardgamegeek.com/data_dumps/bg_ranks', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 30000
    });
    
    pageHtml = pageResponse.data;
    console.log(`📄 Página carregada: ${pageHtml.length} caracteres`);
    
    // Contar links <a> como indicador de conteúdo carregado
    const linkCount = (pageHtml.match(/<a[^>]*>/g) || []).length;
    console.log(`🔗 Links encontrados: ${linkCount}`);
    
    // Procurar pelo link "Click to Download" (case-insensitive)
    downloadLinkMatch = pageHtml.match(/<a[^>]*href="([^"]*)"[^>]*>Click to Download<\/a>/i);
    
    if (downloadLinkMatch) {
      console.log(`✅ Link "Click to Download" encontrado na tentativa ${attempt + 1}!`);
      console.log(`🔗 URL: ${downloadLinkMatch[1]}`);
      break;
    } else {
      console.log(`❌ Link "Click to Download" não encontrado na tentativa ${attempt + 1}`);
      
      // Debug: mostrar se há indicadores de que o conteúdo está carregando
      const hasDownload = pageHtml.toLowerCase().includes('download');
      const hasCsv = pageHtml.toLowerCase().includes('.csv');
      const hasZip = pageHtml.toLowerCase().includes('.zip');
      
      console.log(`   Indicadores: download=${hasDownload}, .csv=${hasCsv}, .zip=${hasZip}`);
      
      if (attempt === maxAttempts - 1) {
        // Última tentativa - fazer debug completo
        console.log(`📄 Primeiros 200 chars: ${pageHtml.substring(0, 200)}`);
        console.log(`📄 Últimos 200 chars: ${pageHtml.substring(pageHtml.length - 200)}`);
        
        // Salvar página da última tentativa
        const fs = require('fs');
        fs.writeFileSync('./last_attempt_page.html', pageHtml);
        console.log(`📄 Página da última tentativa salva: last_attempt_page.html`);
      }
    }
  }
  
  // Se ainda não encontrou após todas as tentativas, tentar padrões alternativos
  if (!downloadLinkMatch) {
    console.log('\n🔄 Tentando padrões alternativos após todas as tentativas...');
    
    const alternativePatterns = [
      /<a[^>]*href="([^"]*)"[^>]*>\s*Click\s*to\s*Download\s*<\/a>/i,
      /<a[^>]*href="([^"]*)"[^>]*>[^<]*download[^<]*<\/a>/i,
      /<a[^>]*href="([^"]*\.zip)"[^>]*>/i,
      /<a[^>]*href="([^"]*\.csv)"[^>]*>/i,
      /<a[^>]*href="([^"]*)"[^>]*class="[^"]*download[^"]*"/i
    ];
    
    for (let i = 0; i < alternativePatterns.length; i++) {
      downloadLinkMatch = pageHtml.match(alternativePatterns[i]);
      if (downloadLinkMatch) {
        console.log(`✅ Padrão alternativo ${i+1} funcionou: ${downloadLinkMatch[0].substring(0, 100)}...`);
        console.log(`🔗 URL: ${downloadLinkMatch[1]}`);
        break;
      } else {
        console.log(`❌ Padrão alternativo ${i+1} falhou`);
      }
    }
  }
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n⏱️ Tempo total decorrido: ${totalTime} segundos`);
  
  if (!downloadLinkMatch) {
    // Debug final se não encontrou nada
    console.log(`\n❌ Link "Click to Download" não encontrado após ${maxAttempts} tentativas`);
    
    // Mostrar todos os links encontrados
    const allLinks = pageHtml.match(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi);
    if (allLinks && allLinks.length > 0) {
      console.log(`🔗 Todos os links encontrados (${allLinks.length}):`);
      allLinks.slice(0, 10).forEach((link, i) => {
        console.log(`   ${i+1}: ${link.substring(0, 150)}...`);
      });
    } else {
      console.log(`🔗 Nenhum link <a> encontrado na página`);
    }
    
    console.log(`\n💭 CONCLUSÃO LOCAL:`);
    console.log(`   - Login: ✅ Funcionou`);
    console.log(`   - Cookies: ✅ ${Object.keys(validCookies).length} válidos`);
    console.log(`   - Página: ✅ ${pageHtml.length} chars carregados`);
    console.log(`   - Delays: ✅ Testados até 30s`);
    console.log(`   - Links: ${(pageHtml.match(/<a[^>]*>/g) || []).length} encontrados`);
    console.log(`   - "Click to Download": ❌ NÃO encontrado`);
    console.log(`\n   🎯 O método de delays NÃO resolve o problema localmente.`);
    console.log(`   📋 Recomendação: Tentar outra abordagem ou verificar se o link realmente existe.`);
    
  } else {
    console.log(`\n🎉 SUCESSO LOCAL!`);
    console.log(`   - Link encontrado: ${downloadLinkMatch[1]}`);
    console.log(`   - Tempo decorrido: ${totalTime}s`);
    console.log(`   🚀 Método deve funcionar em produção também!`);
  }
  
  console.log(`\n🏁 Teste local concluído!`);
}

testDelaysLocal().catch(error => {
  console.error('❌ Erro no teste:', error.message);
});