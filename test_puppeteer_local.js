require('dotenv').config();
const puppeteer = require('puppeteer');

async function testPuppeteerLocal() {
  console.log('🧪 Teste Local - Puppeteer para Conteúdo Dinâmico\n');
  
  const bggLogin = process.env.MASTER_BGG_LOGIN;
  const bggPassword = process.env.MASTER_BGG_PASSWORD;
  
  if (!bggLogin || !bggPassword) {
    console.log('❌ Credenciais não configuradas');
    return;
  }
  
  let browser;
  let page;
  
  try {
    // Iniciar navegador
    console.log('🚀 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: true, // Usar false para debug visual
      defaultViewport: { width: 1280, height: 800 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    page = await browser.newPage();
    
    // Configurar User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('✅ Navegador iniciado\n');
    
    // 1. FAZER LOGIN
    console.log('🔐 Fazendo login no BGG...');
    
    await page.goto('https://boardgamegeek.com/login', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Aguardar campos de login
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    
    // Preencher credenciais
    await page.type('input[name="username"]', bggLogin);
    await page.type('input[name="password"]', bggPassword);
    
    // Fazer login
    console.log('   Submetendo credenciais...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.click('button[type="submit"], input[type="submit"]')
    ]);
    
    console.log('✅ Login realizado\n');
    
    // 2. NAVEGAR PARA PÁGINA DE DATA DUMPS
    console.log('📡 Navegando para página de data dumps...');
    
    await page.goto('https://boardgamegeek.com/data_dumps/bg_ranks', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    console.log('✅ Página carregada\n');
    
    // 3. AGUARDAR E PROCURAR PELO LINK DINÂMICO
    console.log('🔍 Procurando link "Click to Download"...\n');
    
    const maxWaitTime = 60000; // 60 segundos no máximo
    const checkInterval = 2000; // Verificar a cada 2 segundos
    const startTime = Date.now();
    let downloadUrl = null;
    let attempt = 0;
    
    while (Date.now() - startTime < maxWaitTime) {
      attempt++;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      
      console.log(`🔄 Tentativa ${attempt} (${elapsed}s transcorridos)...`);
      
      try {
        // Método 1: Procurar por link com texto "Click to Download"
        const clickToDownloadLink = await page.evaluate(() => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.textContent && link.textContent.toLowerCase().includes('click to download')) {
              return {
                text: link.textContent.trim(),
                href: link.href,
                innerHTML: link.innerHTML
              };
            }
          }
          return null;
        });
        
        if (clickToDownloadLink) {
          console.log('✅ Link "Click to Download" encontrado!');
          console.log(`   Texto: ${clickToDownloadLink.text}`);
          console.log(`   URL: ${clickToDownloadLink.href}`);
          downloadUrl = clickToDownloadLink.href;
          break;
        }
        
        // Método 2: Procurar por qualquer link que contenha geek-export-stats
        const s3Link = await page.evaluate(() => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.href && link.href.includes('geek-export-stats.s3.amazonaws.com')) {
              return {
                text: link.textContent ? link.textContent.trim() : '',
                href: link.href,
                innerHTML: link.innerHTML
              };
            }
          }
          return null;
        });
        
        if (s3Link) {
          console.log('✅ Link S3 encontrado diretamente!');
          console.log(`   Texto: ${s3Link.text}`);
          console.log(`   URL: ${s3Link.href}`);
          downloadUrl = s3Link.href;
          break;
        }
        
        // Método 3: Interceptar requisições AJAX que podem conter a URL
        const requests = await page.evaluate(() => {
          // Verificar se há requests em andamento ou dados no window
          if (window.performance && window.performance.getEntries) {
            const entries = window.performance.getEntries();
            const relevantRequests = entries.filter(entry => 
              entry.name && (
                entry.name.includes('s3.amazonaws.com') ||
                entry.name.includes('data_dumps') ||
                entry.name.includes('generate')
              )
            );
            return relevantRequests.map(r => r.name);
          }
          return [];
        });
        
        if (requests.length > 0) {
          console.log(`📡 Requisições relevantes encontradas:`);
          requests.forEach((req, i) => {
            console.log(`   ${i+1}: ${req}`);
          });
        }
        
        // Método 4: Verificar conteúdo dinâmico no DOM
        const dynamicContent = await page.evaluate(() => {
          const body = document.body.innerHTML;
          const hasDownload = body.toLowerCase().includes('download');
          const hasZip = body.toLowerCase().includes('.zip');
          const hasCsv = body.toLowerCase().includes('.csv');
          const hasS3 = body.includes('s3.amazonaws.com');
          const hasGeekExport = body.includes('geek-export-stats');
          
          const linkCount = document.querySelectorAll('a').length;
          
          return {
            hasDownload,
            hasZip, 
            hasCsv,
            hasS3,
            hasGeekExport,
            linkCount,
            bodyLength: body.length
          };
        });
        
        console.log(`   DOM: ${dynamicContent.linkCount} links, ${dynamicContent.bodyLength} chars`);
        console.log(`   Conteúdo: download=${dynamicContent.hasDownload}, zip=${dynamicContent.hasZip}, csv=${dynamicContent.hasCsv}`);
        console.log(`   AWS: s3=${dynamicContent.hasS3}, geek-export=${dynamicContent.hasGeekExport}`);
        
        // Se ainda não encontrou, aguardar um pouco antes da próxima verificação
        if (attempt < 30) { // Só aguardar se não for a última tentativa
          console.log(`   ⏰ Aguardando ${checkInterval/1000}s antes da próxima verificação...\n`);
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
      } catch (error) {
        console.log(`   ❌ Erro na tentativa ${attempt}: ${error.message}`);
      }
    }
    
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n⏱️ Tempo total decorrido: ${totalTime} segundos`);
    
    if (downloadUrl) {
      console.log(`\n🎉 SUCESSO COM PUPPETEER!`);
      console.log(`🔗 URL encontrada: ${downloadUrl}`);
      
      // Verificar se a URL é válida
      if (downloadUrl.includes('geek-export-stats.s3.amazonaws.com')) {
        console.log(`✅ URL é uma URL S3 válida do BGG`);
        
        // Salvar resultado
        const fs = require('fs');
        const result = {
          success: true,
          downloadUrl: downloadUrl,
          method: 'puppeteer',
          timeElapsed: totalTime,
          timestamp: new Date().toISOString()
        };
        fs.writeFileSync('./puppeteer_success_result.json', JSON.stringify(result, null, 2));
        console.log(`📄 Resultado salvo em: puppeteer_success_result.json`);
        
      } else {
        console.log(`⚠️ URL encontrada mas não parece ser S3: ${downloadUrl}`);
      }
      
    } else {
      console.log(`\n❌ Link "Click to Download" não encontrado após ${totalTime} segundos`);
      
      // Debug final - salvar página HTML
      const finalHtml = await page.content();
      const fs = require('fs');
      fs.writeFileSync('./puppeteer_final_page.html', finalHtml);
      console.log(`📄 Página final salva em: puppeteer_final_page.html`);
      
      console.log(`\n💭 ANÁLISE PUPPETEER:`);
      console.log(`   - Navegador: ✅ Puppeteer funcionou`);
      console.log(`   - Login: ✅ Login realizado com sucesso`);
      console.log(`   - Página: ✅ ${finalHtml.length} chars carregados`);
      console.log(`   - JavaScript: ✅ Executado por ${totalTime}s`);
      console.log(`   - Link dinâmico: ❌ NÃO encontrado`);
      console.log(`\n   🤔 Possibilidades:`);
      console.log(`      1. Link requer ação adicional (clique, hover, etc.)`);
      console.log(`      2. Link só aparece em horários específicos`);
      console.log(`      3. Link requer permissões especiais da conta`);
      console.log(`      4. Link é gerado por requisição AJAX separada`);
    }
    
  } catch (error) {
    console.error(`❌ Erro no teste Puppeteer: ${error.message}`);
    
    // Tentar capturar screenshot para debug
    if (page) {
      try {
        await page.screenshot({ path: './puppeteer_error_screenshot.png', fullPage: true });
        console.log(`📷 Screenshot de erro salvo: puppeteer_error_screenshot.png`);
      } catch (screenshotError) {
        console.log(`⚠️ Não foi possível capturar screenshot: ${screenshotError.message}`);
      }
    }
    
  } finally {
    if (browser) {
      await browser.close();
      console.log(`\n🏁 Navegador fechado. Teste Puppeteer concluído!`);
    }
  }
}

testPuppeteerLocal().catch(console.error);