require('dotenv').config();
const fs = require('fs');
const OpenAI = require("openai");

module.exports = {
  buscarMatchesViaChatGPT,
  getBaseNames,
  extractValidJSON
};

function loadBGGCollectionFromFile() {
  try {
    let data = fs.readFileSync('BGGCollection.txt', { encoding: 'utf8' });
    data = data.replace(/^\uFEFF/, '');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Erro ao carregar BGGCollection.txt:', error.message);
    return [];
  }
}

function loadLudopediaCollectionFromFile() {
  try {
    let data = fs.readFileSync('LudopediaCollection.txt', { encoding: 'utf8' });
    data = data.replace(/^\uFEFF/, '');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Erro ao carregar LudopediaCollection.txt:', error.message);
    return [];
  }
}

function getBaseNames(collection, typeKey, typeValue) {
  return collection
    .filter(item => item[typeKey] === typeValue)
    .map(item => item.name.trim());
}

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
          const parsed = JSON.parse(candidateJson);
          // Para o arquivo deprecated, espera um objeto com propriedade matches
          if (parsed.matches && Array.isArray(parsed.matches)) {
            console.log("✅ JSON extraído com sucesso");
            return candidateJson;
          }
        } catch (parseError) {
          continue;
        }
      }
    }
    
    // Tentativa manual mais robusta - procura especificamente por objetos com matches
    const objectStart = content.indexOf('{');
    if (objectStart !== -1) {
      // Encontra o bracket de fechamento correspondente
      let bracketCount = 0;
      let objectEnd = -1;
      
      for (let i = objectStart; i < content.length; i++) {
        if (content[i] === '{') bracketCount++;
        if (content[i] === '}') {
          bracketCount--;
          if (bracketCount === 0) {
            objectEnd = i;
            break;
          }
        }
      }
      
      if (objectEnd !== -1) {
        const candidateJson = content.substring(objectStart, objectEnd + 1);
        try {
          const parsed = JSON.parse(candidateJson);
          if (parsed.matches && Array.isArray(parsed.matches)) {
            console.log("✅ JSON extraído manualmente (objeto)");
            return candidateJson;
          }
        } catch (parseError) {
          // Continue para próxima tentativa
        }
      }
    }
    
    console.error("❌ Nenhum JSON válido encontrado na resposta");
    console.log("📝 Conteúdo recebido:", content.substring(0, 200) + "...");
    return '';
  }
}

async function buscarMatchesViaChatGPT(onlyInBGG, onlyInLudo) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `
Você é um especialista em jogos de tabuleiro. Compare as duas listas de nomes de jogos abaixo. 
Identifique jogos que são o mesmo, apesar de estarem com nomes diferentes (por exemplo, um nome traduzido ou com pequenas variações).
Restrinja sua resposta a APENAS uma lista que contenha os jogos que são equivalentes entre as duas listas:
"matches": uma lista de pares de jogos que são o mesmo (com o nome da Ludopedia e o nome do BGG);

Exemplo de resposta:
{
  "matches": ["Jogo A Ludopedia", "Jogo A BGG"]
}

SUA REPOSTA NÃO DEVE CONTER NADA ALÉM DO JSON!

Ludopedia: ${JSON.stringify(onlyInLudo)}
BGG: ${JSON.stringify(onlyInBGG)}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("❌ Resposta da OpenAI vazia ou inesperada:", response);
      return [];
    }
    
    // Extrair JSON válido da resposta
    const cleanJson = extractValidJSON(content);
    if (!cleanJson) {
      console.error("❌ Não foi possível extrair JSON válido da resposta");
      return [];
    }
    
    const parsed = JSON.parse(cleanJson);
    return parsed.matches || [];
  } catch (error) {
    console.error("❌ Erro ao buscar matches via ChatGPT:", error.response?.data || error.message);
    return [];
  }
}
