# BGG-Ludopedia Sync

Sistema completo para sincronização e comparação de coleções entre BoardGameGeek (BGG) e Ludopedia, com interface web moderna e funcionalidades avançadas de matching inteligente.

## 🎯 Objetivo

Facilitar a vida de colecionadores que mantêm suas coleções tanto no BGG quanto na Ludopedia, oferecendo:
- **Interface Web Moderna**: Aplicação web responsiva com Bootstrap
- **Comparação Automática**: Identifica jogos presentes em apenas uma das plataformas
- **Match Inteligente com IA**: Usa ChatGPT para identificar jogos com nomes diferentes (traduções, variações)
- **Persistência de Dados**: Salva matches e configurações localmente
- **Autenticação OAuth**: Integração completa com a API da Ludopedia
- **Banco de Dados PostgreSQL**: Armazenamento robusto de dados

## 🚀 Funcionalidades Principais

### 🔐 Autenticação e Configuração
- **OAuth Ludopedia**: Autenticação automática via OAuth 2.0
- **Configuração Flexível**: Interface para configurar credenciais BGG e Ludopedia
- **Validação de Credenciais**: Testa conexões antes de executar operações

### 📊 Sincronização de Coleções
- **BGG API Integration**: Busca automática via API XML com retry logic
- **Ludopedia API Integration**: Busca paginada via API REST com rate limiting
- **Suporte Completo**: Jogos base e expansões com metadata completa
- **Cache Local**: Salva coleções para uso offline

### 🔍 Comparação Inteligente
- **Match Exato**: Identifica jogos com nomes idênticos
- **Match com IA**: ChatGPT analisa nomes diferentes e sugere matches
- **Match Manual**: Interface para criar matches personalizados
- **Histórico de Matches**: Salva matches aceitos para evitar duplicação

### 🌐 Interface Web
- **Dashboard Interativo**: Estatísticas visuais das coleções
- **Filtros Dinâmicos**: Filtra por tipo de jogo, expansões, etc.
- **Responsive Design**: Funciona em desktop e mobile
- **Feedback Visual**: Loading states, confirmações e notificações

### 💾 Persistência de Dados
- **PostgreSQL**: Banco de dados robusto para produção
- **Arquivos JSON**: Backup local de coleções e matches
- **Configuração Flexível**: Suporte a múltiplos ambientes

## 🏗 Arquitetura do Projeto

### Interface Web (`/src/interfaces/web`)
- **server.js**: Servidor Express com APIs REST completas
- **public/index.html**: Interface web moderna com Bootstrap
- **public/js/app.js**: JavaScript frontend para interações

### APIs (`/src/api`)
- **bggApi.js**: Cliente BGG com retry logic e validação
  - `fetchCollection()`: Busca coleção completa
  - `fetchCollectionByType()`: Busca por tipo com filtros
  - `validateUser()`: Valida existência do usuário
  - `testConnection()`: Testa conectividade

- **ludopediaApi.js**: Cliente Ludopedia com paginação
  - `fetchCollection()`: Busca coleção completa
  - `fetchCollectionByType()`: Busca paginada por tipo
  - `testConnection()`: Valida token e conectividade

### Comparação (`/src/comparison`)
- **matcher.js**: Engine de comparação de coleções
  - `compareCollections()`: Compara e identifica diferenças
  - Normalização de nomes e detecção de matches

- **chatGptMatch.js**: Integração com OpenAI
  - `findMatches()`: Análise inteligente de nomes diferentes
  - Matching baseado em contexto e similaridade

### Utilitários (`/src/collection`)
- **loader.js**: Gerenciamento de arquivos de coleção
  - `loadFromFile()`: Carrega coleções salvas
  - `saveToFile()`: Persiste coleções localmente

### Configuração (`/config`)
- **config.js**: Configurações centralizadas
- **Variáveis de Ambiente**: Gerenciamento seguro de credenciais

## 🔧 Instalação e Configuração

### 1. Instalação
```bash
npm install
```

### 2. Configuração de Ambiente
Criar arquivo `.env` com:
```env
# BGG
BGG_USER=seu_usuario_bgg

# Ludopedia OAuth
LUDO_CLIENT_ID=seu_client_id
LUDO_CLIENT_SECRET=seu_client_secret  
LUDO_REDIRECT_URI=http://localhost:8080/callback

# OpenAI (opcional)
OPENAI_API_KEY=sua_api_key

# PostgreSQL
DATABASE_URL=postgresql://usuario:senha@host:porta/database
```

### 3. Executar Aplicação
```bash
# Servidor web
npm start
# ou
npm run web

# Desenvolvimento com auto-reload
npm run web:dev
```

## 🖥 Uso da Interface Web

1. **Acesse**: http://localhost:8080
2. **Configure**: Clique no ícone de configurações para inserir credenciais
3. **Autentique**: Use o botão "Autenticar Ludopedia" para OAuth
4. **Sincronize**: Carregue coleções via API ou arquivos locais
5. **Compare**: Execute comparação automática ou com IA
6. **Gerencie**: Aceite matches sugeridos ou crie matches manuais

## 📦 Scripts Disponíveis

- `npm start`: Inicia servidor web
- `npm run web`: Inicia servidor web
- `npm run web:dev`: Desenvolvimento com nodemon
- `npm test`: Executa testes
- `npm run dev`: Desenvolvimento do script principal

## 🔌 APIs Disponíveis

### Coleções
- `POST /api/collections`: Carrega coleções (API/arquivo)
- `POST /api/save-collections`: Salva coleções localmente

### Comparação
- `POST /api/match-collections`: Comparação automática
- `POST /api/match-collections-ai`: Comparação com IA
- `POST /api/accept-matches`: Aceita matches sugeridos
- `POST /api/save-manual-match`: Salva match manual

### Configuração
- `GET /api/config`: Obtém configurações
- `POST /api/config`: Salva configurações
- `GET /api/auth/ludopedia`: Inicia OAuth Ludopedia
- `GET /callback`: Callback OAuth

### Banco de Dados
- `GET /create-database`: Cria banco PostgreSQL
- `GET /test-database-setup`: Testa configuração do banco

## 🛠 Tecnologias Utilizadas

- **Backend**: Node.js, Express.js
- **Frontend**: Bootstrap 5, JavaScript vanilla
- **APIs**: Axios para HTTP requests
- **Banco**: PostgreSQL com pg driver
- **Parsing**: xml2js para BGG XML API
- **IA**: OpenAI ChatGPT API
- **Autenticação**: OAuth 2.0
- **Desenvolvimento**: Nodemon, Jest