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

// Aumentar limite do body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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
      // Carregar credenciais do arquivo
      const credentialsPath = path.join(__dirname, '../../../data/credentials.txt');
      const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));

      if (!credentials.BGG_USER || !credentials.LUDO_USER) {
        throw new Error('Credenciais de usuário não encontradas');
      }

      // Carregar do arquivo usando os nomes específicos dos usuários
      const bggFilename = `BGGCollection-${credentials.BGG_USER}.txt`;
      const ludoFilename = `LudopediaCollection-${credentials.LUDO_USER}.txt`;

      // Carregar do arquivo
      bggCollection = CollectionLoader.loadFromFile(bggFilename);
      ludoCollection = CollectionLoader.loadFromFile(ludoFilename);
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

    // Fecha a janela e notifica a janela principal
    res.send(`
      <script>
        window.opener.postMessage({ 
          type: 'AUTH_SUCCESS', 
          token: '${tokenResponse.data.access_token}',
          user: '${credentials.LUDO_USER || ''}'
        }, '*');
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

// Rota para salvar coleções
app.post('/api/save-collections', async (req, res) => {
  try {
    // Carregar credenciais do arquivo
    const credentialsPath = path.join(__dirname, '../../../data/credentials.txt');
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));

    if (!credentials.BGG_USER || !credentials.LUDO_USER) {
      throw new Error('Credenciais de usuário não encontradas');
    }

    const { bggCollection, ludoCollection } = req.body;

    // Define os nomes dos arquivos com os usernames
    const bggFilename = `BGGCollection-${credentials.BGG_USER}.txt`;
    const ludoFilename = `LudopediaCollection-${credentials.LUDO_USER}.txt`;

    // Salva as coleções
    CollectionLoader.saveToFile(bggCollection, bggFilename);
    CollectionLoader.saveToFile(ludoCollection, ludoFilename);

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving collections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para encontrar matches entre coleções
app.post('/api/match-collections', async (req, res) => {
  try {
    let { bggCollection, ludoCollection } = req.body;
    const matchesPath = path.join(__dirname, '../../../data/matches.txt');

    // Criar cópias das coleções para não interferir nas originais
    bggCollection = [...bggCollection];
    ludoCollection = [...ludoCollection];
    
    // Carregar matches prévios
    let previousMatches = [];
    try {
      const content = await fs.readFile(matchesPath, 'utf8');
      previousMatches = JSON.parse(content);
    } catch (error) {
      console.log('Nenhum match prévio encontrado');
    }

   // Remover jogos já pareados das listas
const previousMatchCount = previousMatches.length;

// Primeiro, criar um mapa de pares BGG-Ludo dos matches anteriores
const matchPairs = new Map();
previousMatches.forEach(match => {
    matchPairs.set(match.bggId, match.ludoId);
    matchPairs.set(match.ludoId, match.bggId);
});

// Remover apenas jogos que formam pares completos
bggCollection = bggCollection.filter(bggGame => {
    const matchedLudoId = matchPairs.get(bggGame.id);
    // Manter o jogo se não tiver match ou se o par dele não existir na coleção atual
    if (!matchedLudoId) return true;
    return !ludoCollection.some(ludoGame => ludoGame.id === matchedLudoId);
});

ludoCollection = ludoCollection.filter(ludoGame => {
    const matchedBggId = matchPairs.get(ludoGame.id);
    // Manter o jogo se não tiver match ou se o par dele não existir na coleção atual
    if (!matchedBggId) return true;
    return !bggCollection.some(bggGame => bggGame.id === matchedBggId);
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
    
    // Garantir que os arrays onlyIn também contenham objetos válidos e não estejam em matches.txt
    // com um par presente na coleção atual
    const onlyInBGG = comparison.onlyInBGG
      .map(name => bggGameMap.get(name))
      .filter(game => {
        if (!game || !game.name) return false;
        // Se o jogo tem um match em matches.txt, removê-lo da lista "Somente BGG"
        const matchedLudoId = matchPairs.get(game.id);
        if (matchedLudoId) {
          return false; // Remover todos os jogos que já foram pareados anteriormente
        }
        return true; // Manter apenas jogos que nunca foram pareados
      })
      .map(game => ({
        id: game.id,
        name: game.name,
        type: game.type,
        isExpansion: game.isExpansion
      }));

    const onlyInLudo = comparison.onlyInLudo
      .map(name => ludoGameMap.get(name))
      .filter(game => {
        if (!game || !game.name) return false;
        
        // Se o jogo tem um match em matches.txt, removê-lo da lista "Somente Ludopedia"
        const matchedBggId = matchPairs.get(game.id);
        if (matchedBggId) {
          return false; // Remover todos os jogos que já foram pareados anteriormente
        }
        return true; // Manter apenas jogos que nunca foram pareados
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

    // Usar o matcher para comparar as coleções
    const comparison = CollectionMatcher.compareCollections(bggCollection, ludoCollection);
    
    // Verificar OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({
        error: "Chave da API OpenAI não configurada. Configure a chave em .env"
      });
    }

    // Verificar se temos jogos para comparar
    if (comparison.onlyInBGG.length === 0 || comparison.onlyInLudo.length === 0) {
      return res.json({ 
        matches: [],
        message: "Não há jogos não pareados para comparar com AI"
      });
    }

    // Logging dos números
    console.log('💫 Iniciando comparação com AI:');
    console.log(`   BGG: ${comparison.onlyInBGG.length} jogos não pareados`);
    console.log(`   Ludopedia: ${comparison.onlyInLudo.length} jogos não pareados`);

    // Buscar matches adicionais usando AI
    let aiMatches;
    try {
      aiMatches = await chatGptMatcher.findMatches(
        comparison.onlyInBGG,
        comparison.onlyInLudo
      );
    } catch (aiError) {
      console.error('❌ Erro na análise da AI:', aiError);
      return res.status(500).json({
        error: 'Erro na análise da AI: ' + (aiError.message || 'Erro desconhecido na comunicação com ChatGPT')
      });
    }
    
    // Transformar matches em objetos com os jogos completos
    const matches = aiMatches
      .map(match => {
        // Aceitar qualquer formato que a AI retorne
        let ludoName, bggName;
        
        if (Array.isArray(match) && match.length >= 2) {
          [ludoName, bggName] = match;
        } else if (typeof match === 'object' && match.ludoName && match.bggName) {
          ludoName = match.ludoName;
          bggName = match.bggName;
        } else if (typeof match === 'object' && match.ludo && match.bgg) {
          ludoName = match.ludo;
          bggName = match.bgg;
        } else {
          // Tentar extrair nomes de qualquer formato de objeto
          const keys = Object.keys(match);
          if (keys.length >= 2) {
            ludoName = match[keys[0]];
            bggName = match[keys[1]];
          } else {
            // Match da AI em formato não reconhecido, mas será aceito
            return match; // Retornar como está
          }
        }
        
        // Buscar jogos nas coleções de forma flexível
        const bggGame = bggCollection.find(g => 
          g.name === bggName || 
          g.name.toLowerCase().includes(bggName.toLowerCase()) ||
          bggName.toLowerCase().includes(g.name.toLowerCase())
        );
        
        const ludoGame = ludoCollection.find(g => 
          g.name === ludoName || 
          g.name.toLowerCase().includes(ludoName.toLowerCase()) ||
          ludoName.toLowerCase().includes(g.name.toLowerCase())
        );
        
        // Sempre retornar um match, mesmo se não encontrar os jogos exatos
        return {
          bggGame: bggGame ? {
            id: bggGame.id,
            name: bggGame.name,
            type: bggGame.type || 'unknown',
            isExpansion: bggGame.isExpansion || false
          } : {
            id: 'ai-match-bgg',
            name: bggName,
            type: 'ai-suggested',
            isExpansion: false
          },
          ludoGame: ludoGame ? {
            id: ludoGame.id,
            name: ludoGame.name,
            type: ludoGame.type || 'unknown',
            isExpansion: ludoGame.isExpansion || false
          } : {
            id: 'ai-match-ludo',
            name: ludoName,
            type: 'ai-suggested',
            isExpansion: false
          },
          exactMatch: false,
          confidence: 1.0, // Aceitar todos os matches da AI com confiança máxima
          reasoning: `Match sugerido pela AI: "${ludoName}" ↔ "${bggName}"`
        };
      });

    res.json({ matches });
  } catch (error) {
    console.error('Error matching collections with AI:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para salvar matches da AI
app.post('/api/save-matches-ai', async (req, res) => {
  try {
    const { matches } = req.body;
    const matchesPath = path.join(__dirname, '../../../data/matches.txt');

    // Ler matches existentes ou criar array vazio
    let existingMatches = [];
    try {
      const content = await fs.readFile(matchesPath, 'utf8');
      existingMatches = JSON.parse(content);
    } catch (error) {
      console.log('Arquivo de matches não encontrado, será criado um novo');
    }

    // Adicionar novos matches
    existingMatches.push(...matches);

    // Salvar arquivo atualizado
    await fs.writeFile(matchesPath, JSON.stringify(existingMatches, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving AI matches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
