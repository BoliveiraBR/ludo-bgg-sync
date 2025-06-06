const OpenAI = require('openai');

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

      console.log('📥 Resposta recebida do ChatGPT, processando...');
      
      let matches;
      try {
        matches = JSON.parse(content);
        if (!Array.isArray(matches)) {
          throw new Error('Formato inválido: resposta deve ser um array');
        }
      } catch (parseError) {
        console.error('❌ Erro ao processar resposta:', content);
        throw new Error('Erro ao processar resposta do ChatGPT: ' + parseError.message);
      }

      console.log(`✨ ${matches.length} matches potenciais encontrados via ChatGPT`);
      if (matches.length > 0) {
        console.log('🎲 Exemplos de matches encontrados:');
        matches.slice(0, 3).forEach(([ludo, bgg]) => {
          console.log(`   ${ludo} ↔️ ${bgg}`);
        });
      }
      return matches;

    } catch (error) {
      console.error('❌ Erro ao buscar matches via ChatGPT:', error.message);
      return [];
    }
  }
}

module.exports = ChatGPTMatcher;