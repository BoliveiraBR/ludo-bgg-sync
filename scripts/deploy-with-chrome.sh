#!/bin/bash

###################################################################################################
#### Script de Deploy com Configuração do Puppeteer/Chrome
#### Automatiza o processo de deploy no AWS Elastic Beanstalk com suporte ao Puppeteer
###################################################################################################

echo "🚀 Deploy BGG-Ludopedia-Sync com Puppeteer/Chrome"
echo "=================================================="

# Verificar se eb CLI está instalado
if ! command -v eb &> /dev/null; then
    echo "❌ AWS EB CLI não encontrado. Instale com: pip install awsebcli"
    exit 1
fi

# Verificar se estamos em um projeto EB
if [ ! -f ".elasticbeanstalk/config.yml" ]; then
    echo "❌ Diretório não é um projeto Elastic Beanstalk"
    echo "💡 Execute 'eb init' primeiro"
    exit 1
fi

echo "✅ Pré-requisitos verificados"

# Verificar arquivos necessários
echo ""
echo "📁 Verificando arquivos de configuração..."

if [ ! -f ".ebextensions/01_chrome_install.config" ]; then
    echo "❌ Arquivo .ebextensions/01_chrome_install.config não encontrado"
    exit 1
fi

if [ ! -f "scripts/install-chrome.js" ]; then
    echo "❌ Arquivo scripts/install-chrome.js não encontrado"
    exit 1
fi

if [ ! -f "PUPPETEER_SETUP.md" ]; then
    echo "❌ Arquivo PUPPETEER_SETUP.md não encontrado"
    exit 1
fi

echo "✅ Arquivos de configuração presentes"

# Verificar package.json
echo ""
echo "📦 Verificando configuração npm..."

if ! grep -q '"puppeteer"' package.json; then
    echo "❌ Puppeteer não encontrado no package.json"
    exit 1
fi

if ! grep -q '"postinstall".*puppeteer' package.json; then
    echo "❌ Script postinstall não configurado no package.json"
    exit 1
fi

echo "✅ Configuração npm verificada"

# Verificar código do servidor
echo ""
echo "🔍 Verificando código do servidor..."

if ! grep -q "const puppeteer = require('puppeteer')" src/interfaces/web/server.js; then
    echo "❌ Puppeteer não importado no servidor"
    exit 1
fi

if ! grep -q "puppeteer.launch" src/interfaces/web/server.js; then
    echo "❌ Puppeteer.launch não encontrado no código"
    exit 1
fi

echo "✅ Código do servidor verificado"

# Configurar variáveis de ambiente recomendadas
echo ""
echo "🔧 Configurando variáveis de ambiente..."

echo "Configurando NODE_ENV=production..."
eb setenv NODE_ENV=production

echo "Configurando PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true..."
eb setenv PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

echo "Configurando PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable..."
eb setenv PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

echo "✅ Variáveis de ambiente configuradas"

# Mostrar resumo
echo ""
echo "📋 RESUMO DA CONFIGURAÇÃO:"
echo "========================="
echo "✅ Chrome será instalado via .ebextensions/01_chrome_install.config"
echo "✅ Puppeteer configurado para produção"
echo "✅ Scripts de fallback disponíveis"
echo "✅ Tratamento de erros implementado"
echo "✅ Logs detalhados habilitados"

echo ""
echo "⚠️  IMPORTANTE:"
echo "   - Primeira execução pode ser lenta (instalação do Chrome)"
echo "   - Monitor logs com: eb logs --all"
echo "   - Teste endpoint: GET /api/import-bgg-games"

# Confirmar deploy
echo ""
read -p "🤔 Continuar com o deploy? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deploy cancelado pelo usuário"
    exit 1
fi

# Executar deploy
echo ""
echo "🚀 Executando deploy..."
echo "======================="

eb deploy

# Verificar se deploy foi bem-sucedido
if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Deploy concluído com sucesso!"
    echo ""
    echo "📋 PRÓXIMOS PASSOS:"
    echo "==================="
    echo "1. Aguardar 2-3 minutos para Chrome instalar"
    echo "2. Testar endpoint: GET /api/import-bgg-games"
    echo "3. Monitorar logs: eb logs --all"
    echo "4. Verificar health: GET /health"
    echo ""
    echo "🔗 Para ver logs em tempo real:"
    echo "   eb logs --all -f"
    echo ""
    echo "🐛 Em caso de problemas:"
    echo "   - Consultar PUPPETEER_SETUP.md"
    echo "   - Executar scripts/install-chrome.js manualmente"
    echo "   - Verificar variáveis de ambiente"
    
else
    echo ""
    echo "❌ Deploy falhou!"
    echo ""
    echo "🔍 DIAGNÓSTICO:"
    echo "==============="
    echo "1. Verificar logs: eb logs --all"
    echo "2. Verificar status: eb status"
    echo "3. Consultar PUPPETEER_SETUP.md"
    echo ""
    exit 1
fi