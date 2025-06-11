const { Client } = require('pg');

async function testDatabase() {
    console.log('🔗 Testando conexão com PostgreSQL RDS...');
    console.log('📋 DATABASE_URL encontrada:', !!process.env.DATABASE_URL);
    
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
    
    try {
        console.log('⏳ Conectando ao banco...');
        await client.connect();
        console.log('✅ Conexão estabelecida com sucesso!');
        
        // Teste básico
        console.log('🔍 Executando query de teste...');
        const result = await client.query('SELECT NOW() as current_time, version() as db_version');
        
        console.log('📊 Resultado do teste:');
        console.log('  - Timestamp:', result.rows[0].current_time);
        console.log('  - Versão PostgreSQL:', result.rows[0].db_version.split(' ')[0]);
        
        // Testar criação de tabela
        console.log('🏗️  Testando criação de tabela de teste...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS connection_test (
                id SERIAL PRIMARY KEY,
                test_time TIMESTAMP DEFAULT NOW(),
                message TEXT
            )
        `);
        console.log('✅ Tabela de teste criada/verificada!');
        
        // Inserir dados de teste
        console.log('📝 Inserindo dados de teste...');
        await client.query(`
            INSERT INTO connection_test (message) 
            VALUES ('Teste de conexão realizado com sucesso!')
        `);
        
        // Consultar dados
        const testData = await client.query('SELECT * FROM connection_test ORDER BY id DESC LIMIT 1');
        console.log('📋 Último registro:', testData.rows[0]);
        
        console.log('🎉 Teste completo realizado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro na conexão:');
        console.error('  - Tipo:', error.name);
        console.error('  - Mensagem:', error.message);
        console.error('  - Código:', error.code);
        
        if (error.code === 'ENOTFOUND') {
            console.error('🔍 Host do banco não encontrado');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('🔍 Conexão recusada - verificar security group');
        } else if (error.code === '28P01') {
            console.error('🔍 Credenciais inválidas');
        }
        
    } finally {
        await client.end();
        console.log('🔌 Conexão fechada.');
    }
}

testDatabase();