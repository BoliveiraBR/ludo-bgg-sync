require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const { Client } = require('pg');
const BGGApi = require('../../api/bggApi');
const LudopediaApi = require('../../api/ludopediaApi');
const CollectionMatcher = require('../../comparison/matcher');
const ChatGPTMatcher = require('../../comparison/chatGptMatch');
const DatabaseManager = require('../../database/dbManager');
const MatchManager = require('../../database/matchManager');
const fs = require('fs').promises;

const app = express();

// Aumentar limite do body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Servir arquivos estáticos com headers específicos
app.use(express.static(path.join(__dirname, 'public'), {
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

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// API para sincronização
app.post('/api/sync', async (req, res) => {
  try {
    // Carregar credenciais do arquivo
    const credentialsPath = path.join(__dirname, '../../../data/credentials.txt');
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));

    if (!credentials.BGG_USER || !credentials.LUDO_ACCESS_TOKEN) {
      throw new Error('Credenciais não configuradas. Clique no ícone de configurações para configurar.');
    }

    const bggApi = new BGGApi(credentials.BGG_USER);
    const ludoApi = new LudopediaApi(credentials.LUDO_ACCESS_TOKEN);

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

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para carregar coleções automaticamente do banco (sem parâmetros)
app.get('/api/collections', async (req, res) => {
  try {
    // Carregar credenciais do arquivo
    const credentialsPath = path.join(__dirname, '../../../data/credentials.txt');
    let credentials;
    
    try {
      credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    } catch (credError) {
      return res.json({
        bggCollection: [],
        ludoCollection: [],
        source: 'none',
        message: 'Nenhuma configuração encontrada. Configure suas credenciais primeiro.'
      });
    }

    if (!credentials.BGG_USER) {
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
        dbManager.getBGGCollection(credentials.BGG_USER),
        dbManager.getLudopediaCollection(credentials.LUDO_USER || credentials.BGG_USER)
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
app.post('/api/collections', async (req, res) => {
  try {
    const { loadType } = req.body;
    let bggCollection, ludoCollection;

    // Carregar credenciais do arquivo
    const credentialsPath = path.join(__dirname, '../../../data/credentials.txt');
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));

    if (!credentials.BGG_USER) {
      throw new Error('Usuário BGG não configurado. Clique no ícone de configurações para configurar.');
    }

    if (loadType === 'api') {
      if (!credentials.LUDO_ACCESS_TOKEN) {
        throw new Error('Token Ludopedia não configurado. Clique no ícone de configurações para configurar.');
      }

      // Carregar via API
      console.log('📡 Carregando coleções via API...');
      const bggApi = new BGGApi(credentials.BGG_USER);
      const ludoApi = new LudopediaApi(credentials.LUDO_ACCESS_TOKEN);

      [bggCollection, ludoCollection] = await Promise.all([
        bggApi.fetchCollection(),
        ludoApi.fetchCollection()
      ]);
      
      console.log(`📊 Carregado via API: BGG=${bggCollection.length}, Ludopedia=${ludoCollection.length}`);
    } else {
      // Carregar do banco de dados
      console.log('💾 Carregando coleções do banco de dados...');
      const dbManager = new DatabaseManager();

      try {
        [bggCollection, ludoCollection] = await Promise.all([
          dbManager.getBGGCollection(credentials.BGG_USER),
          dbManager.getLudopediaCollection(credentials.LUDO_USER || credentials.BGG_USER)
        ]);
        
        console.log(`📊 Carregado do banco: BGG=${bggCollection.length}, Ludopedia=${ludoCollection.length}`);
        
        // Se não há dados no banco, tentar carregar via API automaticamente
        if (bggCollection.length === 0 && ludoCollection.length === 0) {
          console.log('📭 Banco vazio, tentando carregar via API...');
          
          if (!credentials.LUDO_ACCESS_TOKEN) {
            throw new Error('Nenhuma coleção encontrada no banco de dados e token Ludopedia não configurado para carregar via API.');
          }

          const bggApi = new BGGApi(credentials.BGG_USER);
          const ludoApi = new LudopediaApi(credentials.LUDO_ACCESS_TOKEN);

          [bggCollection, ludoCollection] = await Promise.all([
            bggApi.fetchCollection(),
            ludoApi.fetchCollection()
          ]);
          
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

  } catch (error) {
    console.error('❌ Error loading collections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para obter configurações
app.get('/api/config', async (req, res) => {
  try {
    const credentialsPath = path.join(__dirname, '../../../data/credentials.txt');
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    res.json(credentials);
  } catch (error) {
    console.error('Error reading credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para iniciar autenticação Ludopedia
app.get('/api/auth/ludopedia', (req, res) => {
  try {
    const clientId = process.env.LUDO_CLIENT_ID;
    const redirectUri = process.env.LUDO_REDIRECT_URI;
    const authUrl = `https://ludopedia.com.br/oauth?client_id=${clientId}&redirect_uri=${redirectUri}`;
    
    res.json({ authUrl });
  } catch (error) {
    console.error('Error starting auth:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para salvar configurações
app.post('/api/config', async (req, res) => {
  try {
    const credentialsPath = path.join(__dirname, '../../../data/credentials.txt');
    
    // Lê as credenciais existentes
    let credentials = {};
    try {
      credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    } catch (error) {
      console.warn('No existing credentials found');
    }

    // Atualiza as credenciais com os valores fornecidos
    Object.assign(credentials, req.body);

    // Salva as credenciais atualizadas
    await fs.writeFile(credentialsPath, JSON.stringify(credentials, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota de callback do OAuth
app.get('/callback', async (req, res) => {
  try {
    const { code, error: oauthError } = req.query;
    
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

    // Salva o token nas credenciais
    const credentialsPath = path.join(__dirname, '../../../data/credentials.txt');
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    credentials.LUDO_ACCESS_TOKEN = tokenResponse.data.access_token;

    // Buscar o usuário da Ludopedia
    try {
      const userResponse = await axios.get('https://ludopedia.com.br/api/v1/me', {
        headers: {
          Authorization: `Bearer ${tokenResponse.data.access_token}`
        }
      });
      credentials.LUDO_USER = userResponse.data.usuario;
    } catch (error) {
      console.error('Erro ao buscar usuário da Ludopedia:', error);
    }

    await fs.writeFile(credentialsPath, JSON.stringify(credentials, null, 2));

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
          <div class="success-icon">✅</div>
          <h2 class="text-success mb-3">Autenticação Realizada com Sucesso!</h2>
          <p class="mb-2">Sua conta da Ludopedia foi conectada com sucesso.</p>
          ${credentials.LUDO_USER ? `<p class="text-muted">Usuário: <strong>${credentials.LUDO_USER}</strong></p>` : ''}
          <hr>
          <p class="mb-3">Você pode voltar para a aplicação principal.</p>
          <button class="btn btn-primary" onclick="closeWindow()">
            <i class="me-2">🔙</i>Voltar para BG Guru
          </button>
          <div class="countdown">
            Esta janela fechará automaticamente em <span id="countdown">10</span> segundos.
          </div>
        </div>

        <script>
          let seconds = 10;
          const countdownEl = document.getElementById('countdown');
          
          const timer = setInterval(() => {
            seconds--;
            countdownEl.textContent = seconds;
            if (seconds <= 0) {
              clearInterval(timer);
              closeWindow();
            }
          }, 1000);

          function closeWindow() {
            // Notifica a janela principal sobre o sucesso
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'AUTH_SUCCESS', 
                token: '${tokenResponse.data.access_token}',
                user: '${credentials.LUDO_USER || ''}'
              }, '*');
            }
            
            // Tenta fechar a janela
            window.close();
            
            // Se não conseguir fechar (alguns navegadores bloqueiam), mostra mensagem
            setTimeout(() => {
              if (!window.closed) {
                document.body.innerHTML = \`
                  <div class="success-card">
                    <h3>✅ Autenticação Concluída</h3>
                    <p>Por favor, feche esta aba manualmente e retorne à aplicação.</p>
                  </div>
                \`;
              }
            }, 1000);
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
            Esta janela fechará automaticamente em <span id="countdown">10</span> segundos.
          </div>
        </div>

        <script>
          let seconds = 10;
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

// Rota para salvar coleções no banco de dados
app.post('/api/save-collections', async (req, res) => {
  try {
    // Carregar credenciais do arquivo
    const credentialsPath = path.join(__dirname, '../../../data/credentials.txt');
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));

    if (!credentials.BGG_USER || !credentials.LUDO_USER) {
      throw new Error('Credenciais de usuário não encontradas');
    }

    const { bggCollection, ludoCollection } = req.body;

    console.log(`💾 Salvando coleções no banco de dados...`);
    console.log(`📊 BGG: ${bggCollection?.length || 0} jogos para ${credentials.BGG_USER}`);
    console.log(`📊 Ludopedia: ${ludoCollection?.length || 0} jogos para ${credentials.LUDO_USER}`);

    const dbManager = new DatabaseManager();

    // Salvar coleções no banco de dados
    const results = {};

    if (bggCollection && bggCollection.length > 0) {
      results.bggSaved = await dbManager.saveBGGCollection(credentials.BGG_USER, bggCollection);
    }

    if (ludoCollection && ludoCollection.length > 0) {
      results.ludoSaved = await dbManager.saveLudopediaCollection(credentials.LUDO_USER, ludoCollection);
    }


    console.log('✅ Coleções salvas no banco com sucesso!');
    res.json({ 
      success: true,
      message: 'Coleções salvas no banco de dados com sucesso!',
      results
    });
  } catch (error) {
    console.error('❌ Erro ao salvar coleções:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para encontrar matches entre coleções
app.post('/api/match-collections', async (req, res) => {
  try {
    let { bggCollection, ludoCollection } = req.body;

    // Criar cópias das coleções para não interferir nas originais
    bggCollection = [...bggCollection];
    ludoCollection = [...ludoCollection];
    
    // Carregar credenciais para obter usernames
    const credentials = JSON.parse(await fs.readFile('./data/credentials.txt', 'utf8'));
    const bggUser = credentials.BGG_USER;
    const ludoUser = credentials.LUDO_USER || bggUser;
    
    // Carregar matches prévios do banco
    const matchManager = new MatchManager();
    await matchManager.connect();
    const previousMatches = await matchManager.getMatches(bggUser, ludoUser);
    await matchManager.disconnect();

    // Remover jogos já pareados das listas
    const previousMatchCount = previousMatches.length;

    // Criar um mapa de pares BGG-Ludo dos matches anteriores
    const matchPairs = new Map();
    previousMatches.forEach(match => {
        const bggKey = `${match.bggId}_${match.bggVersionId}`;
        matchPairs.set(bggKey, match.ludoId);
        matchPairs.set(match.ludoId, bggKey);
    });

    // Guardar as coleções originais para verificação cruzada
    const originalBggCollection = [...bggCollection];
    const originalLudoCollection = [...ludoCollection];

    // Remover jogos já pareados das listas
    bggCollection = bggCollection.filter(bggGame => {
        const bggKey = `${bggGame.id}_${bggGame.versionId || '0'}`;
        const matchedLudoId = matchPairs.get(bggKey);
        if (!matchedLudoId) return true;
        return !originalLudoCollection.some(ludoGame => ludoGame.id === matchedLudoId);
    });

    ludoCollection = ludoCollection.filter(ludoGame => {
        const matchedBggKey = matchPairs.get(ludoGame.id);
        if (!matchedBggKey) return true;
        const [matchedBggId, matchedVersionId] = matchedBggKey.split('_');
        return !originalBggCollection.some(bggGame => 
            bggGame.id === matchedBggId && (bggGame.versionId || '0') === matchedVersionId
        );
    });

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
    
    // Garantir que os arrays onlyIn também contenham objetos válidos e não estejam pareados no banco
    // com um par presente na coleção atual
    const onlyInBGG = comparison.onlyInBGG
      .map(name => bggGameMap.get(name))
      .filter(game => {
        if (!game || !game.name) return false;
        const bggKey = `${game.id}_${game.versionId || '0'}`;
        const matchedLudoId = matchPairs.get(bggKey);
        if (matchedLudoId) {
          return !originalLudoCollection.some(ludoGame => ludoGame.id === matchedLudoId);
        }
        return true;
      })
      .map(game => ({
        id: game.id,
        versionId: game.versionId || '0',
        name: game.name,
        type: game.type,
        isExpansion: game.isExpansion
      }));

    const onlyInLudo = comparison.onlyInLudo
      .map(name => ludoGameMap.get(name))
      .filter(game => {
        if (!game || !game.name) return false;
        const matchedBggKey = matchPairs.get(game.id);
        if (matchedBggKey) {
          const [matchedBggId, matchedVersionId] = matchedBggKey.split('_');
          return !originalBggCollection.some(bggGame => 
            bggGame.id === matchedBggId && (bggGame.versionId || '0') === matchedVersionId
          );
        }
        return true;
      })
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
  } catch (error) {
    console.error('Error matching collections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para encontrar matches com AI entre coleções
app.post('/api/match-collections-ai', async (req, res) => {
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

    // Carregar credenciais para obter usernames
    const credentials = JSON.parse(await fs.readFile('./data/credentials.txt', 'utf8'));
    const bggUser = credentials.BGG_USER;
    const ludoUser = credentials.LUDO_USER || bggUser;

    // Carregar matches prévios do banco
    const matchManager = new MatchManager();
    await matchManager.connect();
    const previousMatches = await matchManager.getMatches(bggUser, ludoUser);
    await matchManager.disconnect();

    // Remover jogos já pareados das listas (mesma lógica do endpoint regular)
    const matchPairs = new Map();
    previousMatches.forEach(match => {
        const bggKey = `${match.bggId}_${match.bggVersionId}`;
        matchPairs.set(bggKey, match.ludoId);
        matchPairs.set(match.ludoId, bggKey);
    });

    // Guardar as coleções originais para verificação cruzada
    const originalBggCollection = [...bggCollection];
    const originalLudoCollection = [...ludoCollection];

    // Remover apenas jogos que formam pares completos
    bggCollection = bggCollection.filter(bggGame => {
        const bggKey = `${bggGame.id}_${bggGame.versionId || '0'}`;
        const matchedLudoId = matchPairs.get(bggKey);
        if (!matchedLudoId) return true;
        return !originalLudoCollection.some(ludoGame => ludoGame.id === matchedLudoId);
    });

    ludoCollection = ludoCollection.filter(ludoGame => {
        const matchedBggKey = matchPairs.get(ludoGame.id);
        if (!matchedBggKey) return true;
        const [matchedBggId, matchedVersionId] = matchedBggKey.split('_');
        return !originalBggCollection.some(bggGame => 
            bggGame.id === matchedBggId && (bggGame.versionId || '0') === matchedVersionId
        );
    });

    // Usar o matcher para comparar as coleções filtradas
    const comparison = CollectionMatcher.compareCollections(bggCollection, ludoCollection);
    
    // Verificar se temos jogos para comparar
    if (comparison.onlyInBGG.length === 0 || comparison.onlyInLudo.length === 0) {
      return res.json({ 
        matches: [],
        message: "Não há jogos não pareados para comparar com AI"
      });
    }

    // Buscar matches adicionais usando AI
    let aiMatches;
    try {
      // Converter as listas para formato {id, name} 
      const bggGamesForAI = comparison.onlyInBGG.map(name => {
        const game = bggCollection.find(g => g.name.trim().toLowerCase() === name);
        return { id: game.id, name: game.name };
      });
      
      const ludoGamesForAI = comparison.onlyInLudo.map(name => {
        const game = ludoCollection.find(g => g.name.trim().toLowerCase() === name);
        return { id: game.id, name: game.name };
      });

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
  } catch (error) {
    console.error('Error matching collections with AI:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para salvar matches regulares aceitos
app.post('/api/accept-matches', async (req, res) => {
  try {
    const { matches } = req.body;
    
    // Carregar credenciais para obter usernames
    const credentials = JSON.parse(await fs.readFile('./data/credentials.txt', 'utf8'));
    const bggUser = credentials.BGG_USER;
    const ludoUser = credentials.LUDO_USER || bggUser;

    // Converter matches para formato do banco
    const dbMatches = matches.map(match => ({
      bggUser,
      bggId: match.bggGame.id,
      bggVersionId: match.bggGame.versionId || '0',
      ludoUser,
      ludoId: match.ludoGame.id,
      matchType: 'name'
    }));

    // Salvar no banco de dados
    const matchManager = new MatchManager();
    await matchManager.connect();
    const savedCount = await matchManager.saveMatches(dbMatches);
    await matchManager.disconnect();

    console.log(`✅ Salvos ${savedCount} matches automáticos por nome`);
    res.json({ success: true, savedCount });
  } catch (error) {
    console.error('Error saving matches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para salvar matches da AI
app.post('/api/save-matches-ai', async (req, res) => {
  try {
    const { matches } = req.body;
    
    // Carregar credenciais para obter usernames
    const credentials = JSON.parse(await fs.readFile('./data/credentials.txt', 'utf8'));
    const bggUser = credentials.BGG_USER;
    const ludoUser = credentials.LUDO_USER || bggUser;

    // Converter matches para formato do banco
    const dbMatches = matches.map(match => ({
      bggUser,
      bggId: match.bgg.id,
      bggVersionId: match.bgg.versionId || '0',
      ludoUser,
      ludoId: match.ludo.id,
      matchType: 'ai'
    }));

    // Salvar no banco de dados
    const matchManager = new MatchManager();
    await matchManager.connect();
    const savedCount = await matchManager.saveMatches(dbMatches);
    await matchManager.disconnect();

    console.log(`✅ Salvos ${savedCount} matches sugeridos por AI`);
    res.json({ success: true, savedCount });
  } catch (error) {
    console.error('Error saving AI matches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para salvar match manual
app.post('/api/save-manual-match', async (req, res) => {
  try {
    const { match } = req.body;

    // Validar dados do match
    if (!match || !match.bggId || !match.ludoId) {
      return res.status(400).json({ error: 'Dados do match inválidos' });
    }

    // Carregar credenciais para obter usernames
    const credentials = JSON.parse(await fs.readFile('./data/credentials.txt', 'utf8'));
    const bggUser = credentials.BGG_USER;
    const ludoUser = credentials.LUDO_USER || bggUser;

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
    const savedCount = await matchManager.saveMatches(dbMatches);
    await matchManager.disconnect();

    if (savedCount > 0) {
      console.log(`✅ Match manual salvo: ${match.bggName || match.bggId} ↔ ${match.ludoName || match.ludoId}`);
      res.json({ success: true });
    } else {
      res.status(409).json({ error: 'Match já existe ou erro ao salvar' });
    }
  } catch (error) {
    console.error('Error saving manual match:', error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
