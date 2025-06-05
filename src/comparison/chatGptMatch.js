const OpenAI = require('openai');

class ChatGPTMatcher {
  constructor(apiKey) {
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
      console.log('🤖 Buscando matches adicionais via ChatGPT...');

      const prompt = `Analise estas duas listas de jogos e encontre prováveis matches, 
        considerando variações de nome, traduções e edições diferentes:
        
        BGG: ${JSON.stringify(bggGames)}
        
        Ludopedia: ${JSON.stringify(ludoGames)}
        
        Retorne apenas os matches encontrados no formato JSON array de arrays: 
        [[nomeLudopedia, nomeBGG], ...]`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      });

      const content = response.choices[0].message.content;
      const matches = JSON.parse(content);

      console.log(`✨ ${matches.length} matches potenciais encontrados via ChatGPT`);
      return matches;

    } catch (error) {
      console.error('❌ Erro ao buscar matches via ChatGPT:', error.message);
      return [];
    }
  }
}

module.exports = ChatGPTMatcher;