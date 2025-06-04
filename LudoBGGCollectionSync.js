// LudoBGGCollectionSync

// --- Dependências
const fs = require('fs');
require('dotenv').config();
const axios = require('axios');
const xml2js = require('xml2js');
const getAccessToken = require('./ludopediaOAuth');

const ID_BGG = process.env.ID_BGG;
const parser = new xml2js.Parser();

const {
  buscarMatchesViaChatGPT,
  getBaseNames
} = require('./ChatGPTMatch');

let allBGGCollection = [];
let allLudoCollection = [];

// -------------------- BGG --------------------

async function fetchCollection(subtype, label) {
  console.log(`📦 Buscando coleção do BGG - ${label}...`);
  try {
    const response = await axios.get(
      `https://boardgamegeek.com/xmlapi2/collection?username=${ID_BGG}&own=1&subtype=${subtype}${subtype === 'boardgame' ? '&excludesubtype=boardgameexpansion' : ''}`
    );

    const result = await parser.parseStringPromise(response.data);
    const items = result.items.item || [];

    return items.map((item, index) => ({
      num: index + 1,
      id: item.$.objectid,
      name: item.name?.[0]?._ || 'Desconhecido',
      subtype: label,
      year: item.yearpublished?.[0] || 'N/A',
      image: item.image?.[0] || '',
      thumbnail: item.thumbnail?.[0] || '',
      numplays: parseInt(item.numplays?.[0] || '0', 10),
      comment: item.comment?.[0] || '',
    }));
  } catch (err) {
    console.error(`❌ Erro ao buscar coleção (${label}):`, err.message);
    return [];
  }
}

async function getBGGCollection() {
  const baseGames = await fetchCollection('boardgame', 'base');
  const expansions = await fetchCollection('boardgameexpansion', 'expansion');

  allBGGCollection = baseGames.concat(expansions);

  fs.writeFileSync('BGGCollection.txt', '\uFEFF' + JSON.stringify(allBGGCollection, null, 2), { encoding: 'utf8' });
  console.log(`✔ ${allBGGCollection.length} itens salvos em BGGCollection.txt`);
}

// -------------------- Ludopedia --------------------

async function fetchLudopediaCollectionByType(accessToken, tipoJogo, subtypeLabel) {
  const pageSize = 100;
  let currentPage = 1;

  while (true) {
    const url = `https://ludopedia.com.br/api/v1/colecao?lista=colecao&tp_jogo=${tipoJogo}&page=${currentPage}&rows=${pageSize}&ordem=nomecomo`;
    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const data = response.data;
      if (!data || !data.colecao || data.colecao.length === 0) break;

      const mapped = data.colecao.map((jogo, index) => ({
        num: allLudoCollection.length + 1,
        id: jogo.id_jogo,
        name: jogo.nm_jogo.trim(),
        year: jogo.nr_ano_publicacao || '',
        link: jogo.link,
        type: subtypeLabel, // <- base ou expansion
        rating: jogo.vl_nota || null,
        favorite: !!jogo.fl_favorito,
        comment: jogo.comentario || '',
        cost: jogo.vl_custo || null
      }));

      allLudoCollection.push(...mapped);

      if (data.colecao.length < pageSize) break;

      currentPage++;
      await new Promise(resolve => setTimeout(resolve, 300)); // evitar erro 429
    } catch (error) {
      console.error(`❌ Erro ao buscar tipo=${tipoJogo} página=${currentPage}:`, error.message);
      break;
    }
  }
}

async function getLudopediaCollectionWithToken(accessToken) {
  console.log('📦 Buscando coleção da Ludopedia...');

  allLudoCollection = [];

  // Jogos base
  await fetchLudopediaCollectionByType(accessToken, 'b', 'base');
  // Expansões
  await fetchLudopediaCollectionByType(accessToken, 'e', 'expansion');

  fs.writeFileSync('LudopediaCollection.txt', '\uFEFF' + JSON.stringify(allLudoCollection, null, 2), { encoding: 'utf8' });
  console.log(`✔ ${allLudoCollection.length} jogos salvos em LudopediaCollection.txt`);

}

// -------------------- Estatísticas --------------------

function printCollectionStats(name, collection) {
  if (!collection || collection.length === 0) {
    console.log(`Nenhum item encontrado na coleção de ${name}.`);
    return;
  }

  const total = collection.length;

  // Determina se deve usar 'type' (Ludopedia) ou 'subtype' (BGG)
  const hasType = collection.some(item => item.type);
  const key = hasType ? 'type' : 'subtype';

  const byType = collection.reduce((acc, item) => {
    const label = item[key] || 'desconhecido';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  console.log(`📊 Estatísticas da Coleção ${name}:`);
  console.log(`- Total de itens na coleção: ${total}`);
  console.log(`- Distribuição por ${key === 'type' ? 'tipo' : 'subtipo'}:`);

  Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([label, count]) => {
      console.log(`  • ${label}: ${count}`);
    });

  console.log('');
}


// -------------------- Carregar coleções de arquivo --------------------

function loadBGGCollectionFromFile() {
  try {
    let data = fs.readFileSync('BGGCollection.txt', { encoding: 'utf8' });
    data = data.replace(/^\uFEFF/, ''); // remove BOM
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Erro ao carregar BGGCollection.txt:', error.message);
    return [];
  }
}

function loadLudopediaCollectionFromFile() {
  try {
    let data = fs.readFileSync('LudopediaCollection.txt', { encoding: 'utf8' });
    data = data.replace(/^\uFEFF/, ''); // remove BOM
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Erro ao carregar LudopediaCollection.txt:', error.message);
    return [];
  }
}

// -------------------- Compara Jogos pelo Nome --------------------

function compareBaseCollectionsByName(bggCollection, ludoCollection) {
  const normalize = name => name.trim().toLowerCase();

  const bggBaseNames = bggCollection
    .filter(item => item.subtype === 'base')
    .map(item => ({ original: item.name.trim(), normalized: normalize(item.name) }));

  const ludoBaseNames = ludoCollection
    .filter(item => item.type === 'base')
    .map(item => ({ original: item.name.trim(), normalized: normalize(item.name) }));

  const bggSet = new Map(bggBaseNames.map(({ normalized, original }) => [normalized, original]));
  const ludoSet = new Map(ludoBaseNames.map(({ normalized, original }) => [normalized, original]));

  const matches = [...bggSet.keys()].filter(name => ludoSet.has(name));
  const onlyInBGG = [...bggSet.keys()].filter(name => !ludoSet.has(name));
  const onlyInLudo = [...ludoSet.keys()].filter(name => !bggSet.has(name));

  // 📊 Exibir estatísticas no console
  console.log('\n🔍 Comparação de jogos base entre BGG e Ludopedia');
  console.log(`✔ Jogos base em comum: ${matches.length}`);
  console.log(`📘 Somente no BGG: ${onlyInBGG.length}`);
  console.log(`📙 Somente na Ludopedia: ${onlyInLudo.length}`);

  // 📝 Gerar conteúdo do arquivo
  const outputLines = [];

  outputLines.push('🧩 Jogos em comum:');
  matches.forEach(name => outputLines.push(`- ${bggSet.get(name)}`));
  outputLines.push('');

  outputLines.push('📘 Somente no BGG:');
  onlyInBGG.forEach(name => outputLines.push(`- ${bggSet.get(name)}`));
  outputLines.push('');

  outputLines.push('📙 Somente na Ludopedia:');
  onlyInLudo.forEach(name => outputLines.push(`- ${ludoSet.get(name)}`));

  fs.writeFileSync('CollectionComparison.txt', '\uFEFF' + outputLines.join('\n'), { encoding: 'utf8' });
  console.log('📄 Resultado salvo em CollectionComparison.txt');
}

// -------------------- Execução Principal --------------------

async function main() {
  /*
  //const accessToken = await getAccessToken(); // quando quiser usar OAuth real
  const accessToken = process.env.LUDO_ACCESS_TOKEN;
  // await getBGGCollection();
  // await getLudopediaCollectionWithToken(accessToken);
  const bggFromFile = loadBGGCollectionFromFile();
  const ludoFromFile = loadLudopediaCollectionFromFile();
  compareBaseCollectionsByName(bggFromFile, ludoFromFile);
  //printCollectionStats('BGG', allBGGCollection);
  //printCollectionStats('Ludopedia', allLudoCollection);*/

  const bggFromFile = loadBGGCollectionFromFile();
  const ludoFromFile = loadLudopediaCollectionFromFile();

  compareBaseCollectionsByName(bggFromFile, ludoFromFile);

  const bggNames = getBaseNames(bggFromFile, 'subtype', 'base');
  const ludoNames = getBaseNames(ludoFromFile, 'type', 'base');

  const bggSet = new Set(bggNames.map(n => n.toLowerCase()));
  const ludoSet = new Set(ludoNames.map(n => n.toLowerCase()));

  const onlyInBGG = bggNames.filter(n => !ludoSet.has(n.toLowerCase()));
  const onlyInLudo = ludoNames.filter(n => !bggSet.has(n.toLowerCase()));

  const matches = [...bggNames.filter(n => ludoSet.has(n.toLowerCase()))];

  const extraMatches = await buscarMatchesViaChatGPT(onlyInBGG, onlyInLudo);

// Atualiza os sets removendo os jogos encontrados via ChatGPT
const matchedFromBGG = new Set(extraMatches.map(m => m[1].toLowerCase()));
const matchedFromLudo = new Set(extraMatches.map(m => m[0].toLowerCase()));

const updatedOnlyInBGG = onlyInBGG.filter(n => !matchedFromBGG.has(n.toLowerCase()));
const updatedOnlyInLudo = onlyInLudo.filter(n => !matchedFromLudo.has(n.toLowerCase()));

const allMatches = [...matches, ...extraMatches];

// 📝 Atualizar arquivo CollectionComparison.txt
const outputLines = [];

outputLines.push('🧩 Jogos em comum:');
allMatches.forEach(name => {
  if (Array.isArray(name)) {
    outputLines.push(`- ${name[0]} ⇄ ${name[1]}`);
  } else {
    outputLines.push(`- ${name}`);
  }
});
outputLines.push('');

outputLines.push('📘 Somente no BGG:');
updatedOnlyInBGG.forEach(name => outputLines.push(`- ${name}`));
outputLines.push('');

outputLines.push('📙 Somente na Ludopedia:');
updatedOnlyInLudo.forEach(name => outputLines.push(`- ${name}`));

fs.writeFileSync('CollectionComparison.txt', '\uFEFF' + outputLines.join('\n'), { encoding: 'utf8' });

console.log(`\n🔁 ${extraMatches.length} matches extras sugeridos via ChatGPT`);
console.log(`✔ Total de jogos base em comum: ${allMatches.length}`);
console.log(`📘 Somente no BGG: ${updatedOnlyInBGG.length}`);
console.log(`📙 Somente na Ludopedia: ${updatedOnlyInLudo.length}`);
console.log('📄 Resultado salvo em CollectionComparison.txt');
}

main();