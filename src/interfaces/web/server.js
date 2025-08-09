require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const BGGApi = require('../../api/bggApi');
const LudopediaApi = require('../../api/ludopediaApi');
const CollectionMatcher = require('../../comparison/matcher');
const ChatGPTMatcher = require('../../comparison/chatGptMatch');
const DatabaseManager = require('../../database/dbManager');
const MatchManager = require('../../database/matchManager');
const UserManager = require('../../database/userManager');
const puppeteer = require('puppeteer');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 7 dias

const app = express();

// Cache temporário para tokens OAuth (usar Redis em produção)
const tokenCache = new Map();

// Middleware de autenticação JWT
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso necessário' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userManager = new UserManager();
    await userManager.connect();
    
    try {
      // Validar sessão no banco de dados
      const user = await userManager.validateSession(decoded.jti);
      if (!user) {
        return res.status(403).json({ error: 'Sessão inválida ou expirada' });
      }
      
      req.user = user;
      next();
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('❌ Erro na autenticação:', error);
    return res.status(403).json({ error: 'Token inválido' });
  }
}

// Função para gerar JWT
function generateJWT(user, jwtId) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      jti: jwtId // JWT ID único para controle de sessão
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Função para extrair informações do usuário do token (opcional, sem validar sessão)
function getUserFromToken(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return null;
  
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Aumentar limite do body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rota principal - sempre mostra index.html com tagline
app.get('/', async (req, res) => {
  console.log('🔍 Rota principal / foi chamada');
  // Sempre mostrar aplicação principal com tagline
  const fs = require('fs');
  let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  
  try {
    const dbManager = new DatabaseManager();
    await dbManager.connect();
    const tagline = await dbManager.getRandomTagline();
    await dbManager.disconnect();
    
    // Substituir placeholders da tagline (navbar e aba início)
    if (tagline) {
      console.log('✅ Tagline encontrada:', tagline);
      // Substituir todas as ocorrências: navbar com formato especial, aba início apenas texto
      html = html.replace('<span class="navbar-tagline">{{TAGLINE}}</span>', `<span class="navbar-tagline"> – "${tagline}"</span>`);
      html = html.replace('<p class="hero-subtitle">\n                                {{TAGLINE}}\n                            </p>', `<p class="hero-subtitle">\n                                ${tagline}\n                            </p>`);
    } else {
      console.log('⚠️ Nenhuma tagline encontrada no banco');
      // Remover todos os placeholders
      html = html.replace(/{{TAGLINE}}/g, '');
    }
  } catch (error) {
    console.error('❌ Erro ao buscar tagline:', error);
    // Em caso de erro, servir arquivo sem tagline (substituir placeholder por string vazia)
    html = html.replace('{{TAGLINE}}', '');
  }
  
  res.send(html);
});

// Rota para index.html diretamente - redireciona para a rota principal
app.get('/index.html', async (req, res) => {
  // Redirecionar para a rota principal que processa taglines
  res.redirect('/');
});

// Rota para página de login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rota para página de cadastro
app.get('/cadastro', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cadastro.html'));
});

// Rota para acessar a aplicação principal (quando autenticado)
app.get('/app', async (req, res) => {
  console.log('🔍 Rota /app foi chamada');
  const fs = require('fs');
  let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  
  try {
    const dbManager = new DatabaseManager();
    await dbManager.connect();
    const tagline = await dbManager.getRandomTagline();
    await dbManager.disconnect();
    
    // Substituir placeholders da tagline (navbar e aba início)
    if (tagline) {
      console.log('✅ Tagline encontrada:', tagline);
      // Substituir todas as ocorrências: navbar com formato especial, aba início apenas texto
      html = html.replace('<span class="navbar-tagline">{{TAGLINE}}</span>', `<span class="navbar-tagline"> – "${tagline}"</span>`);
      html = html.replace('<p class="hero-subtitle">\n                                {{TAGLINE}}\n                            </p>', `<p class="hero-subtitle">\n                                ${tagline}\n                            </p>`);
    } else {
      console.log('⚠️ Nenhuma tagline encontrada no banco');
      // Remover todos os placeholders
      html = html.replace(/{{TAGLINE}}/g, '');
    }
  } catch (error) {
    console.error('❌ Erro ao buscar tagline:', error);
    // Em caso de erro, servir arquivo sem tagline (substituir placeholder por string vazia)
    html = html.replace('{{TAGLINE}}', '');
  }
  
  res.send(html);
});

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Rota para criar/verificar database e suas tabelas (funciona apenas no ambiente AWS)
app.get('/create-database', async (req, res) => {
  try {
    console.log('🏗️ Verificando/criando setup do banco...');
    
    // Verificar se temos DATABASE_URL configurada
    if (!process.env.DATABASE_URL) {
      return res.json({ 
        success: false, 
        error: 'DATABASE_URL não configurada'
      });
    }
    
    console.log('🌐 Tentando criar/verificar database e tabelas...');
    
    // Como a DATABASE_URL já aponta para o database bggludopedia,
    // vamos apenas criar as tabelas diretamente
    const dbManager = new DatabaseManager();
    
    try {
      await dbManager.createTables();
      console.log('✅ Tabelas criadas/verificadas com sucesso!');
      
      res.json({ 
        success: true, 
        message: 'Database e tabelas verificados/criados com sucesso!',
        environment: 'AWS',
        databaseExists: true,
        tablesCreated: true
      });
    } catch (tableError) {
      console.error('❌ Erro ao criar tabelas:', tableError);
      
      // Se o erro for relacionado ao database não existir, vamos tentar criar
      if (tableError.message.includes('database') && tableError.message.includes('does not exist')) {
        console.log('🔧 Database não existe, tentando criar...');
        
        try {
          // Extrair URL base (sem o database name)
          const dbUrl = new URL(process.env.DATABASE_URL);
          const baseUrl = `${dbUrl.protocol}//${dbUrl.username}:${dbUrl.password}@${dbUrl.host}:${dbUrl.port}/postgres`;
          
          const adminClient = new Client({
            connectionString: baseUrl,
            ssl: { rejectUnauthorized: false }
          });
          
          await adminClient.connect();
          console.log('✅ Conectado ao postgres admin!');
          
          // Criar database
          await adminClient.query('CREATE DATABASE bggludopedia');
          console.log('✅ Database bggludopedia criado!');
          await adminClient.end();
          
          // Tentar criar tabelas novamente
          await dbManager.createTables();
          
          res.json({ 
            success: true, 
            message: 'Database criado e tabelas configuradas com sucesso!',
            environment: 'AWS',
            databaseCreated: true,
            tablesCreated: true
          });
        } catch (createError) {
          console.error('❌ Erro ao criar database:', createError);
          res.json({ 
            success: false, 
            error: 'Erro ao criar database: ' + createError.message
          });
        }
      } else {
        res.json({ 
          success: false, 
          error: 'Erro ao criar tabelas: ' + tableError.message
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
    res.json({ success: false, error: error.message });
  }
});

// Rota para testar setup completo do banco PostgreSQL
app.get('/test-database-setup', async (req, res) => {
  try {
    console.log('🔗 Testando conexão direta com banco bggludopedia...');
    
    const databaseUrl = process.env.DATABASE_URL;
    console.log('📋 DATABASE_URL existe:', !!databaseUrl);
    console.log('📋 DATABASE_URL (primeiros 50 chars):', databaseUrl?.substring(0, 50));
    
    if (!databaseUrl) {
      return res.json({ success: false, error: 'DATABASE_URL não encontrada' });
    }
    
    console.log('🔗 Conectando diretamente ao banco bggludopedia...');
    const client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000, // 10 segundos timeout
    });
    
    await client.connect();
    console.log('✅ Conectado ao banco bggludopedia!');
    
    // Teste básico
    const result = await client.query('SELECT NOW() as current_time, current_database() as db_name, version() as db_version');
    console.log('📊 Teste básico realizado com sucesso!');
    
    // Teste de criação de tabela
    console.log('🏗️ Testando criação de tabela...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS connection_test (
        id SERIAL PRIMARY KEY,
        test_time TIMESTAMP DEFAULT NOW(),
        message TEXT
      )
    `);
    console.log('✅ Tabela connection_test criada/verificada!');
    
    // Inserir dados de teste
    await client.query(`
      INSERT INTO connection_test (message) 
      VALUES ('Teste de conexão - ${new Date().toISOString()}')
    `);
    console.log('📝 Dados de teste inseridos!');
    
    // Consultar dados
    const testData = await client.query('SELECT * FROM connection_test ORDER BY id DESC LIMIT 1');
    console.log('📋 Último registro consultado!');
    
    await client.end();
    console.log('🔌 Conexão fechada com sucesso!');
    
    res.json({
      success: true,
      message: 'Conexão com banco estabelecida com sucesso!',
      database: {
        name: result.rows[0].db_name,
        timestamp: result.rows[0].current_time,
        version: result.rows[0].db_version.split(' ')[0],
        lastTest: testData.rows[0]
      }
    });
    
  } catch (error) {
    console.error('❌ Erro na conexão:', error);
    
    let errorSuggestion = '';
    if (error.code === 'ETIMEDOUT') {
      errorSuggestion = 'Timeout na conexão - verificar security group ou conectividade de rede';
    } else if (error.code === 'ENOTFOUND') {
      errorSuggestion = 'Host do banco não encontrado - verificar URL de conexão';
    } else if (error.code === '28P01') {
      errorSuggestion = 'Credenciais inválidas - verificar username/password';
    } else if (error.code === '3D000') {
      errorSuggestion = 'Database não existe - verificar nome do database na URL';
    }
    
    res.json({
      success: false,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        suggestion: errorSuggestion
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Servir arquivos estáticos com headers específicos
// IMPORTANTE: Colocado após as rotas dinâmicas para não interferir na substituição de taglines
// EXCLUIR index.html do static para forçar uso das rotas dinâmicas
app.use(express.static(path.join(__dirname, 'public'), {
  index: false, // Não servir index.html automaticamente
  setHeaders: (res, path, stat) => {
    if (path.endsWith('.png')) {
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=31536000');
    }
    if (path.endsWith('favicon.png')) {
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// API para sincronização
app.post('/api/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userManager = new UserManager();
    await userManager.connect();
    
    let userData;
    try {
      userData = await userManager.getUserWithTokens(userId);
      
      if (!userData || !userData.bgg_username || !userData.tokens?.ludopedia?.access_token) {
        throw new Error('Credenciais não configuradas. Clique no ícone de configurações para configurar.');
      }
      
      const bggApi = new BGGApi(userData.bgg_username);
      const ludoApi = new LudopediaApi(userData.tokens.ludopedia.access_token);

    // Buscar coleções
    const [bggCollection, ludoCollection] = await Promise.all([
      bggApi.fetchCollection(),
      ludoApi.fetchCollection()
    ]);

    // Comparar coleções
    const comparison = CollectionMatcher.compareCollections(bggCollection, ludoCollection);

    // Matching via IA se solicitado
    let extraMatches = [];
    if (req.body.useAI && process.env.OPENAI_API_KEY) {
      const chatGptMatcher = new ChatGPTMatcher(process.env.OPENAI_API_KEY);
      extraMatches = await chatGptMatcher.findMatches(
        comparison.onlyInBGG,
        comparison.onlyInLudo
      );
    }

    res.json({
      matches: comparison.matches,
      extraMatches,
      onlyInBGG: comparison.onlyInBGG,
      onlyInLudo: comparison.onlyInLudo
    });
    
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para carregar coleções automaticamente do banco (sem parâmetros)
app.get('/api/collections', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userManager = new UserManager();
    await userManager.connect();
    
    try {
      const userData = await userManager.getUserWithTokens(userId);
      
      if (!userData) {
        return res.json({
          bggCollection: [],
          ludoCollection: [],
          source: 'none',
          message: 'Usuário não encontrado. Faça login primeiro.'
        });
      }
      
      if (!userData.bgg_username) {
        return res.json({
          bggCollection: [],
          ludoCollection: [],
          source: 'none',
          message: 'Usuário BGG não configurado. Configure suas credenciais primeiro.'
        });
      }

    // Carregar do banco de dados
    console.log('💾 Carregando coleções do banco de dados automaticamente...');
    const dbManager = new DatabaseManager();
    let bggCollection = [];
    let ludoCollection = [];

    try {
      [bggCollection, ludoCollection] = await Promise.all([
        dbManager.getBGGCollection(userData.bgg_username),
        // Só carrega Ludopedia se o username estiver configurado
        userData.ludopedia_username ? 
          dbManager.getLudopediaCollection(userData.ludopedia_username) : 
          Promise.resolve([])
      ]);
      
      console.log(`📊 Carregado do banco: BGG=${bggCollection.length}, Ludopedia=${ludoCollection.length}`);
    } catch (dbError) {
      console.warn('⚠️ Erro ao carregar do banco:', dbError.message);
      return res.json({
        bggCollection: [],
        ludoCollection: [],
        source: 'none',
        message: 'Erro ao conectar com o banco de dados. Use "Carregar Coleções via API" para popular o banco.'
      });
    }
    
    // Garante que os campos de tipo estejam consistentes
    bggCollection = bggCollection.map(game => ({
      ...game,
      isExpansion: game.type === 'expansion' || game.subtype === 'expansion' || game.isExpansion === true
    }));
    
    ludoCollection = ludoCollection.map(game => ({
      ...game,
      isExpansion: game.type === 'expansion' || game.isExpansion === true
    }));

    res.json({
      bggCollection,
      ludoCollection,
      source: 'database',
      message: bggCollection.length === 0 && ludoCollection.length === 0 
        ? 'Banco de dados vazio. Use "Carregar Coleções via API" para popular o banco.'
        : null
    });

    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('❌ Error loading collections automatically:', error);
    res.status(500).json({ 
      error: error.message,
      bggCollection: [],
      ludoCollection: [],
      source: 'error'
    });
  }
});

// Rota para carregar coleções (API ou banco de dados)
app.post('/api/collections', authenticateToken, async (req, res) => {
  try {
    const { loadType } = req.body;
    let bggCollection, ludoCollection;

    const userId = req.user.id;
    
    const userManager = new UserManager();
    await userManager.connect();
    
    let userData;
    try {
      userData = await userManager.getUserWithTokens(userId);
      
      if (!userData || !userData.bgg_username) {
        throw new Error('Usuário BGG não configurado. Clique no ícone de configurações para configurar.');
      }
      
      if (loadType === 'api') {
        if (!userData.tokens?.ludopedia?.access_token) {
          throw new Error('Para carregar coleções via API, você precisa autenticar na Ludopedia primeiro. Clique no ícone de configurações (⚙️) e depois em "Autenticar Ludopedia".');
        }
        
        // Carregar via API
        console.log('📡 Carregando coleções via API...');
        const bggApi = new BGGApi(userData.bgg_username);
        const ludoApi = new LudopediaApi(userData.tokens.ludopedia.access_token);
        
        try {
          [bggCollection, ludoCollection] = await Promise.all([
            bggApi.fetchCollection(),
            ludoApi.fetchCollection()
          ]);
        } catch (apiError) {
          console.error('❌ Erro ao carregar via API:', apiError.message);
          
          // Verificar se é erro específico da Ludopedia (autenticação)
          if (apiError.message.includes('401') || apiError.message.includes('403') || 
              apiError.message.includes('token') || apiError.message.includes('unauthorized') ||
              apiError.message.includes('Authentication') || apiError.message.includes('Invalid token')) {
            throw new Error('Houve um erro ao carregar a coleção da Ludopedia. A autenticação na Ludopedia precisa ser refeita. Clique no ícone de configurações para autenticar novamente.');
          }
          
          // Para outros erros, manter mensagem original
          throw new Error(`Erro ao carregar coleções via API: ${apiError.message}`);
        }
        
        console.log(`📊 Carregado via API: BGG=${bggCollection.length}, Ludopedia=${ludoCollection.length}`);
      } else {
        // Carregar do banco de dados
        console.log('💾 Carregando coleções do banco de dados...');
        const dbManager = new DatabaseManager();
        
        try {
          [bggCollection, ludoCollection] = await Promise.all([
            dbManager.getBGGCollection(userData.bgg_username),
            // Só carrega Ludopedia se o username estiver configurado
            userData.ludopedia_username ? 
              dbManager.getLudopediaCollection(userData.ludopedia_username) : 
              Promise.resolve([])
          ]);
          
          console.log(`📊 Carregado do banco: BGG=${bggCollection.length}, Ludopedia=${ludoCollection.length}`);
          
          // Se não há dados no banco, tentar carregar via API automaticamente
          if (bggCollection.length === 0 && ludoCollection.length === 0) {
            console.log('📭 Banco vazio, tentando carregar via API...');
            
            if (!userData.tokens?.ludopedia?.access_token) {
              throw new Error('Nenhuma coleção encontrada no banco de dados. Para carregar automaticamente via API, você precisa autenticar na Ludopedia primeiro. Clique no ícone de configurações (⚙️) e depois em "Autenticar Ludopedia", ou use o botão "Carregar Coleções via API".');
            }
            
            const bggApi = new BGGApi(userData.bgg_username);
            const ludoApi = new LudopediaApi(userData.tokens.ludopedia.access_token);
            
            try {
              [bggCollection, ludoCollection] = await Promise.all([
                bggApi.fetchCollection(),
                ludoApi.fetchCollection()
              ]);
            } catch (apiError) {
              console.error('❌ Erro ao carregar via API (fallback):', apiError.message);
              
              // Verificar se é erro específico da Ludopedia (autenticação)
              if (apiError.message.includes('401') || apiError.message.includes('403') || 
                  apiError.message.includes('token') || apiError.message.includes('unauthorized') ||
                  apiError.message.includes('Authentication') || apiError.message.includes('Invalid token')) {
                throw new Error('Houve um erro ao carregar a coleção da Ludopedia. A autenticação na Ludopedia precisa ser refeita. Clique no ícone de configurações para autenticar novamente.');
              }
              
              // Para outros erros, manter mensagem original
              throw new Error(`Erro ao carregar coleções via API: ${apiError.message}`);
            }
            
            console.log(`📊 Carregado via API (fallback): BGG=${bggCollection.length}, Ludopedia=${ludoCollection.length}`);
          }
        } catch (dbError) {
          console.error('❌ Erro ao carregar do banco:', dbError.message);
          throw new Error('Erro ao carregar coleções do banco de dados. Tente carregar via API ou verifique a configuração do banco.');
        }
      }
    
    // Garante que os campos de tipo estejam consistentes
    bggCollection = bggCollection.map(game => ({
      ...game,
      isExpansion: game.type === 'expansion' || game.subtype === 'expansion' || game.isExpansion === true
    }));
    
    ludoCollection = ludoCollection.map(game => ({
      ...game,
      isExpansion: game.type === 'expansion' || game.isExpansion === true
    }));

    res.json({
      bggCollection,
      ludoCollection,
      source: loadType === 'api' ? 'api' : 'database'
    });
    
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('❌ Error loading collections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para obter configurações
app.get('/api/config', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userManager = new UserManager();
    
    try {
      await userManager.connect();
      
      const userData = await userManager.getUserWithTokens(userId);
      
      if (!userData) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      // Retornar apenas dados necessários para o frontend
      const config = {
        BGG_USER: userData.bgg_username,
        LUDO_USER: userData.ludopedia_username,
        LUDO_ACCESS_TOKEN: userData.tokens?.ludopedia?.access_token || null
      };
      
      res.json(config);
    } catch (dbError) {
      console.error('❌ Erro ao conectar com banco de dados:', dbError.message);
      return res.status(500).json({ error: 'Erro de conexão com banco de dados. Execute a migração primeiro.' });
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('Error reading user config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para iniciar autenticação Ludopedia (JavaScript)
app.get('/api/auth/ludopedia', (req, res) => {
  try {
    const { state } = req.query;
    
    if (!state) {
      return res.status(400).json({ error: 'State parameter is required' });
    }
    
    const clientId = process.env.LUDO_CLIENT_ID;
    const redirectUri = process.env.LUDO_REDIRECT_URI;
    const authUrl = `https://ludopedia.com.br/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;
    
    res.json({ authUrl });
  } catch (error) {
    console.error('Error starting auth:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para link direto de autenticação Ludopedia (HTML)
app.get('/auth/ludopedia/direct', (req, res) => {
  try {
    const { state } = req.query;
    
    if (!state) {
      return res.status(400).send('State parameter is required');
    }
    
    const clientId = process.env.LUDO_CLIENT_ID;
    const redirectUri = process.env.LUDO_REDIRECT_URI;
    const authUrl = `https://ludopedia.com.br/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error starting auth:', error);
    res.status(500).send('Erro na autenticação: ' + error.message);
  }
});

// Rota para polling do resultado da autenticação
app.get('/auth/result', (req, res) => {
  try {
    const { state } = req.query;
    
    if (!state) {
      return res.status(400).json({ error: 'State parameter is required' });
    }
    
    const authData = tokenCache.get(state);
    
    if (!authData) {
      return res.status(202).json({ status: 'pending' });
    }
    
    // Verificar se o token expirou (5 minutos)
    if (Date.now() - authData.timestamp > 5 * 60 * 1000) {
      tokenCache.delete(state);
      return res.status(404).json({ error: 'Token expired' });
    }
    
    // Remover do cache após uso
    tokenCache.delete(state);
    
    return res.json({
      status: 'success',
      token: authData.token,
      user: authData.user
    });
    
  } catch (error) {
    console.error('Error in auth result:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para salvar configurações
app.post('/api/config', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userManager = new UserManager();
    await userManager.connect();
    
    try {
      // Verificar se usuário existe
      let userData = await userManager.getUserById(userId);
      
      if (!userData) {
        // Criar usuário padrão se não existir
        userData = await userManager.createUser({
          email: 'default@boardgameguru.com',
          password_hash: 'temp_hash', // TODO: Remover quando implementar autenticação real
          name: 'Usuário Padrão',
          bgg_username: req.body.BGG_USER,
          ludopedia_username: req.body.LUDO_USER,
          preferred_platform: 'bgg'
        });
      } else {
        // Atualizar dados do usuário
        const updateData = {};
        if (req.body.BGG_USER) updateData.bgg_username = req.body.BGG_USER;
        if (req.body.LUDO_USER) updateData.ludopedia_username = req.body.LUDO_USER;
        
        if (Object.keys(updateData).length > 0) {
          userData = await userManager.updateUser(userId, updateData);
        }
      }
      
      // Salvar token OAuth da Ludopedia se fornecido
      if (req.body.LUDO_ACCESS_TOKEN) {
        await userManager.saveOAuthToken(
          userId,
          'ludopedia',
          req.body.LUDO_ACCESS_TOKEN
        );
      }
      
      res.json({ success: true });
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('Error saving user config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para atualizar configurações do usuário
app.put('/api/config', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { bgg_username, preferred_platform } = req.body;
    
    const userManager = new UserManager();
    await userManager.connect();
    
    try {
      // Verificar se usuário existe
      const userData = await userManager.getUserById(userId);
      
      if (!userData) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      const updateData = {};
      
      // Validar BGG username se fornecido
      if (bgg_username !== undefined) {
        // Só permitir inclusão se não tiver username atual
        if (userData.bgg_username) {
          return res.status(400).json({ 
            error: 'BGG username já está definido e não pode ser alterado' 
          });
        }
        
        // Validar se não está vazio
        if (!bgg_username || bgg_username.trim() === '') {
          return res.status(400).json({ 
            error: 'BGG username não pode estar vazio' 
          });
        }
        
        // Validar tamanho
        if (bgg_username.length > 50) {
          return res.status(400).json({ 
            error: 'BGG username deve ter no máximo 50 caracteres' 
          });
        }
        
        // Verificar se já existe outro usuário com o mesmo BGG username
        const existingUser = await userManager.getUserByBggUsername(bgg_username);
        if (existingUser && existingUser.id !== userId) {
          return res.status(409).json({ 
            error: 'Este username do BGG já está sendo usado por outro usuário' 
          });
        }
        
        // Validar se o username existe no BGG
        try {
          const bggApi = new BGGApi(bgg_username.trim());
          await bggApi.validateUser();
        } catch (validationError) {
          return res.status(400).json({ 
            error: `Usuário BGG '${bgg_username.trim()}' não existe no BoardGameGeek. Verifique se o nome está correto.`
          });
        }
        
        updateData.bgg_username = bgg_username.trim();
      }
      
      // Validar plataforma preferida se fornecida
      if (preferred_platform !== undefined) {
        if (!['bgg', 'ludopedia'].includes(preferred_platform)) {
          return res.status(400).json({ 
            error: 'Plataforma preferida deve ser "bgg" ou "ludopedia"' 
          });
        }
        
        updateData.preferred_platform = preferred_platform;
      }
      
      // Atualizar dados se há mudanças
      if (Object.keys(updateData).length > 0) {
        await userManager.updateUser(userId, updateData);
      }
      
      res.json({ success: true });
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('Error updating user config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para relatório "Lista da Vergonha BGG"
app.get('/api/insights/shame-list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userManager = new UserManager();
    await userManager.connect();
    
    try {
      // Verificar se usuário existe e tem BGG username
      const userData = await userManager.getUserById(userId);
      
      if (!userData) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      if (!userData.bgg_username) {
        return res.status(400).json({ 
          error: 'BGG username não configurado',
          needsBggSetup: true
        });
      }
      
      // Buscar jogos não jogados da coleção BGG
      const dbManager = new DatabaseManager();
      await dbManager.connect();
      
      try {
        const query = `
          SELECT game_id, name, year, thumbnail, num_plays
          FROM bgg_collection 
          WHERE user_name = $1 
            AND num_plays = 0 
            AND is_expansion = false
          ORDER BY name ASC
        `;
        
        const result = await dbManager.client.query(query, [userData.bgg_username]);
        const shameList = result.rows;
        
        res.json({
          success: true,
          bggUsername: userData.bgg_username,
          totalGames: shameList.length,
          games: shameList
        });
        
      } finally {
        await dbManager.disconnect();
      }
      
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('Erro ao buscar lista da vergonha BGG:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para relatório "Lista da Vergonha Ludopédia"
app.get('/api/insights/shame-list-ludopedia', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userManager = new UserManager();
    await userManager.connect();
    
    try {
      // Verificar se usuário existe e tem Ludopedia username
      const userData = await userManager.getUserById(userId);
      
      if (!userData) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      if (!userData.ludopedia_username) {
        return res.status(400).json({ 
          error: 'Ludopedia username não configurado',
          needsLudopediaSetup: true
        });
      }
      
      // Buscar jogos não jogados da coleção Ludopedia
      const dbManager = new DatabaseManager();
      await dbManager.connect();
      
      try {
        const query = `
          SELECT game_id, name, year, link, fl_jogou
          FROM ludopedia_collection 
          WHERE user_name = $1 
            AND fl_jogou = 0 
            AND is_expansion = false
          ORDER BY name ASC
        `;
        
        const result = await dbManager.client.query(query, [userData.ludopedia_username]);
        const shameList = result.rows;
        
        res.json({
          success: true,
          ludopediaUsername: userData.ludopedia_username,
          totalGames: shameList.length,
          games: shameList
        });
        
      } finally {
        await dbManager.disconnect();
      }
      
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('Erro ao buscar lista da vergonha Ludopedia:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de callback do OAuth
app.get('/callback', async (req, res) => {
  try {
    const { code, error: oauthError, state } = req.query;
    
    if (oauthError) {
      console.error('Erro OAuth:', oauthError);
      throw new Error(`Erro OAuth: ${oauthError}`);
    }
    
    if (!code) {
      console.error('Erro: Código de autorização não recebido');
      throw new Error('Código de autorização não recebido');
    }

    const clientId = process.env.LUDO_CLIENT_ID;
    const clientSecret = process.env.LUDO_CLIENT_SECRET;
    const redirectUri = process.env.LUDO_REDIRECT_URI;

    // Faz a requisição para obter o token
    const tokenResponse = await axios.post('https://ludopedia.com.br/tokenrequest', {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code
    }).catch(error => {
      if (error.response?.data) {
        console.error('Erro na requisição do token:', error.response.data);
      }
      throw error;
    });

    // Buscar o usuário da Ludopedia
    let ludoUsername = null;
    try {
      const userResponse = await axios.get('https://ludopedia.com.br/api/v1/me', {
        headers: {
          Authorization: `Bearer ${tokenResponse.data.access_token}`
        }
      });
      ludoUsername = userResponse.data.usuario;
    } catch (error) {
      console.error('Erro ao buscar usuário da Ludopedia:', error);
    }
    
    // Salvar token no cache usando state como chave
    if (state) {
      tokenCache.set(state, {
        token: tokenResponse.data.access_token,
        user: ludoUsername,
        timestamp: Date.now()
      });
      console.log(`✅ Token salvo no cache com state: ${state}`);
    }

    // Página de sucesso com mensagem clara
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Autenticação Ludopedia - Sucesso</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          body { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Arial', sans-serif;
          }
          .success-card {
            background: white;
            border-radius: 15px;
            padding: 2rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
            animation: slideIn 0.5s ease-out;
          }
          @keyframes slideIn {
            from { transform: translateY(-30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .success-icon {
            color: #28a745;
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          .countdown {
            color: #6c757d;
            font-size: 0.9rem;
            margin-top: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="success-card">
          <div class="success-icon">
            <img src="/BoardGameGuru.png" alt="BoardGameGuru" style="width: 64px; height: 64px;">
          </div>
          <h2 class="text-success mb-3">Conexão com a Ludopedia concluída!</h2>
          <p class="mb-3">Agora você já pode retornar para o BoardGameGuru!</p>
          ${ludoUsername ? `<p class="text-muted mb-3">Usuário: <strong>${ludoUsername}</strong></p>` : ''}
          <button class="btn btn-primary" onclick="closeWindow()">
            Voltar para o BoardGameGuru
          </button>
          <div class="countdown">
            Esta janela fechará automaticamente em <span id="countdown">3</span> segundos.
          </div>
        </div>

        <script>
          let seconds = 3;
          const countdownEl = document.getElementById('countdown');
          
          const timer = setInterval(() => {
            seconds--;
            countdownEl.textContent = seconds;
            if (seconds <= 0) {
              clearInterval(timer);
              window.close();
            }
          }, 1000);

          function closeWindow() {
            window.close();
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    let errorMessage = 'Erro na autenticação';
    if (error.response?.data?.error_description) {
      errorMessage += `: ${error.response.data.error_description}`;
    }
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Autenticação Ludopedia - Erro</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          body { 
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Arial', sans-serif;
          }
          .error-card {
            background: white;
            border-radius: 15px;
            padding: 2rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
            animation: slideIn 0.5s ease-out;
          }
          @keyframes slideIn {
            from { transform: translateY(-30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .error-icon {
            color: #dc3545;
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          .countdown {
            color: #6c757d;
            font-size: 0.9rem;
            margin-top: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="error-card">
          <div class="error-icon">❌</div>
          <h2 class="text-danger mb-3">Erro na Autenticação</h2>
          <p class="mb-2">${errorMessage}</p>
          <hr>
          <p class="mb-3">Por favor, feche esta janela e tente novamente.</p>
          <button class="btn btn-danger" onclick="window.close()">
            <i class="me-2">🔙</i>Fechar Janela
          </button>
          <div class="countdown">
            Esta janela fechará automaticamente em <span id="countdown">5</span> segundos.
          </div>
        </div>

        <script>
          let seconds = 5;
          const countdownEl = document.getElementById('countdown');
          
          const timer = setInterval(() => {
            seconds--;
            countdownEl.textContent = seconds;
            if (seconds <= 0) {
              clearInterval(timer);
              window.close();
            }
          }, 1000);
        </script>
      </body>
      </html>
    `);
  }
});

// Rota para cadastro de novo usuário
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, bggUsername, ludopediaToken, ludopediaUser, preferredPlatform } = req.body;
    
    // Validar campos obrigatórios
    if (!name || !email || !password || !ludopediaToken) {
      return res.status(400).json({
        error: 'Campos obrigatórios: name, email, password, ludopediaToken'
      });
    }
    
    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Formato de email inválido'
      });
    }
    
    // Validar força da senha (mínimo 6 caracteres)
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Senha deve ter pelo menos 6 caracteres'
      });
    }
    
    const userManager = new UserManager();
    await userManager.connect();
    
    try {
      // Verificar se email já existe
      const existingUser = await userManager.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: 'Este email já está sendo usado por outra conta'
        });
      }
      
      // Verificar se username BGG já está sendo usado (se fornecido)
      if (bggUsername) {
        const existingBggUser = await userManager.getUserByBggUsername(bggUsername);
        if (existingBggUser) {
          return res.status(409).json({
            error: 'Este username do BGG já está sendo usado por outra conta'
          });
        }
      }
      
      // Verificar se username Ludopedia já está sendo usado (se fornecido)
      if (ludopediaUser) {
        const existingLudopediaUser = await userManager.getUserByLudopediaUsername(ludopediaUser);
        if (existingLudopediaUser) {
          return res.status(409).json({
            error: 'Este username da Ludopedia já está sendo usado por outra conta'
          });
        }
      }
      
      // Hash da senha
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Criar usuário
      const newUser = await userManager.createUser({
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        name: name.trim(),
        bgg_username: bggUsername ? bggUsername.trim() : null,
        ludopedia_username: ludopediaUser ? ludopediaUser.trim() : null,
        preferred_platform: preferredPlatform || 'ludopedia'
      });
      
      console.log(`✅ Novo usuário criado: ${newUser.name} (${newUser.email})`);
      
      // Salvar token OAuth da Ludopedia
      if (ludopediaToken) {
        await userManager.saveOAuthToken(
          newUser.id,
          'ludopedia',
          ludopediaToken
        );
        console.log(`🔐 Token OAuth da Ludopedia salvo para usuário ${newUser.id}`);
      }
      
      // Retornar dados do usuário (sem senha)
      const { password_hash, ...userResponse } = newUser;
      
      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso!',
        user: userResponse
      });
      
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('❌ Erro no cadastro:', error);
    
    // Tratar erros específicos do banco
    if (error.code === '23505') { // Unique violation
      if (error.constraint === 'users_email_key') {
        return res.status(409).json({
          error: 'Este email já está sendo usado por outra conta'
        });
      }
    }
    
    res.status(500).json({
      error: 'Erro interno do servidor. Tente novamente mais tarde.'
    });
  }
});

// Endpoint de login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validar campos obrigatórios
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email e senha são obrigatórios'
      });
    }
    
    const userManager = new UserManager();
    await userManager.connect();
    
    try {
      // Buscar usuário por email
      const user = await userManager.getUserByEmail(email.toLowerCase().trim());
      if (!user) {
        return res.status(401).json({
          error: 'Email ou senha incorretos'
        });
      }
      
      // Verificar senha
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({
          error: 'Email ou senha incorretos'
        });
      }
      
      // Gerar JWT ID único para esta sessão
      const jwtId = uuidv4();
      
      // Calcular data de expiração
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias
      
      // Criar sessão no banco
      await userManager.createSession(
        user.id,
        jwtId,
        expiresAt,
        req.headers['user-agent'],
        req.ip
      );
      
      // Gerar JWT
      const token = generateJWT(user, jwtId);
      
      // Retornar dados do usuário (sem senha) e token
      const { password_hash, ...userResponse } = user;
      
      console.log(`✅ Login bem-sucedido: ${user.email}`);
      
      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        token,
        user: userResponse
      });
      
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({
      error: 'Erro interno do servidor. Tente novamente mais tarde.'
    });
  }
});

// Endpoint de logout
app.post('/api/logout', authenticateToken, async (req, res) => {
  try {
    const userManager = new UserManager();
    await userManager.connect();
    
    try {
      // Extrair JWT ID do token decodificado
      const authHeader = req.headers['authorization'];
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Revogar sessão específica
      await userManager.revokeSession(decoded.jti);
      
      console.log(`✅ Logout realizado: usuário ${req.user.email}`);
      
      res.json({
        success: true,
        message: 'Logout realizado com sucesso'
      });
      
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('❌ Erro no logout:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Endpoint para logout global (todas as sessões do usuário)
app.post('/api/logout-all', authenticateToken, async (req, res) => {
  try {
    const userManager = new UserManager();
    await userManager.connect();
    
    try {
      // Revogar todas as sessões do usuário
      const revokedCount = await userManager.revokeAllUserSessions(req.user.id);
      
      console.log(`✅ Logout global: usuário ${req.user.email}, ${revokedCount} sessões revogadas`);
      
      res.json({
        success: true,
        message: `Logout realizado em ${revokedCount} dispositivos`,
        revokedSessions: revokedCount
      });
      
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('❌ Erro no logout global:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Endpoint para validar token atual
app.get('/api/me', authenticateToken, (req, res) => {
  // req.user já foi populado pelo middleware authenticateToken
  res.json({
    success: true,
    user: req.user
  });
});

// Rota para salvar coleções no banco de dados
app.post('/api/save-collections', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userManager = new UserManager();
    await userManager.connect();
    
    let userData;
    try {
      userData = await userManager.getUserWithTokens(userId);
      
      if (!userData || !userData.bgg_username) {
        throw new Error('Usuário BGG não configurado');
      }
      
      const { bggCollection, ludoCollection } = req.body;
      
      console.log(`💾 Salvando coleções no banco de dados...`);
      console.log(`📊 BGG: ${bggCollection?.length || 0} jogos para ${userData.bgg_username}`);
      console.log(`📊 Ludopedia: ${ludoCollection?.length || 0} jogos para ${userData.ludopedia_username || 'não configurado'}`);
      
      const dbManager = new DatabaseManager();
      
      // Salvar coleções no banco de dados
      const results = {};
      
      if (bggCollection && bggCollection.length > 0) {
        results.bggSaved = await dbManager.saveBGGCollection(userData.bgg_username, bggCollection);
      }
      
      if (ludoCollection && ludoCollection.length > 0 && userData.ludopedia_username) {
        results.ludoSaved = await dbManager.saveLudopediaCollection(userData.ludopedia_username, ludoCollection);
      }
      
      console.log('✅ Coleções salvas no banco com sucesso!');
      res.json({ 
        success: true,
        message: 'Coleções salvas no banco de dados com sucesso!',
        results
      });
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('❌ Erro ao salvar coleções:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para encontrar matches entre coleções
app.post('/api/match-collections', authenticateToken, async (req, res) => {
  try {
    let { bggCollection, ludoCollection } = req.body;

    // Criar cópias das coleções para não interferir nas originais
    bggCollection = [...bggCollection];
    ludoCollection = [...ludoCollection];
    
    const userId = req.user.id;
    
    const userManager = new UserManager();
    await userManager.connect();
    
    let bggUser, ludoUser;
    try {
      const userData = await userManager.getUserWithTokens(userId);
      
      if (!userData || !userData.bgg_username) {
        throw new Error('Dados do usuário não encontrados');
      }
      
      bggUser = userData.bgg_username;
      if (!userData.ludopedia_username) {
        throw new Error('Usuário Ludopedia não configurado. Configure a autenticação da Ludopedia primeiro.');
      }
      ludoUser = userData.ludopedia_username;
      
      // Carregar matches prévios do banco
      const matchManager = new MatchManager();
      await matchManager.connect();
      const previousMatches = await matchManager.getMatches(bggUser, ludoUser);
      await matchManager.disconnect();

    // Remover jogos já pareados das listas
    const previousMatchCount = previousMatches.length;

    // Criar sets de jogos já matcheados para filtragem
    const matchedBggGames = new Set();
    const matchedLudoGames = new Set();
    
    previousMatches.forEach(match => {
        const bggKey = `${match.bggId}_${match.bggVersionId}`;
        matchedBggGames.add(bggKey);
        matchedLudoGames.add(match.ludoId);
    });

    // Filtrar jogos que já têm matches (não devem aparecer para novo matching)
    const originalBggCount = bggCollection.length;
    const originalLudoCount = ludoCollection.length;
    
    bggCollection = bggCollection.filter(bggGame => {
        const bggKey = `${bggGame.id}_${bggGame.versionId || '0'}`;
        return !matchedBggGames.has(bggKey);
    });

    ludoCollection = ludoCollection.filter(ludoGame => {
        return !matchedLudoGames.has(ludoGame.id);
    });

    console.log(`🔍 Filtrados ${originalBggCount - bggCollection.length} jogos BGG já matcheados`);
    console.log(`🔍 Filtrados ${originalLudoCount - ludoCollection.length} jogos Ludopedia já matcheados`);

    // Usar o matcher para comparar as coleções restantes
    const comparison = CollectionMatcher.compareCollections(bggCollection, ludoCollection);
    
    // Criar mapas com TODOS os jogos (base + expansões) para ter acesso completo
    // porque o CollectionMatcher pode retornar qualquer tipo de jogo
    const bggGameMap = new Map(
      bggCollection.map(game => [game.name.trim().toLowerCase(), game])
    );
    const ludoGameMap = new Map(
      ludoCollection.map(game => [game.name.trim().toLowerCase(), game])
    );

    // Transformar matches em objetos com os jogos completos
    const matches = comparison.matches
      .map(normalizedName => {
        const bggGame = bggGameMap.get(normalizedName);
        const ludoGame = ludoGameMap.get(normalizedName);
        
        // Validar que ambos os jogos foram encontrados e têm as propriedades necessárias
        if (bggGame?.name && ludoGame?.name) {
          return {
            bggGame: {
              id: bggGame.id,
              versionId: bggGame.versionId || '0',
              name: bggGame.name,
              type: bggGame.type,
              isExpansion: bggGame.isExpansion
            },
            ludoGame: {
              id: ludoGame.id,
              name: ludoGame.name,
              type: ludoGame.type,
              isExpansion: ludoGame.isExpansion
            },
            exactMatch: bggGame.name.trim() === ludoGame.name.trim()
          };
        }
        return null;
      })
      .filter(match => match !== null);
    
    // Arrays de jogos únicos (já filtrados automaticamente pois collections não incluem matcheados)
    const onlyInBGG = comparison.onlyInBGG
      .map(name => bggGameMap.get(name))
      .filter(game => game && game.name)
      .map(game => ({
        id: game.id,
        versionId: game.versionId || '0',
        name: game.name,
        type: game.type,
        isExpansion: game.isExpansion
      }));

    const onlyInLudo = comparison.onlyInLudo
      .map(name => ludoGameMap.get(name))
      .filter(game => game && game.name)
      .map(game => ({
        id: game.id,
        name: game.name,
        type: game.type,
        isExpansion: game.isExpansion
      }));
    
    res.json({
      matches,
      onlyInBGG,
      onlyInLudo,
      previousMatchCount
    });
    
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('Error matching collections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para encontrar matches com AI entre coleções
app.post('/api/match-collections-ai', authenticateToken, async (req, res) => {
  try {
    // Verificar se a API key da OpenAI está configurada
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada. Configure a variável de ambiente OPENAI_API_KEY para usar o matching com AI.');
    }

    let { bggCollection, ludoCollection } = req.body;
    const chatGptMatcher = new ChatGPTMatcher(process.env.OPENAI_API_KEY);
    
    // Criar cópias das coleções para não interferir nas originais
    bggCollection = [...bggCollection];
    ludoCollection = [...ludoCollection];

    const userId = req.user.id;
    
    const userManager = new UserManager();
    await userManager.connect();
    
    let bggUser, ludoUser;
    try {
      const userData = await userManager.getUserWithTokens(userId);
      
      if (!userData || !userData.bgg_username) {
        throw new Error('Dados do usuário não encontrados');
      }
      
      bggUser = userData.bgg_username;
      if (!userData.ludopedia_username) {
        throw new Error('Usuário Ludopedia não configurado. Configure a autenticação da Ludopedia primeiro.');
      }
      ludoUser = userData.ludopedia_username;
      
      // Carregar matches prévios do banco
      const matchManager = new MatchManager();
      await matchManager.connect();
      const previousMatches = await matchManager.getMatches(bggUser, ludoUser);
      await matchManager.disconnect();

    // Filtrar jogos já matcheados (mesma lógica do endpoint regular)
    const matchedBggGames = new Set();
    const matchedLudoGames = new Set();
    
    previousMatches.forEach(match => {
        const bggKey = `${match.bggId}_${match.bggVersionId}`;
        matchedBggGames.add(bggKey);
        matchedLudoGames.add(match.ludoId);
    });

    // Filtrar jogos que já têm matches
    const originalBggCount = bggCollection.length;
    const originalLudoCount = ludoCollection.length;
    
    bggCollection = bggCollection.filter(bggGame => {
        const bggKey = `${bggGame.id}_${bggGame.versionId || '0'}`;
        return !matchedBggGames.has(bggKey);
    });

    ludoCollection = ludoCollection.filter(ludoGame => {
        return !matchedLudoGames.has(ludoGame.id);
    });

    console.log(`🤖 AI: Filtrados ${originalBggCount - bggCollection.length} jogos BGG já matcheados`);
    console.log(`🤖 AI: Filtrados ${originalLudoCount - ludoCollection.length} jogos Ludopedia já matcheados`);

    // Verificar se temos jogos para comparar
    if (bggCollection.length === 0 || ludoCollection.length === 0) {
      return res.json({ 
        matches: [],
        message: "Não há jogos não pareados para comparar com AI"
      });
    }

    // Buscar matches adicionais usando AI
    let aiMatches;
    try {
      // Enviar TODOS os jogos não matcheados diretamente para o ChatGPT
      // IMPORTANTE: Não usar comparação por nomes, apenas IDs únicos
      const bggGamesForAI = bggCollection.map(game => ({
        id: game.id,
        versionId: game.versionId,
        name: game.name
      }));
      
      const ludoGamesForAI = ludoCollection.map(game => ({
        id: game.id,
        name: game.name
      }));

      aiMatches = await chatGptMatcher.findMatches(bggGamesForAI, ludoGamesForAI);
    } catch (aiError) {
      console.error('❌ Erro na análise da AI:', aiError);
      return res.status(500).json({
        error: 'Erro na análise da AI: ' + (aiError.message || 'Erro desconhecido na comunicação com ChatGPT')
      });
    }
    
    // Processar os matches da AI (agora já vêm com IDs!)
    const matches = [];
    for (const aiMatch of aiMatches) {
      if (!aiMatch.bggId || !aiMatch.ludoId || !aiMatch.bggName || !aiMatch.ludoName) {
        continue;
      }
      
      // Buscar os jogos completos nas coleções pelos IDs
      const bggGame = bggCollection.find(g => g.id === aiMatch.bggId);
      const ludoGame = ludoCollection.find(g => g.id === aiMatch.ludoId);
      
      if (bggGame && ludoGame) {
        matches.push({
          bgg: bggGame,
          ludopedia: ludoGame,
          confidence: 'ai-suggested'
        });
      }
    }
    
    res.json({ matches });
    
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('Error matching collections with AI:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para salvar matches regulares aceitos
app.post('/api/accept-matches', authenticateToken, async (req, res) => {
  try {
    const { matches } = req.body;
    
    const userId = req.user.id;
    
    const userManager = new UserManager();
    await userManager.connect();
    
    try {
      const userData = await userManager.getUserWithTokens(userId);
      
      if (!userData || !userData.bgg_username) {
        throw new Error('Dados do usuário não encontrados');
      }
      
      const bggUser = userData.bgg_username;
      if (!userData.ludopedia_username) {
        throw new Error('Usuário Ludopedia não configurado. Configure a autenticação da Ludopedia primeiro.');
      }
      const ludoUser = userData.ludopedia_username;
      
      // Converter matches para formato do banco
      const dbMatches = matches.map(match => ({
        bggUser,
        bggId: match.bggId,
        bggVersionId: match.bggVersionId || '0',
        ludoUser,
        ludoId: match.ludoId,
        matchType: 'name'
      }));
      
      // Salvar no banco de dados
      const matchManager = new MatchManager();
      await matchManager.connect();
      const result = await matchManager.saveMatches(dbMatches);
      await matchManager.disconnect();
      
      console.log(`✅ Salvos ${result.savedCount} matches automáticos por nome`);
      res.json({ success: true, savedCount: result.savedCount });
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('Error saving matches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para salvar matches da AI
app.post('/api/save-matches-ai', authenticateToken, async (req, res) => {
  try {
    const { matches } = req.body;
    
    const userId = req.user.id;
    
    const userManager = new UserManager();
    await userManager.connect();
    
    try {
      const userData = await userManager.getUserWithTokens(userId);
      
      if (!userData || !userData.bgg_username) {
        throw new Error('Dados do usuário não encontrados');
      }
      
      const bggUser = userData.bgg_username;
      if (!userData.ludopedia_username) {
        throw new Error('Usuário Ludopedia não configurado. Configure a autenticação da Ludopedia primeiro.');
      }
      const ludoUser = userData.ludopedia_username;
      
      // Converter matches para formato do banco
      const dbMatches = matches.map(match => ({
        bggUser,
        bggId: match.bggId,
        bggVersionId: match.bggVersionId || '0',
        ludoUser,
        ludoId: match.ludoId,
        matchType: 'ai'
      }));
      
      // Salvar no banco de dados
      const matchManager = new MatchManager();
      await matchManager.connect();
      const result = await matchManager.saveMatches(dbMatches);
      await matchManager.disconnect();
      
      console.log(`✅ Salvos ${result.savedCount} matches sugeridos por AI`);
      res.json({ success: true, savedCount: result.savedCount });
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('Error saving AI matches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para salvar match manual
app.post('/api/save-manual-match', authenticateToken, async (req, res) => {
  try {
    const { match } = req.body;

    // Validar dados do match
    if (!match || !match.bggId || !match.ludoId) {
      return res.status(400).json({ error: 'Dados do match inválidos' });
    }

    const userId = req.user.id;
    
    const userManager = new UserManager();
    await userManager.connect();
    
    try {
      const userData = await userManager.getUserWithTokens(userId);
      
      if (!userData || !userData.bgg_username) {
        throw new Error('Dados do usuário não encontrados');
      }
      
      const bggUser = userData.bgg_username;
      if (!userData.ludopedia_username) {
        throw new Error('Usuário Ludopedia não configurado. Configure a autenticação da Ludopedia primeira.');
      }
      const ludoUser = userData.ludopedia_username;
      
      // Preparar match para o banco
      const dbMatches = [{
        bggUser,
        bggId: match.bggId,
        bggVersionId: match.bggVersionId || '0',
        ludoUser,
        ludoId: match.ludoId,
        matchType: 'manual'
      }];
      
      
      // Salvar no banco de dados
      const matchManager = new MatchManager();
      await matchManager.connect();
      const result = await matchManager.saveMatches(dbMatches);
      await matchManager.disconnect();
      
      if (result.savedCount > 0) {
        console.log(`✅ Match manual salvo: ${match.bggName || match.bggId} ↔ ${match.ludoName || match.ludoId}`);
        res.json({ success: true });
      } else {
        if (result.hasConflicts) {
          res.status(409).json({ 
            error: 'Não foi possível salvar o pareamento. Os jogos selecionados já possuem pareamentos existentes na base de dados.'
          });
        } else {
          res.status(409).json({ error: 'Erro ao salvar pareamento' });
        }
      }
    } finally {
      await userManager.disconnect();
    }
  } catch (error) {
    console.error('Error saving manual match:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para importar dados do BGG (rankings globais)
app.get('/api/import-bgg-games', async (req, res) => {
  try {
    console.log('🎯 Iniciando importação de dados do BGG...');
    
    const csv = require('csv-parser');
    const { Readable } = require('stream');
    
    // Verificar credenciais BGG
    const bggLogin = process.env.MASTER_BGG_LOGIN;
    const bggPassword = process.env.MASTER_BGG_PASSWORD;
    
    if (!bggLogin || !bggPassword) {
      throw new Error('Credenciais BGG não configuradas. Configure MASTER_BGG_LOGIN e MASTER_BGG_PASSWORD nas variáveis de ambiente.');
    }
    
    // Criar cookie jar para manter sessão
    const tough = require('tough-cookie');
    const { wrapper } = require('axios-cookiejar-support');
    const cookieJar = new tough.CookieJar();
    const client = wrapper(axios.create({ jar: cookieJar }));
    
    // Fazer login no BGG usando API JSON moderna
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
        maxRedirects: 5,
        timeout: 15000
      }
    );
    
    console.log(`✅ Login realizado (status: ${loginResponse.status})`);
    
    // Verificar se login foi bem-sucedido (204 No Content é sucesso para esta API)
    if (loginResponse.status !== 204 && loginResponse.status !== 200) {
      throw new Error(`Falha no login BGG: ${loginResponse.status} - ${loginResponse.statusText}`);
    }
    
    // Processar cookies manualmente dos headers Set-Cookie
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
    
    // Usar Puppeteer para obter link dinâmico do BGG
    console.log('🤖 Usando Puppeteer para obter link de download dinâmico...');
    
    let browser;
    let downloadUrl;
    
    try {
      // Configuração otimizada do Puppeteer para produção
      const isProduction = process.env.NODE_ENV === 'production';
      console.log(`🌍 Ambiente detectado: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
      
      const puppeteerConfig = {
        headless: 'new', // Usar novo modo headless
        defaultViewport: { width: 1280, height: 800 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--memory-pressure-off',
          '--disable-background-networking',
          '--aggressive-cache-discard',
          '--metrics-recording-only',
          '--no-default-browser-check',
          '--password-store=basic',
          '--use-mock-keychain',
          '--single-process' // Importante para AWS EB
        ]
      };
      
      // Se em produção, configurar executablePath
      if (isProduction) {
        console.log('🔧 Configurando Puppeteer para produção...');
        
        // Tentar encontrar Chrome instalado
        const possiblePaths = [
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome',
          process.env.PUPPETEER_EXECUTABLE_PATH
        ].filter(Boolean);
        
        console.log(`🔍 Procurando Chrome em: ${possiblePaths.join(', ')}`);
        
        const fs = require('fs');
        let chromePath = null;
        
        for (const path of possiblePaths) {
          if (fs.existsSync(path)) {
            chromePath = path;
            console.log(`✅ Chrome encontrado em: ${chromePath}`);
            break;
          }
        }
        
        if (chromePath) {
          puppeteerConfig.executablePath = chromePath;
        } else {
          console.log('⚠️ Chrome não encontrado nos paths padrão, tentando usar Chromium bundled...');
        }
      }
      
      console.log('🚀 Iniciando navegador Puppeteer...');
      browser = await puppeteer.launch(puppeteerConfig);
      
      const page = await browser.newPage();
      
      // Configurar User-Agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Fazer login
      console.log('🔐 Fazendo login via Puppeteer...');
      await page.goto('https://boardgamegeek.com/login', { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      // Aguardar e preencher campos de login
      await page.waitForSelector('input[name="username"]', { timeout: 10000 });
      await page.waitForSelector('input[name="password"]', { timeout: 10000 });
      
      await page.type('input[name="username"]', bggLogin);
      await page.type('input[name="password"]', bggPassword);
      
      // Submeter login
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
        page.click('button[type="submit"], input[type="submit"]')
      ]);
      
      console.log('✅ Login Puppeteer realizado');
      
      // Navegar para página de data dumps
      console.log('📡 Navegando para página de data dumps...');
      
      // Tentar múltiplas estratégias de carregamento
      let pageLoaded = false;
      const navigationStrategies = [
        { waitUntil: 'domcontentloaded', timeout: 60000 },
        { waitUntil: 'networkidle2', timeout: 45000 },
        { waitUntil: 'load', timeout: 30000 }
      ];
      
      for (let i = 0; i < navigationStrategies.length && !pageLoaded; i++) {
        try {
          console.log(`🔄 Tentativa ${i + 1}/3: Estratégia ${navigationStrategies[i].waitUntil} (${navigationStrategies[i].timeout}ms)`);
          await page.goto('https://boardgamegeek.com/data_dumps/bg_ranks', navigationStrategies[i]);
          pageLoaded = true;
          console.log(`✅ Página carregada com estratégia ${navigationStrategies[i].waitUntil}`);
        } catch (navError) {
          console.log(`⚠️  Estratégia ${i + 1} falhou: ${navError.message}`);
          if (i === navigationStrategies.length - 1) {
            throw navError;
          }
          // Aguardar 2 segundos antes da próxima tentativa
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Procurar link "Click to Download" (aguardar até 45 segundos)
      console.log('🔍 Procurando link "Click to Download"...');
      
      // Aguardar alguns segundos para que a página termine de carregar completamente
      console.log('⏱️  Aguardando página estabilizar...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const maxWaitTime = 45000;
      const startTime = Date.now();
      
      let attemptCount = 0;
      while (Date.now() - startTime < maxWaitTime) {
        attemptCount++;
        console.log(`🔍 Tentativa ${attemptCount} - Buscando links na página...`);
        
        // Estratégia 1: Procurar por link com texto "Click to Download"
        const clickToDownloadLink = await page.evaluate(() => {
          const links = document.querySelectorAll('a');
          const foundLinks = [];
          for (const link of links) {
            foundLinks.push({
              text: link.textContent?.trim().toLowerCase() || '',
              href: link.href || ''
            });
            if (link.textContent && link.textContent.toLowerCase().includes('click to download')) {
              return link.href;
            }
          }
          // Log para debug - mostrar alguns links encontrados
          console.log('Links encontrados na página:', foundLinks.slice(0, 5));
          return null;
        });
        
        if (clickToDownloadLink) {
          console.log('✅ Link "Click to Download" encontrado via Puppeteer!');
          downloadUrl = clickToDownloadLink;
          break;
        }
        
        // Estratégia 2: Procurar diretamente por links S3 (mais rápido)
        const s3Link = await page.evaluate(() => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.href && link.href.includes('geek-export-stats.s3.amazonaws.com')) {
              return link.href;
            }
          }
          return null;
        });
        
        if (s3Link) {
          console.log('✅ Link S3 encontrado diretamente!');
          downloadUrl = s3Link;
          break;
        }
        
        console.log(`⏱️  Aguardando 3 segundos antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      if (!downloadUrl) {
        // Fallback final: tentar capturar o conteúdo da página para debug
        console.log('🚨 Nenhum link encontrado! Capturando página para análise...');
        
        const pageContent = await page.evaluate(() => {
          return {
            title: document.title,
            url: window.location.href,
            bodyText: document.body.innerText.substring(0, 500),
            linkCount: document.querySelectorAll('a').length
          };
        });
        
        console.log('📄 Informações da página:', JSON.stringify(pageContent, null, 2));
        
        throw new Error(`Link "Click to Download" não encontrado via Puppeteer após ${maxWaitTime/1000} segundos. Tentativas realizadas: ${attemptCount}`);
      }
      
    } catch (puppeteerError) {
      console.error('❌ Erro no Puppeteer:', puppeteerError.message);
      
      // Diagnosticar tipos específicos de erro
      if (puppeteerError.message.includes('Could not find Chrome')) {
        console.log(`\n🔧 DIAGNÓSTICO: Chrome não encontrado`);
        console.log(`   - Erro completo: ${puppeteerError.message}`);
        console.log(`   - Cache path: ${puppeteerError.message.match(/cache path is incorrectly configured[^)]+\)/)?.[0] || 'N/A'}`);
        console.log(`\n💡 SOLUÇÕES POSSÍVEIS:`);
        console.log(`   1. Execute: npm run install-chrome`);
        console.log(`   2. Execute: npx puppeteer browsers install chrome`);
        console.log(`   3. Configure PUPPETEER_EXECUTABLE_PATH=/path/to/chrome`);
        console.log(`   4. Aguarde o deploy do .ebextensions (install Chrome automaticamente)`);
        
        throw new Error(`Chrome não está instalado no servidor. Execute 'npm run install-chrome' ou configure a variável PUPPETEER_EXECUTABLE_PATH. Detalhes: ${puppeteerError.message}`);
        
      } else if (puppeteerError.message.includes('Navigation timeout')) {
        console.log(`\n🔧 DIAGNÓSTICO: Timeout de navegação`);
        console.log(`   - Possível problema de conectividade ou BGG fora do ar`);
        throw new Error(`Timeout ao navegar no BGG. Tente novamente em alguns minutos. Detalhes: ${puppeteerError.message}`);
        
      } else if (puppeteerError.message.includes('Target closed')) {
        console.log(`\n🔧 DIAGNÓSTICO: Browser fechado inesperadamente`);
        console.log(`   - Possível problema de memória ou recursos do servidor`);
        throw new Error(`Navegador fechado inesperadamente. Possível falta de recursos no servidor. Detalhes: ${puppeteerError.message}`);
        
      } else {
        console.log(`\n🔧 DIAGNÓSTICO: Erro genérico do Puppeteer`);
        console.log(`   - Tipo: ${puppeteerError.constructor.name}`);
        console.log(`   - Mensagem: ${puppeteerError.message}`);
        console.log(`   - Stack: ${puppeteerError.stack?.split('\n').slice(0, 3).join('\n')}`);
        
        throw new Error(`Erro no Puppeteer: ${puppeteerError.message}`);
      }
      
    } finally {
      if (browser) {
        try {
          await browser.close();
          console.log('🔒 Navegador Puppeteer fechado');
        } catch (closeError) {
          console.warn(`⚠️ Erro ao fechar navegador: ${closeError.message}`);
        }
      }
    }
    console.log(`📥 Link encontrado: ${downloadUrl}`);
    
    // Download do arquivo ZIP usando cliente autenticado
    console.log('📥 Fazendo download do arquivo ZIP...');
    const zipResponse = await client.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 300000, // 5 minutos
      maxContentLength: 100 * 1024 * 1024, // 100MB max
    });
    
    console.log(`📦 Arquivo baixado: ${(zipResponse.data.length / 1024 / 1024).toFixed(2)} MB`);
    
    // Descompactar ZIP
    console.log('📂 Descompactando arquivo ZIP...');
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(Buffer.from(zipResponse.data));
    const zipEntries = zip.getEntries();
    
    // Encontrar arquivo CSV
    const csvEntry = zipEntries.find(entry => 
      entry.entryName.toLowerCase().endsWith('.csv') && !entry.isDirectory
    );
    
    if (!csvEntry) {
      throw new Error('Arquivo CSV não encontrado no ZIP');
    }
    
    console.log(`📄 Arquivo CSV encontrado: ${csvEntry.entryName}`);
    
    // Conectar ao banco de dados
    console.log('🗄️ Conectando ao banco de dados...');
    const dbManager = new DatabaseManager();
    await dbManager.connect();
    
    try {
      // Limpar tabela antes da importação
      console.log('🧹 Limpando tabela bgg_games...');
      await dbManager.client.query('TRUNCATE TABLE bgg_games');
      
      // Processar CSV com streaming real (sem carregar tudo na memória)
      console.log('📊 Processando dados do CSV via streaming...');
      
      let processedCount = 0;
      let batchCount = 0;
      const batchSize = 50; // Reduzido drasticamente para evitar out of memory
      let batch = [];
      
      return new Promise((resolve, reject) => {
        // Usar streaming para não carregar todo o arquivo na memória
        const { PassThrough } = require('stream');
        const csvStream = new PassThrough();
        
        // Processar o arquivo em chunks para evitar out of memory
        const csvData = csvEntry.getData();
        const chunkSize = 512 * 1024; // 512KB por chunk (reduzido)
        let offset = 0;
        
        const writeNextChunk = () => {
          if (offset >= csvData.length) {
            csvStream.end();
            return;
          }
          
          const chunk = csvData.subarray(offset, offset + chunkSize);
          csvStream.write(chunk);
          offset += chunkSize;
          
          // Usar setImmediate para não bloquear o event loop
          setImmediate(writeNextChunk);
        };
        
        writeNextChunk();
        
        csvStream
          .pipe(csv())
          .on('data', async (row) => {
            try {
              // Monitorar memória durante processamento
              const currentMem = process.memoryUsage().heapUsed / 1024 / 1024;
              if (currentMem > 450) { // Se memória crítica
                console.log(`🚨 Memória crítica (${Math.round(currentMem)}MB), pausando...`);
                csvStream.pause();
                if (global.gc) global.gc();
                await new Promise(resolve => setTimeout(resolve, 200));
                csvStream.resume();
              }
              // Mapear campos do CSV para a tabela
              const gameData = {
                id: parseInt(row.id) || null,
                name: row.name || '',
                yearpublished: parseInt(row.yearpublished) || null,
                rank: parseInt(row.rank) || null,
                bayesaverage: parseFloat(row.bayesaverage) || null,
                average: parseFloat(row.average) || null,
                usersrated: parseInt(row.usersrated) || null,
                is_expansion: row.is_expansion === '1',
                abstracts_rank: parseInt(row.abstracts_rank) || null,
                cgs_rank: parseInt(row.cgs_rank) || null,
                childrensgames_rank: parseInt(row.childrensgames_rank) || null,
                familygames_rank: parseInt(row.familygames_rank) || null,
                partygames_rank: parseInt(row.partygames_rank) || null,
                strategygames_rank: parseInt(row.strategygames_rank) || null,
                thematic_rank: parseInt(row.thematic_rank) || null,
                wargames_rank: parseInt(row.wargames_rank) || null
              };
              
              // Validar dados essenciais
              if (!gameData.id || !gameData.name) {
                return; // Pular registro inválido
              }
              
              batch.push(gameData);
              processedCount++;
              
              // Processar batch quando atingir o tamanho limite
              if (batch.length >= batchSize) {
                csvStream.pause();
                await processBatch(batch, dbManager);
                batchCount++;
                // Monitorar uso de memória
                const memUsage = process.memoryUsage();
                const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
                console.log(`📈 Processados ${processedCount} registros (${Math.floor(processedCount/1000)}k) - Memória: ${usedMB}MB`);
                
                // Limpar batch e forçar garbage collection para liberar memória
                batch = [];
                if (global.gc) {
                  global.gc();
                }
                
                // Aguardar um pouco para liberar memória
                await new Promise(resolve => setTimeout(resolve, 10));
                
                // Se memória muito alta, aguardar mais tempo
                const memAfterGC = process.memoryUsage();
                const usedAfterGC = Math.round(memAfterGC.heapUsed / 1024 / 1024);
                if (usedAfterGC > 400) { // Se usar mais de 400MB
                  console.log(`⚠️  Memória alta (${usedAfterGC}MB), pausando por 100ms...`);
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                csvStream.resume();
              }
              
            } catch (rowError) {
              console.warn(`⚠️ Erro ao processar linha: ${rowError.message}`);
            }
          })
          .on('end', async () => {
            try {
              // Processar último batch se houver dados
              if (batch.length > 0) {
                await processBatch(batch, dbManager);
                batchCount++;
              }
              
              // Monitorar uso final de memória
              const finalMemUsage = process.memoryUsage();
              const finalUsedMB = Math.round(finalMemUsage.heapUsed / 1024 / 1024);
              
              console.log(`✅ Importação concluída: ${processedCount} jogos importados`);
              console.log(`📊 Estatísticas: ${batchCount} batches processados, memória final: ${finalUsedMB}MB`);
              
              res.json({
                success: true,
                message: `Importação concluída com sucesso`,
                gamesImported: processedCount,
                batches: batchCount,
                memoryUsedMB: finalUsedMB
              });
              
              resolve();
            } catch (endError) {
              reject(endError);
            }
          })
          .on('error', reject);
      });
      
    } finally {
      await dbManager.disconnect();
    }
    
  } catch (error) {
    console.error('❌ Erro na importação:', error);
    res.status(500).json({
      error: 'Erro na importação dos dados do BGG: ' + error.message
    });
  }
});

// Função auxiliar para processar batch de dados
async function processBatch(batch, dbManager) {
  if (batch.length === 0) return;
  
  // Construir query de inserção em lote
  const values = [];
  const placeholders = [];
  
  batch.forEach((game, index) => {
    const baseIndex = index * 16;
    placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, $${baseIndex + 16})`);
    
    values.push(
      game.id,
      game.name,
      game.yearpublished,
      game.rank,
      game.bayesaverage,
      game.average,
      game.usersrated,
      game.is_expansion,
      game.abstracts_rank,
      game.cgs_rank,
      game.childrensgames_rank,
      game.familygames_rank,
      game.partygames_rank,
      game.strategygames_rank,
      game.thematic_rank,
      game.wargames_rank
    );
  });
  
  const query = `
    INSERT INTO bgg_games (
      id, name, yearpublished, rank, bayesaverage, average, usersrated, is_expansion,
      abstracts_rank, cgs_rank, childrensgames_rank, familygames_rank, 
      partygames_rank, strategygames_rank, thematic_rank, wargames_rank
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      yearpublished = EXCLUDED.yearpublished,
      rank = EXCLUDED.rank,
      bayesaverage = EXCLUDED.bayesaverage,
      average = EXCLUDED.average,
      usersrated = EXCLUDED.usersrated,
      is_expansion = EXCLUDED.is_expansion,
      abstracts_rank = EXCLUDED.abstracts_rank,
      cgs_rank = EXCLUDED.cgs_rank,
      childrensgames_rank = EXCLUDED.childrensgames_rank,
      familygames_rank = EXCLUDED.familygames_rank,
      partygames_rank = EXCLUDED.partygames_rank,
      strategygames_rank = EXCLUDED.strategygames_rank,
      thematic_rank = EXCLUDED.thematic_rank,
      wargames_rank = EXCLUDED.wargames_rank,
      updated_at = CURRENT_TIMESTAMP
  `;
  
  await dbManager.client.query(query, values);
}

// Limpeza de sessões expiradas (executa a cada hora)
setInterval(async () => {
  try {
    const userManager = new UserManager();
    await userManager.connect();
    const cleanedCount = await userManager.cleanupExpiredSessions();
    await userManager.disconnect();
    
    if (cleanedCount > 0) {
      console.log(`🧹 Limpeza automática: ${cleanedCount} sessões expiradas removidas`);
    }
  } catch (error) {
    console.error('❌ Erro na limpeza de sessões:', error);
  }
}, 60 * 60 * 1000); // 1 hora

// Iniciar servidor
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
  console.log(`🔐 Sistema JWT ativado com expiração de ${JWT_EXPIRES_IN}`);
  console.log(`🧹 Limpeza automática de sessões a cada hora`);
});
