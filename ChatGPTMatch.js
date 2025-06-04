require('dotenv').config();
const fs = require('fs');
const OpenAI = require("openai");

module.exports = {
  buscarMatchesViaChatGPT,
  getBaseNames
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

async function buscarMatchesViaChatGPT(onlyInBGG, onlyInLudo) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `
Você é um especialista em jogos de tabuleiro. Compare as duas listas de nomes de jogos abaixo. 
Identifique jogos que são o mesmo, apesar de estarem com nomes diferentes (por exemplo, um nome traduzido ou com pequenas variações).
Retorne a resposta:
"matches": uma lista de pares de jogos que são o mesmo (com o nome da Ludopedia e o nome do BGG);

Exemplo de resposta:
{
  "matches": [["Jogo A Ludopedia", "Jogo A BGG"], ["Jogo B Ludopedia", "Jogo B BGG"]]
}

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
    const parsed = JSON.parse(content);
    return parsed.matches || [];
  } catch (error) {
    console.error("❌ Erro ao buscar matches via ChatGPT:", error.response?.data || error.message);
    return [];
  }
}
