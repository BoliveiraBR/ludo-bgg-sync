require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const BGGApi = require('../../api/bggApi');
const LudopediaApi = require('../../api/ludopediaApi');
const CollectionMatcher = require('../../comparison/matcher');
const ChatGPTMatcher = require('../../comparison/chatGptMatch');
const CollectionLoader = require('../../collection/loader');
const fs = require('fs').promises;

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// Rota para carregar coleções (API ou arquivo)
app.post('/api/collections', async (req, res) => {
  try {
    const { loadType } = req.body;
    let bggCollection, ludoCollection;

    if (loadType === 'api') {
      // Carregar credenciais do arquivo
      const credentialsPath = path.join(__dirname, '../../../data/credentials.txt');
      const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));

      if (!credentials.BGG_USER || !credentials.LUDO_ACCESS_TOKEN) {
        throw new Error('Credenciais não configuradas. Clique no ícone de configurações para configurar.');
      }

      // Carregar via API
      const bggApi = new BGGApi(credentials.BGG_USER);
      const ludoApi = new LudopediaApi(credentials.LUDO_ACCESS_TOKEN);

      [bggCollection, ludoCollection] = await Promise.all([
        bggApi.fetchCollection(),
        ludoApi.fetchCollection()
      ]);
    } else {
      // Carregar do arquivo
      bggCollection = CollectionLoader.loadFromFile('BGGCollection.txt');
      ludoCollection = CollectionLoader.loadFromFile('LudopediaCollection.txt');
    }
    
    // Garante que os campos de tipo estejam consistentes
    bggCollection = bggCollection.map(game => ({
      ...game,
      isExpansion: game.type === 'expansion' || game.subtype === 'expansion'
    }));
    
    ludoCollection = ludoCollection.map(game => ({
      ...game,
      isExpansion: game.type === 'expansion'
    }));

    res.json({
      bggCollection,
      ludoCollection
    });

  } catch (error) {
    console.error('Error loading collections:', error);
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
    await fs.writeFile(credentialsPath, JSON.stringify(credentials, null, 2));

    // Fecha a janela e notifica a janela principal
    res.send(`
      <script>
        window.opener.postMessage({ type: 'AUTH_SUCCESS', token: '${tokenResponse.data.access_token}' }, '*');
        window.close();
      </script>
    `);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    let errorMessage = 'Erro na autenticação';
    if (error.response?.data?.error_description) {
      errorMessage += `: ${error.response.data.error_description}`;
    }
    res.status(500).send(`
      <html>
        <body>
          <h2>Erro na Autenticação</h2>
          <p>${errorMessage}</p>
          <p>Por favor, feche esta janela e tente novamente.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 5000);
          </script>
        </body>
      </html>
    `);
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
