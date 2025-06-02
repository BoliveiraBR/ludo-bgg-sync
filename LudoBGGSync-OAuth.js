// LudoBGGSync + OAuth (versão atualizada)

// --- Dependências
const fs = require('fs');
const axios = require('axios');
const xml2js = require('xml2js');
const getAccessToken = require('./ludopediaOAuth');

const ID_BGG = 'acemanbr';
const parser = new xml2js.Parser();

let allBGGPlays = [];
let allLudoPlays = [];

// -------------------- BGG --------------------

async function getBGGPlays() {
  let page = 1;
  let totalPages = 1;
  let plays = [];

  console.log('Buscando partidas do BGG...');
  try {
    while (page <= totalPages) {
      const response = await axios.get(`https://boardgamegeek.com/xmlapi2/plays?username=${ID_BGG}&page=${page}`);
      const result = await parser.parseStringPromise(response.data);

      if (page === 1) {
        const total = parseInt(result.plays.$.total, 10);
        const perPage = result.plays.play.length;
        totalPages = Math.ceil(total / perPage);
      }

      if (result.plays.play) {
        plays = plays.concat(result.plays.play);
      }
      page++;
    }

    allBGGPlays = plays.map((play, index) => ({
      num: plays.length - index,
      id: play.$.id,
      date: play.$.date,
      game: play.item[0].$.name,
      location: play.$.location || 'N/A',
      total_plays: 1
    }));

    fs.writeFileSync('BGGPlays.txt', '\uFEFF' + JSON.stringify(allBGGPlays, null, 2), { encoding: 'utf8' });
    console.log('✔ Arquivo BGGPlays.txt salvo com sucesso!');
  } catch (error) {
    console.error('Erro ao buscar partidas do BGG:', error.message);
  }
}

// -------------------- Ludopedia --------------------

async function getLudopediaPlaysWithToken(accessToken) {
  console.log('🔎 Buscando partidas da Ludopedia com OAuth...');

  const tamanhoPagina = 10;
  let pagina = 1;
  let totalPartidas = [];

  while (true) {
    try {
      const response = await axios.get(`https://ludopedia.com.br/api/v1/partidas?page=${pagina}&rows=${tamanhoPagina}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const partidas = response.data.partidas || [];
      //console.log(`📄 Página ${pagina}: ${partidas.length} partidas`);

      if (partidas.length === 0) break;

      totalPartidas = totalPartidas.concat(partidas);

      // Se vier menos que o tamanho da página, é a última
      if (partidas.length < tamanhoPagina) break;

      pagina++;
      await new Promise(resolve => setTimeout(resolve, 1)); // delay entre chamadas, caso necessário evitar HTTP 429

    } catch (error) {
      if (error.response) {
        console.error(`❌ Erro ao buscar página ${pagina} - Status: ${error.response.status}`);
      } else {
        console.error(`❌ Erro inesperado na página ${pagina}:`, error.message);
      }
      break; // encerra loop em caso de erro
    }
  }

  allLudoPlays = totalPartidas.map((p, index) => ({
    num: index + 1,
    id: p.id_partida,
    date: p.dt_partida,
    game: p.jogo?.nm_jogo || 'Desconhecido',
    description: p.descricao || '',
    duration: p.duracao || null,
    total_plays: p.qt_partidas || 1,
    players: p.jogadores?.length || 0,
    expansions: Array.isArray(p.expansoes)
      ? p.expansoes.map(e => e.nm_jogo).join(', ')
      : ''
  }));

  fs.writeFileSync('LudopediaPlays.txt', '\uFEFF' + JSON.stringify(allLudoPlays, null, 2), { encoding: 'utf8' });
  console.log(`✔ ${allLudoPlays.length} registros salvos em LudopediaPlays.txt`);
}

// -------------------- Estatísticas --------------------

function printStats(name, plays) {
  if (plays.length === 0) {
    console.log(`Nenhuma partida encontrada em ${name}.`);
    return;
  }

  const sortedByDate = plays.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const firstDate = sortedByDate[0].date;
  const lastDate = sortedByDate[sortedByDate.length - 1].date;

  let totalPlays = 0;
  const gameCount = {};

  for (const play of plays) {
    const count = play.total_plays || 1;
    //console.log(`Jogo ${totalPlays}: ${play.game}`); // Listando para debug cada jogo de partida registrada
    totalPlays += count;
    gameCount[play.game] = (gameCount[play.game] || 0) + count;
  }

  const mostPlayedGame = Object.entries(gameCount).reduce((a, b) => b[1] > a[1] ? b : a)[0];

  console.log(`📊 Estatísticas de ${name}:`);
  console.log(`- Total de partidas: ${totalPlays}`);
  console.log(`- Primeira partida registrada: ${firstDate}`);
  console.log(`- Última partida registrada: ${lastDate}`);
  console.log(`- Jogo mais jogado: ${mostPlayedGame}`);
  console.log('');
}

// -------------------- Execução Principal --------------------

async function main() {
  /*const accessToken = await getAccessToken();
  if (!accessToken) {
    console.error('❌ Falha ao obter access token');
    return;
  }*/

  // await getBGGPlays(); // opcional
  await getLudopediaPlaysWithToken('697d3533041480e6cea91a762f559065');
  // printStats('BGG', allBGGPlays); // opcional
  printStats('Ludopedia', allLudoPlays);
}

main();