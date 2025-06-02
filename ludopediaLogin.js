const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

async function loginLudopedia(email, senha) {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));

  console.log('🔐 Simulando navegador para login...');

  // Passo 1: acessar a página de login para iniciar cookies de sessão
  await client.get('https://ludopedia.com.br/login', {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://ludopedia.com.br/',
    },
  });

  // Passo 2: enviar o formulário de login via POST
  const loginRes = await client.post(
    'https://ludopedia.com.br/login',
    new URLSearchParams({
      email: email,
      senha: senha,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://ludopedia.com.br/login',
        'Origin': 'https://ludopedia.com.br',
      },
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400, // aceita redirect 302
    }
  );

  // Passo 3: capturar o cookie PHPSESSID
  const cookies = await jar.getCookies('https://ludopedia.com.br');
  cookies.forEach(c => console.log(`${c.key}=${c.value}`));
  const sessionCookie = cookies.find(c => c.key === 'PHPSESSID');

  if (!sessionCookie) {
    throw new Error('❌ PHPSESSID não foi encontrado após login.');
  }

  const sessionId = sessionCookie.value;
  console.log('✅ Login realizado com sucesso. SessionID:', sessionId);

  return { sessionId, client };
}

module.exports = loginLudopedia;