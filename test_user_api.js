const axios = require('axios');
const xml2js = require('xml2js');

async function testUserAPI() {
    console.log('🧪 Testando API de usuário do BGG...');
    
    const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true,
        trim: true
    });
    
    try {
        const url = 'https://boardgamegeek.com/xmlapi2/user?name=AcemanBR';
        console.log(`📡 Fazendo requisição para: ${url}`);
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'BGG-Ludopedia-Sync/1.0'
            }
        });
        
        console.log('✅ Resposta recebida:', response.status);
        console.log('📄 Dados brutos:', response.data.substring(0, 500));
        
        const result = await parser.parseStringPromise(response.data);
        console.log('🔍 Dados parseados:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (error.response) {
            console.error('📊 Status:', error.response.status);
            console.error('📄 Data:', error.response.data?.substring(0, 500));
        }
    }
}

testUserAPI();
