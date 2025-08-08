#!/usr/bin/env node

/**
 * Script para instalar Chrome/Chromium para Puppeteer
 * Executa automaticamente se Chrome não for encontrado
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando instalação do Chrome para Puppeteer...\n');

// Paths possíveis onde Chrome pode estar instalado
const possibleChromePaths = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/opt/google/chrome/chrome',
  process.env.PUPPETEER_EXECUTABLE_PATH
].filter(Boolean);

let chromeFound = false;
let chromePath = null;

// Verificar se Chrome já está instalado
console.log('📍 Verificando paths possíveis do Chrome:');
for (const possiblePath of possibleChromePaths) {
  console.log(`   - ${possiblePath}:`, fs.existsSync(possiblePath) ? '✅' : '❌');
  if (fs.existsSync(possiblePath) && !chromeFound) {
    chromeFound = true;
    chromePath = possiblePath;
  }
}

if (chromeFound) {
  console.log(`\n✅ Chrome encontrado em: ${chromePath}`);
  
  // Testar se Chrome funciona
  try {
    const version = execSync(`${chromePath} --version`, { encoding: 'utf8', timeout: 10000 });
    console.log(`✅ Versão: ${version.trim()}`);
    
    // Testar modo headless
    execSync(`${chromePath} --headless --disable-gpu --no-sandbox --virtual-time-budget=1000 --run-all-compositor-stages-before-draw about:blank`, { 
      timeout: 10000,
      stdio: 'pipe'
    });
    console.log('✅ Teste headless passou');
    
    console.log('\n🎉 Chrome está funcionando corretamente!');
    process.exit(0);
    
  } catch (error) {
    console.log(`⚠️ Chrome encontrado mas com problemas: ${error.message}`);
    console.log('💭 Continuando com tentativa de correção...\n');
  }
} else {
  console.log('\n❌ Chrome não encontrado em nenhum path padrão');
}

// Tentar instalar Chrome via Puppeteer
console.log('🔧 Tentando instalar Chrome via Puppeteer...\n');

try {
  console.log('📦 Executando: npx puppeteer browsers install chrome');
  
  const result = execSync('npx puppeteer browsers install chrome', { 
    encoding: 'utf8',
    timeout: 300000, // 5 minutos
    stdio: 'pipe'
  });
  
  console.log('✅ Instalação concluída:');
  console.log(result);
  
  // Verificar se agora funciona
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('about:blank');
  await browser.close();
  
  console.log('✅ Puppeteer funcionando após instalação!');
  
} catch (error) {
  console.log(`❌ Falha na instalação via Puppeteer: ${error.message}`);
  
  // Como último recurso, tentar instalar dependências do sistema
  if (process.platform === 'linux') {
    console.log('\n🔧 Tentando instalar dependências do sistema...');
    
    try {
      // Detectar distribuição
      let installCmd = '';
      
      if (fs.existsSync('/etc/yum.conf')) {
        // RHEL/CentOS/Amazon Linux
        installCmd = 'yum install -y google-chrome-stable || yum install -y chromium';
      } else if (fs.existsSync('/etc/apt/sources.list')) {
        // Ubuntu/Debian
        installCmd = 'apt-get update && apt-get install -y google-chrome-stable || apt-get install -y chromium-browser';
      }
      
      if (installCmd) {
        console.log(`📦 Executando: ${installCmd}`);
        execSync(installCmd, { stdio: 'inherit', timeout: 300000 });
        console.log('✅ Instalação do sistema concluída');
      } else {
        console.log('⚠️ Distribuição Linux não reconhecida');
      }
      
    } catch (systemError) {
      console.log(`❌ Falha na instalação do sistema: ${systemError.message}`);
    }
  }
}

console.log('\n💡 INSTRUÇÕES MANUAIS:');
console.log('   Se o script falhou, tente manualmente:');
console.log('   1. npx puppeteer browsers install chrome');
console.log('   2. export PUPPETEER_EXECUTABLE_PATH=/path/to/chrome');
console.log('   3. Para AWS EB, use o arquivo .ebextensions/01_chrome_install.config');

console.log('\n🏁 Script de instalação finalizado.');
process.exit(0);