# 🤖 Configuração do Puppeteer para BGG Data Import

Este documento descreve como configurar o Puppeteer para funcionar corretamente no AWS Elastic Beanstalk.

## 📋 Problema Original

O BGG (BoardGameGeek) usa conteúdo dinâmico gerado via JavaScript/Angular para o link "Click to Download" na página de data dumps. Requests HTTP simples não conseguem acessar este conteúdo, necessitando um navegador real.

## ✅ Solução Implementada

### 1. **Puppeteer como Solução Principal**
- Substitui método anterior de delays progressivos
- Executa JavaScript real no navegador
- Obtém URLs AWS assinadas dinamicamente
- Funciona de forma consistente

### 2. **Configuração Automática de Chrome**
- Script `.ebextensions/01_chrome_install.config` instala Chrome no deploy
- Script `scripts/install-chrome.js` para instalação manual
- Hook `postinstall` no package.json baixa Chrome via npm

### 3. **Detecção Inteligente de Ambiente**
- Configura paths diferentes para desenvolvimento/produção
- Busca Chrome em múltiplos paths possíveis
- Logs detalhados para diagnóstico

## 🚀 Deploy no AWS Elastic Beanstalk

### **Automático (Recomendado)**
O arquivo `.ebextensions/01_chrome_install.config` instala Chrome automaticamente durante o deploy:

```bash
# Fazer deploy normalmente
eb deploy
```

### **Manual (Se necessário)**
Se a instalação automática falhar:

```bash
# SSH no servidor EB
eb ssh

# Instalar Chrome manualmente
sudo yum update -y
sudo yum install -y google-chrome-stable

# Verificar instalação
/usr/bin/google-chrome-stable --version

# Configurar variável de ambiente
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome-stable"
```

## 🔧 Configurações de Produção

### **Variáveis de Ambiente**
Configure no AWS EB:

```bash
eb setenv NODE_ENV=production
eb setenv PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
eb setenv PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

### **Configuração do Puppeteer**
O código detecta automaticamente o ambiente e configura:

- **Desenvolvimento**: Usa Chrome bundled do Puppeteer
- **Produção**: Procura Chrome instalado no sistema
- **Fallback**: Tenta usar Chromium bundled se Chrome não encontrado

## 🛠️ Scripts Disponíveis

### **Instalação Local**
```bash
# Instalar Chrome para Puppeteer
npm run install-chrome

# Instalar via npm (automático no postinstall)
npx puppeteer browsers install chrome
```

### **Verificação**
```bash
# Testar Puppeteer localmente
node test_puppeteer_local.js

# Testar rota completa (se servidor estiver rodando)
node test_route_with_puppeteer.js
```

## 🐛 Diagnóstico de Problemas

### **Erro: "Could not find Chrome"**
**Causa**: Chrome não instalado no servidor
**Solução**: 
1. Aguardar deploy do `.ebextensions` completar
2. Executar `npm run install-chrome` manualmente
3. Configurar `PUPPETEER_EXECUTABLE_PATH`

### **Erro: "Navigation timeout"**
**Causa**: BGG fora do ar ou conectividade
**Solução**: Aguardar alguns minutos e tentar novamente

### **Erro: "Target closed"**
**Causa**: Falta de recursos no servidor
**Solução**: Verificar memória disponível, considerar upgrade de instância

## 📊 Logs de Monitoramento

O sistema fornece logs detalhados:

```
🌍 Ambiente detectado: PRODUÇÃO
🔧 Configurando Puppeteer para produção...
🔍 Procurando Chrome em: /usr/bin/chromium-browser, /usr/bin/chromium, ...
✅ Chrome encontrado em: /usr/bin/google-chrome-stable
🚀 Iniciando navegador Puppeteer...
🔐 Fazendo login via Puppeteer...
✅ Login Puppeteer realizado
📡 Navegando para página de data dumps...
🔍 Procurando link "Click to Download"...
✅ Link "Click to Download" encontrado via Puppeteer!
📥 Link encontrado: https://geek-export-stats.s3.amazonaws.com/...
🔒 Navegador Puppeteer fechado
```

## ⚡ Performance

- **Tempo médio**: 15-30 segundos (inclui login + navegação)
- **Recursos**: ~200MB RAM adicional durante execução
- **Cache**: Puppeteer cache é mantido entre execuções
- **Timeout**: 30 segundos máximo para encontrar link

## 🔒 Segurança

- Navegador executado em modo headless
- Flags de segurança habilitadas (`--no-sandbox`, `--disable-setuid-sandbox`)
- Credenciais BGG via variáveis de ambiente
- Browser sempre fechado após uso (cleanup automático)

## 📝 Monitoramento

Para monitorar o funcionamento em produção:

1. **Logs do EB**: `eb logs` para ver saída do Puppeteer
2. **CloudWatch**: Métricas de CPU/memória durante execução
3. **Health Check**: Rota `/health` permanece disponível
4. **Timeout Monitoring**: Alerts se importação demorar muito

---

💡 **Dica**: O primeiro uso após deploy pode ser mais lento devido à inicialização do Chrome. Usos subsequentes são mais rápidos.