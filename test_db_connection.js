const { Client } = require('pg');
require('dotenv').config();

async function testDatabaseConnection() {
    console.log('🔗 Testando conexão com o banco PostgreSQL...');
    
    // Criar cliente PostgreSQL
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Necessário para RDS
        }
    });
    
    try {
        // Conectar ao banco
        console.log('⏳ Conectando...');
        await client.connect();
        console.log('✅ Conexão estabelecida com sucesso!');
        
        // Testar query simples
        console.log('🔍 Executando query de teste...');
        const result = await client.query('SELECT NOW() as current_time, version() as db_version');
        
        console.log('📊 Resultado do teste:');
        console.log('  - Horário atual:', result.rows[0].current_time);
        console.log('  - Versão do PostgreSQL:', result.rows[0].db_version.split(' ')[0]);
        
        // Testar criação de tabela simples
        console.log('🏗️  Testando criação de tabela...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS connection_test (
                id SERIAL PRIMARY KEY,
                test_time TIMESTAMP DEFAULT NOW(),
                message TEXT
            )
        `);
        console.log('✅ Tabela de teste criada com sucesso!');
        
        // Inserir dados de teste
        console.log('📝 Inserindo dados de teste...');
        await client.query(
            'INSERT INTO connection_test (message) VALUES ($1)',
            ['Teste de conexão realizado com sucesso!']
        );
        
        // Ler dados de teste
        const testData = await client.query('SELECT * FROM connection_test ORDER BY test_time DESC LIMIT 1');
        console.log('📖 Dados inseridos:', testData.rows[0]);
        
        // Limpar tabela de teste
        console.log('🧹 Limpando dados de teste...');
        await client.query('DROP TABLE IF EXISTS connection_test');
        console.log('✅ Limpeza concluída!');
        
        console.log('\n🎉 TESTE COMPLETO: Banco PostgreSQL está funcionando perfeitamente!');
        
    } catch (error) {
        console.error('❌ Erro na conexão com o banco:');
        console.error('  - Tipo:', error.name);
        console.error('  - Mensagem:', error.message);
        console.error('  - Código:', error.code);
        
        if (error.code === 'ENOTFOUND') {
            console.error('🔍 Possível problema: Host do banco não encontrado');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('🔍 Possível problema: Conexão recusada (firewall/security group)');
        } else if (error.code === '28P01') {
            console.error('🔍 Possível problema: Credenciais inválidas');
        }
        
        process.exit(1);
    } finally {
        // Fechar conexão
        await client.end();
        console.log('🔌 Conexão fechada.');
    }
}

// Executar teste
testDatabaseConnection();
