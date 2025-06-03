require('dotenv').config();

// ludopediaOAuth.js
// Login via OAuth com email/senha hardcoded (modo dev)
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

// Credenciais do app e do usuário
const CLIENT_ID = process.env.LUDO_CLIENT_ID;
const CLIENT_SECRET = process.env.LUDO_CLIENT_SECRET;
const REDIRECT_URI = process.env.LUDO_REDIRECT_URI; // Tem que ser igual ao registrado na Ludopedia
const USERNAME = process.env.LUDO_USER;
const PASSWORD = process.env.LUDO_PASS;

// Endpoint da Ludopedia
const LOGIN_URL = 'https://ludopedia.com.br/login';
const TOKEN_URL = 'https://ludopedia.com.br/oauth';

async function authenticateViaOAuth() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));

  console.log('🔐 Iniciando autenticação OAuth via login direto...');

  // 1. Estabelece sessão para obter cookies
  await client.get(LOGIN_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://ludopedia.com.br/',
    }
  });

  // 2. Realiza o login com email e senha
  const loginResponse = await client.post(LOGIN_URL,
    new URLSearchParams({
      email: USERNAME,
      senha: PASSWORD
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        'Referer': LOGIN_URL,
        'Origin': 'https://ludopedia.com.br'
      },
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    }
  );

  const cookies = await jar.getCookies('https://ludopedia.com.br');
  const sessionCookie = cookies.find(c => c.key === 'PHPSESSID');
  if (!sessionCookie) throw new Error('❌ Não foi possível obter o cookie de sessão');

  console.log(`✅ Sessão autenticada. PHPSESSID: ${sessionCookie.value}`);

  // 3. Solicita token OAuth com as credenciais e redirect_uri
  try {
    const tokenResponse = await client.post(TOKEN_URL,
      new URLSearchParams({
        grant_type: 'password',
        username: USERNAME,
        password: PASSWORD,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const token = tokenResponse.data.access_token;
    console.log('✅ Access token obtido com sucesso:', token);
    return token;
  } catch (err) {
    console.error('❌ Erro ao obter access token');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Body:', err.response.data);
    } else {
      console.error(err.message);
    }
    throw err;
  }
}

module.exports = authenticateViaOAuth;