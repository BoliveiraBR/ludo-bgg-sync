// Teste da função extractValidJSON
const { extractValidJSON } = require('./src/comparison/chatGptMatch');

// Teste com diferentes tipos de resposta do ChatGPT
const testCases = [
  // Caso 1: JSON puro
  {
    name: "JSON puro",
    input: '[["fear", "fast forward: fear"], ["zoo vadis: deluxe edition", "zoo vadis"]]',
    expected: true
  },
  
  // Caso 2: Texto antes do JSON
  {
    name: "Texto antes do JSON",
    input: 'Aqui estão os matches encontrados:\n\n[["fear", "fast forward: fear"], ["zoo vadis: deluxe edition", "zoo vadis"]]',
    expected: true
  },
  
  // Caso 3: JSON em markdown
  {
    name: "JSON em markdown",
    input: 'Os matches encontrados entre as duas listas são:\n\n```\n[\n    ["fear", "fast forward: fear"],\n    ["zoo vadis: deluxe edition", "zoo vadis"]\n]\n```',
    expected: true
  },
  
  // Caso 4: Texto explicativo + JSON
  {
    name: "Texto explicativo + JSON",
    input: 'Aqui estão os prováveis matches entre as duas listas de jogos:\n\n[\n    ["fear", "fast forward: fear"],\n    ["zoo vadis: deluxe edition", "zoo vadis"]\n]',
    expected: true
  }
];

console.log('🧪 Testando função extractValidJSON...\n');

testCases.forEach((testCase, index) => {
  console.log(`Teste ${index + 1}: ${testCase.name}`);
  try {
    const result = extractValidJSON(testCase.input);
    if (result) {
      const parsed = JSON.parse(result);
      console.log(`✅ Sucesso - Extraiu JSON com ${Array.isArray(parsed) ? parsed.length : 'propriedades'} items`);
    } else {
      console.log(`❌ Falhou - Não conseguiu extrair JSON`);
    }
  } catch (error) {
    console.log(`❌ Erro - ${error.message}`);
  }
  console.log('');
});

console.log('🏁 Teste concluído');
