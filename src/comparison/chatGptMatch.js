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
   * @param {string[]} bggGames Array com nomes dos jogos do BGG
   * @param {string[]} ludoGames Array com nomes dos jogos da Ludopedia
   * @returns {Promise<Array<[string, string]>>} Array de pares [nomeLudo, nomeBGG] que são prováveis matches
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

      const prompt = `Analise estas duas listas de jogos e encontre prováveis matches, 
        considerando variações de nome, traduções e edições diferentes:
        
        BGG: ${JSON.stringify(bggGames)}
        
        Ludopedia: ${JSON.stringify(ludoGames)}
        
        Retorne apenas os matches encontrados no formato JSON array de arrays: 
        [[nomeLudopedia, nomeBGG], ...]`;
      
      console.log('📤 Enviando prompt para o ChatGPT...');

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Resposta vazia do ChatGPT');
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
      
      let matches;
      try {
        matches = JSON.parse(cleanJson);
        if (!Array.isArray(matches)) {
          throw new Error('Formato inválido: resposta deve ser um array');
        }
      } catch (parseError) {
        console.error('❌ Erro ao processar JSON extraído:', cleanJson);
        throw new Error('Erro ao processar resposta do ChatGPT: ' + parseError.message);
      }

      console.log(`✨ ${matches.length} matches potenciais encontrados via ChatGPT`);
        return matches;

    } catch (error) {
      console.error('❌ Erro ao buscar matches via ChatGPT:', error.message);
      return [];
    }
  }
}

module.exports = ChatGPTMatcher;
module.exports.extractValidJSON = extractValidJSON;