const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

/**
 * Extrai JSON válido de uma resposta que pode conter texto adicional
 * @param {string} content - Conteúdo da resposta que pode conter JSON + texto extra
 * @returns {string} - JSON válido extraído ou string vazia se não encontrado
 */
function extractValidJSON(content) {
  try {
    // Primeiro, tenta fazer parse direto (caso a resposta seja JSON puro)
    JSON.parse(content);
    return content;
  } catch (error) {
    // Se falhou, procura por JSON dentro do texto
    console.log("🔍 Resposta contém texto adicional, extraindo JSON...");
    
    // Remove quebras de linha e espaços desnecessários para facilitar a busca
    const cleanContent = content.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
    
    // Patterns para encontrar JSON na resposta
    const jsonPatterns = [
      // JSON dentro de código markdown com ```
      /```(?:json)?\s*(\[[\s\S]*?\])\s*```/gi,
      /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi,
      // JSON que começa com [ e termina com ] (arrays) - mais específico
      /(\[\s*\[\s*"[^"]*"\s*,\s*"[^"]*"\s*\][\s\S]*?\])/g,
      // JSON simples com arrays
      /(\[[\s\S]*?\])/g,
      // JSON que começa com { e termina com }
      /(\{[\s\S]*?\})/g,
    ];
    
    for (const pattern of jsonPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const candidateJson = match[1] || match[0];
        try {
          // Verifica se é JSON válido
          JSON.parse(candidateJson);
          console.log("✅ JSON extraído com sucesso");
          return candidateJson;
        } catch (parseError) {
          continue;
        }
      }
    }
    
    // Tentativa manual mais robusta - procura especificamente por arrays de arrays
    const arrayStartIndex = content.indexOf('[[');
    if (arrayStartIndex !== -1) {
      // Encontra o bracket de fechamento correspondente
      let bracketCount = 0;
      let arrayEndIndex = -1;
      
      for (let i = arrayStartIndex; i < content.length; i++) {
        if (content[i] === '[') bracketCount++;
        if (content[i] === ']') {
          bracketCount--;
          if (bracketCount === 0) {
            arrayEndIndex = i;
            break;
          }
        }
      }
      
      if (arrayEndIndex !== -1) {
        const candidateJson = content.substring(arrayStartIndex, arrayEndIndex + 1);
        try {
          JSON.parse(candidateJson);
          console.log("✅ JSON extraído manualmente (arrays)");
          return candidateJson;
        } catch (parseError) {
          // Continue para próxima tentativa
        }
      }
    }
    
    // Se não encontrou JSON válido com patterns, tenta extrair o primeiro array encontrado
    const openBracket = content.indexOf('[');
    const closeBracket = content.lastIndexOf(']');
    
    if (openBracket !== -1 && closeBracket !== -1 && closeBracket > openBracket) {
      const candidateJson = content.substring(openBracket, closeBracket + 1);
      try {
        JSON.parse(candidateJson);
        console.log("✅ JSON extraído manualmente");
        return candidateJson;
      } catch (parseError) {
        console.warn("⚠️ Não foi possível extrair JSON válido da resposta");
      }
    }
    
    // Tentativa de recuperar JSON truncado - procura por arrays válidos até o truncamento
    const arrayMatch = content.match(/\[\s*(\[[\s\S]*)/);
    if (arrayMatch) {
      const partialArray = arrayMatch[0];
      // Tenta encontrar arrays completos dentro do JSON truncado
      const completeMatches = partialArray.match(/\[.*?\]/g);
      if (completeMatches && completeMatches.length > 0) {
        const recoveredJson = '[' + completeMatches.join(',') + ']';
        try {
          JSON.parse(recoveredJson);
          console.log(`✅ JSON recuperado de resposta truncada: ${completeMatches.length} matches`);
          return recoveredJson;
        } catch (parseError) {
          console.warn("⚠️ Não foi possível recuperar JSON da resposta truncada");
        }
      }
    }
    
    console.error("❌ Nenhum JSON válido encontrado na resposta");
    console.log("📝 Conteúdo recebido:", content.substring(0, 200) + "...");
    return '';
  }
}

class ChatGPTMatcher {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Busca matches possíveis entre jogos do BGG e Ludopedia usando ChatGPT
   * @param {Array<{id: string, name: string}>} bggGames Array com objetos {id, name} dos jogos do BGG
   * @param {Array<{id: string, name: string}>} ludoGames Array com objetos {id, name} dos jogos da Ludopedia
   * @returns {Promise<Array<{bggId: string, bggName: string, ludoId: string, ludoName: string}>>} Array de matches com IDs e nomes
   */
  async findMatches(bggGames, ludoGames) {
    try {
      if (!Array.isArray(bggGames) || !Array.isArray(ludoGames)) {
        throw new Error('Invalid input: bggGames and ludoGames must be arrays');
      }

      if (bggGames.length === 0 || ludoGames.length === 0) {
        throw new Error('Empty input: both bggGames and ludoGames must not be empty');
      }

      console.log('🤖 Iniciando análise com ChatGPT...');
      console.log(`📊 Analisando ${bggGames.length} jogos do BGG e ${ludoGames.length} jogos da Ludopedia`);
      console.log('🔄 Preparando dados para análise...');
      
      // Debug: verificar estrutura dos primeiros jogos BGG
      if (bggGames.length > 0) {
        const firstBgg = bggGames[0];
        console.log('🔍 Debug BGG game structure:', {
          id: firstBgg.id,
          versionId: firstBgg.versionId,
          version_id: firstBgg.version_id,
          name: firstBgg.name?.substring(0, 30) + '...'
        });
      }

      // Criar listas com IDs únicos para identificação precisa
      // IMPORTANTE: BGG usa version_id como chave única (collid), não game_id
      // Ludopedia usa game_id como chave única
      const bggGamesWithIds = bggGames.map(game => ({
        id: `BGG_VERSION_${game.versionId || game.version_id || '0'}`, // version_id é a chave única no BGG
        name: game.name,
        gameId: game.id // game_id pode ser repetido, apenas para referência
      }));
      
      const ludoGamesWithIds = ludoGames.map(game => ({
        id: `LUDO_GAME_${game.id}`, // game_id é a chave única na Ludopedia
        name: game.name
      }));

      const prompt = `Analise estas duas listas de jogos e encontre prováveis matches entre elas.
        
        REGRAS IMPORTANTES:
        1. Compare apenas os jogos das listas fornecidas
        2. Considere variações de nome, traduções e edições diferentes
        3. Retorne os IDs únicos dos matches encontrados
        
        Lista BGG: ${JSON.stringify(bggGamesWithIds)}
        
        Lista Ludopedia: ${JSON.stringify(ludoGamesWithIds)}
        
        Retorne APENAS os matches encontrados no formato JSON array:
        [
          {
            "ludoId": "LUDO_GAME_id",
            "ludoName": "Nome do jogo na Ludopedia",
            "bggId": "BGG_VERSION_id", 
            "bggName": "Nome do jogo no BGG"
          }
        ]
        
        Use os IDs EXATOS das listas acima (ex: "LUDO_GAME_123", "BGG_VERSION_456").`;
      
      console.log('📤 Enviando prompt para o ChatGPT...');

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Era "gpt-4"
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2, // Baixa temperatura para respostas mais consistentes
        max_tokens: 4000 // Aumentado para suportar mais matches
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Resposta vazia do ChatGPT');
      }

      // Verificar se a resposta foi truncada
      const finishReason = response.choices[0]?.finish_reason;
      if (finishReason === 'length') {
        console.warn('⚠️ Resposta do ChatGPT foi truncada por limite de tokens. Alguns matches podem ter sido perdidos.');
      }

      // Debug: Gravar resposta crua do ChatGPT em arquivo de log
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const logFileName = `GPT-${timestamp}.log`;
      const logPath = path.join(__dirname, '../../data', logFileName);
      
      const logData = {
        timestamp: now.toISOString(),
        prompt: prompt,
        rawResponse: content,
        fullResponse: response
      };
      
      try {
        await fs.writeFile(logPath, JSON.stringify(logData, null, 2));
        console.log(`📝 Resposta crua do ChatGPT gravada em: ${logFileName}`);
      } catch (logError) {
        console.error('⚠️ Erro ao gravar log do ChatGPT:', logError);
      }

      console.log('📥 Resposta recebida do ChatGPT, processando...');
      
      // Extrair JSON válido da resposta
      const cleanJson = extractValidJSON(content);
      if (!cleanJson) {
        console.error('❌ Não foi possível extrair JSON válido da resposta:', content);
        throw new Error('Não foi possível extrair JSON válido da resposta do ChatGPT');
      }
      
      let rawMatches;
      try {
        rawMatches = JSON.parse(cleanJson);
        if (!Array.isArray(rawMatches)) {
          throw new Error('Formato inválido: resposta deve ser um array');
        }
      } catch (parseError) {
        console.error('❌ Erro ao processar JSON extraído:', cleanJson);
        throw new Error('Erro ao processar resposta do ChatGPT: ' + parseError.message);
      }

      // Criar mapas para busca rápida por IDs únicos (não mais por nomes!)
      // BGG: version_id é a chave única (collid)
      // Ludopedia: game_id é a chave única
      const bggGameMap = new Map(bggGames.map(game => [`BGG_VERSION_${game.versionId || game.version_id || '0'}`, game]));
      const ludoGameMap = new Map(ludoGames.map(game => [`LUDO_GAME_${game.id}`, game]));
      
      console.log(`🔍 Debug: BGG games enviados para AI: ${bggGames.length}`);
      console.log(`🔍 Debug: Ludopedia games enviados para AI: ${ludoGames.length}`);
      console.log(`🔍 Debug: Primeiros BGG IDs: ${[...bggGameMap.keys()].slice(0, 3).join(', ')}`);
      console.log(`🔍 Debug: Primeiros Ludopedia IDs: ${[...ludoGameMap.keys()].slice(0, 3).join(', ')}`);

      // Converter matches do ChatGPT (agora usando IDs únicos)
      const matches = [];
 
      for (const rawMatch of rawMatches) {
        // ChatGPT agora retorna objetos com IDs únicos
        const ludoId = rawMatch.ludoId;
        const bggId = rawMatch.bggId;
        const ludoName = rawMatch.ludoName;
        const bggName = rawMatch.bggName;
        
        const bggGame = bggGameMap.get(bggId);
        const ludoGame = ludoGameMap.get(ludoId);

        if (bggGame && ludoGame) {
          matches.push({
            bggId: bggGame.id,           // game_id (para compatibilidade)
            bggVersionId: bggGame.versionId || bggGame.version_id || '0', // version_id (chave única real)
            bggName: bggGame.name,
            ludoId: ludoGame.id,         // game_id (chave única)
            ludoName: ludoGame.name
          });
          console.log(`✅ Match válido: ${ludoName} ↔ ${bggName} (${ludoId} ↔ ${bggId})`);
        } else {
          console.warn(`⚠️ Match com IDs inválidos: "${ludoName}" (${ludoId}) ↔ "${bggName}" (${bggId})`);
          if (!bggGame) {
            console.warn(`   BGG ID não encontrado: ${bggId}`);
            // Debug: mostrar IDs BGG disponíveis similares
            const availableBggIds = [...bggGameMap.keys()].slice(0, 5);
            console.warn(`   IDs BGG disponíveis: ${availableBggIds.join(', ')}`);
          }
          if (!ludoGame) {
            console.warn(`   Ludopedia ID não encontrado: ${ludoId}`);
            // Debug: mostrar IDs Ludopedia disponíveis similares
            const availableLudoIds = [...ludoGameMap.keys()].slice(0, 5);
            console.warn(`   IDs Ludopedia disponíveis: ${availableLudoIds.join(', ')}`);
          }
        }
      }

      console.log(`✨ ${matches.length} matches válidos processados (de ${rawMatches.length} do ChatGPT)`);
      return matches;

    } catch (error) {
      console.error('❌ Erro ao buscar matches via ChatGPT:', error.message);
      return [];
    }
  }
}

module.exports = ChatGPTMatcher;
module.exports.extractValidJSON = extractValidJSON;