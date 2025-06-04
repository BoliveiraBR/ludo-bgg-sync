// VerificarJogosOmitidos.js

const fs = require('fs');

function carregarJsonSemBOM(caminho) {
  try {
    let data = fs.readFileSync(caminho, { encoding: 'utf8' });
    data = data.replace(/^\uFEFF/, '');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erro ao carregar ${caminho}:`, error.message);
    return [];
  }
}

function carregarArquivoTexto(caminho) {
  try {
    return fs.readFileSync(caminho, { encoding: 'utf8' });
  } catch (error) {
    console.error(`Erro ao carregar ${caminho}:`, error.message);
    return '';
  }
}

function main() {
  const bggCollection = carregarJsonSemBOM('BGGCollection.txt');
  const ludoCollection = carregarJsonSemBOM('LudopediaCollection.txt');
  const comparisonText = carregarArquivoTexto('CollectionComparison.txt');

  const todosJogosBGG = bggCollection
    .filter(j => j.isExpansion === false)
    .map(j => j.name.trim());
  const todosJogosLudo = ludoCollection
    .filter(j => j.isExpansion === false)
    .map(j => j.name.trim());

  const todosJogos = new Set([...todosJogosBGG, ...todosJogosLudo]);

  const jogosMencionados = new Set();
  const linhas = comparisonText.split('\n');
  for (const linha of linhas) {
    const match = linha.match(/^\s*\-\s*(.*?)\s*(⇄\s*.*?)?$/);
    if (match) {
      const jogo = match[1];
      if (jogo) jogosMencionados.add(jogo);

      if (match[2]) {
        const outroJogo = match[2].replace(/^⇄\s*/, '');
        if (outroJogo) jogosMencionados.add(outroJogo);
      }
    }
  }

  const jogosOmitidos = [...todosJogos].filter(jogo => !jogosMencionados.has(jogo));

  if (jogosOmitidos.length === 0) {
    console.log('✔ Nenhum jogo omitido. Todos estão listados no CollectionComparison.txt.');
  } else {
    console.log(`❌ Foram encontrados ${jogosOmitidos.length} jogos omitidos:`);
    jogosOmitidos.forEach(j => console.log(`- ${j}`));
  }
}

main();