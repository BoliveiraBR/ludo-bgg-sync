require('dotenv').config();
const { Client } = require('pg');

async function debugMatches() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log('✅ Conectado ao banco de dados');
        
        // Verificar usuários na tabela collection_matches
        const result = await client.query(`
            SELECT bgg_user_name, ludopedia_user_name, COUNT(*) as count 
            FROM collection_matches 
            GROUP BY bgg_user_name, ludopedia_user_name 
            ORDER BY count DESC 
            LIMIT 10;
        `);
        
        console.log('📊 Usuários na tabela collection_matches:');
        result.rows.forEach(row => {
            console.log(`  BGG: ${row.bgg_user_name} | Ludopedia: ${row.ludopedia_user_name} | Matches: ${row.count}`);
        });
        
        // Verificar últimos matches criados
        const recentMatches = await client.query(`
            SELECT bgg_user_name, ludopedia_user_name, match_type, created_at
            FROM collection_matches 
            ORDER BY created_at DESC 
            LIMIT 5;
        `);
        
        console.log('\n📅 Últimos matches criados:');
        recentMatches.rows.forEach(row => {
            console.log(`  ${row.created_at} | BGG: ${row.bgg_user_name} | Ludopedia: ${row.ludopedia_user_name} | Tipo: ${row.match_type}`);
        });
        
        // Verificar usuários na tabela users
        const users = await client.query(`
            SELECT id, bgg_username, ludopedia_username, created_at
            FROM users
            ORDER BY created_at DESC;
        `);
        
        console.log('\n👥 Usuários na tabela users:');
        users.rows.forEach(row => {
            console.log(`  ID: ${row.id} | BGG: ${row.bgg_username} | Ludopedia: ${row.ludopedia_username} | Criado: ${row.created_at}`);
        });
        
        // Verificar sessões ativas
        const sessions = await client.query(`
            SELECT us.jwt_jti, us.user_id, us.created_at, us.last_used, us.expires_at, us.revoked,
                   u.bgg_username, u.ludopedia_username
            FROM user_sessions us
            JOIN users u ON us.user_id = u.id
            WHERE us.revoked = FALSE AND us.expires_at > CURRENT_TIMESTAMP
            ORDER BY us.last_used DESC;
        `);
        
        console.log('\n🔐 Sessões ativas:');
        sessions.rows.forEach(row => {
            console.log(`  JWT: ${row.jwt_jti} | UserID: ${row.user_id} | BGG: ${row.bgg_username} | Ludopedia: ${row.ludopedia_username} | Último uso: ${row.last_used}`);
        });
        
        // Verificar se há pareamentos manuais recentes com usuário errado
        const recentManualMatches = await client.query(`
            SELECT bgg_user_name, ludopedia_user_name, match_type, created_at
            FROM collection_matches 
            WHERE match_type = 'manual' AND created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC 
            LIMIT 10;
        `);
        
        console.log('\n📝 Pareamentos manuais das últimas 24 horas:');
        recentManualMatches.rows.forEach(row => {
            console.log(`  ${row.created_at} | BGG: ${row.bgg_user_name} | Ludopedia: ${row.ludopedia_user_name}`);
        });
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await client.end();
    }
}

debugMatches();