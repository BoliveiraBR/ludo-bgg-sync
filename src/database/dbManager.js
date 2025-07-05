const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class DatabaseManager {
    constructor() {
        this.client = null;
    }

    /**
     * Conecta ao banco de dados PostgreSQL
     */
    async connect() {
        try {
            this.client = new Client({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });
            
            await this.client.connect();
            console.log('✅ Conectado ao banco de dados PostgreSQL');
            return true;
        } catch (error) {
            console.error('❌ Erro ao conectar ao banco:', error);
            throw error;
        }
    }

    /**
     * Desconecta do banco de dados
     */
    async disconnect() {
        if (this.client) {
            await this.client.end();
            console.log('🔌 Desconectado do banco de dados');
        }
    }

    /**
     * Executa o schema SQL para criar as tabelas
     */
    async createTables() {
        try {
            if (!this.client) {
                await this.connect();
            }

            // Lê o arquivo schema.sql
            const schemaPath = path.join(__dirname, '../../database/schema.sql');
            const schema = await fs.readFile(schemaPath, 'utf8');

            // Executa o schema
            await this.client.query(schema);
            console.log('✅ Tabelas criadas com sucesso!');
            
            await this.disconnect();
            return true;
        } catch (error) {
            console.error('❌ Erro ao criar tabelas:', error);
            throw error;
        }
    }

    /**
     * Salva coleção completa de um usuário na Ludopedia (substitui dados existentes)
     */
    async saveLudopediaCollection(userName, games) {
        try {
            if (!this.client) {
                await this.connect();
            }

            // Deduplificar jogos por ID
            const gameMap = new Map();
            games.forEach(game => {
                if (game.id) {
                    gameMap.set(game.id, game);
                }
            });
            const uniqueGames = Array.from(gameMap.values());
            
            if (uniqueGames.length !== games.length) {
                console.log(`🔄 Removidas ${games.length - uniqueGames.length} duplicatas da Ludopedia`);
            }

            // Remover coleção existente do usuário
            const deleteResult = await this.client.query('DELETE FROM ludopedia_collection WHERE user_name = $1', [userName]);
            console.log(`🗑️ Removidos ${deleteResult.rowCount} jogos antigos da Ludopedia`);
            
            // Inserir nova coleção com proteção contra duplicatas
            let insertedCount = 0;
            for (const game of uniqueGames) {
                const query = `
                    INSERT INTO ludopedia_collection (
                        user_name, game_id, name, type, is_expansion, year, 
                        rating, favorite, comment, link, thumbnail, image
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (user_name, game_id) DO NOTHING
                `;

                const values = [
                    userName,
                    game.id,
                    game.name,
                    game.type || 'base',
                    game.isExpansion || false,
                    game.year || null,
                    game.rating || null,
                    game.favorite || false,
                    game.comment || null,
                    game.link || null,
                    game.thumbnail || null,
                    game.image || null
                ];

                try {
                    await this.client.query(query, values);
                    insertedCount++;
                } catch (insertError) {
                    console.warn(`⚠️ Erro ao inserir jogo ${game.id} (${game.name}):`, insertError.message);
                }
            }
            
            console.log(`✅ Salvos ${insertedCount} jogos da Ludopedia para ${userName}`);
            return insertedCount;
        } catch (error) {
            console.error('❌ Erro ao salvar coleção da Ludopedia:', error);
            throw error;
        }
    }

    /**
     * Salva coleção completa de um usuário no BGG (substitui dados existentes)
     */
    async saveBGGCollection(userName, games) {
        try {
            if (!this.client) {
                await this.connect();
            }

            // Deduplificar jogos por ID + version_id
            const gameMap = new Map();
            games.forEach(game => {
                if (game.id) {
                    const key = `${game.id}_${game.versionId || '0'}`;
                    gameMap.set(key, game);
                }
            });
            const uniqueGames = Array.from(gameMap.values());
            
            if (uniqueGames.length !== games.length) {
                console.log(`🔄 Removidas ${games.length - uniqueGames.length} duplicatas do BGG`);
            }

            // Remover coleção existente do usuário
            const deleteResult = await this.client.query('DELETE FROM bgg_collection WHERE user_name = $1', [userName]);
            console.log(`🗑️ Removidos ${deleteResult.rowCount} jogos antigos do BGG`);
            
            // Inserir nova coleção com proteção contra duplicatas
            let insertedCount = 0;
            for (const game of uniqueGames) {
                const query = `
                    INSERT INTO bgg_collection (
                        user_name, game_id, version_id, name, type, is_expansion, year, 
                        rating, comment, thumbnail, image, num_plays
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (user_name, game_id, version_id) DO NOTHING
                `;

                const values = [
                    userName,
                    game.id,
                    game.versionId || '0',
                    game.name,
                    game.type || 'base',
                    game.isExpansion || false,
                    game.year || null,
                    game.rating || null,
                    game.comment || null,
                    game.thumbnail || null,
                    game.image || null,
                    game.numplays || 0
                ];

                try {
                    await this.client.query(query, values);
                    insertedCount++;
                } catch (insertError) {
                    console.warn(`⚠️ Erro ao inserir jogo ${game.id} (${game.name}):`, insertError.message);
                }
            }
            
            console.log(`✅ Salvos ${insertedCount} jogos do BGG para ${userName}`);
            return insertedCount;
        } catch (error) {
            console.error('❌ Erro ao salvar coleção do BGG:', error);
            throw error;
        }
    }

    /**
     * Busca coleção de um usuário na Ludopedia
     */
    async getLudopediaCollection(userName) {
        try {
            if (!this.client) {
                await this.connect();
            }

            const query = `
                SELECT game_id as id, name, type, is_expansion as "isExpansion", 
                       year, rating, favorite, comment, link, thumbnail, image
                FROM ludopedia_collection 
                WHERE user_name = $1 
                ORDER BY name;
            `;

            const result = await this.client.query(query, [userName]);
            return result.rows;
        } catch (error) {
            console.error('❌ Erro ao buscar coleção da Ludopedia:', error);
            throw error;
        }
    }

    /**
     * Busca coleção de um usuário no BGG
     */
    async getBGGCollection(userName) {
        try {
            if (!this.client) {
                await this.connect();
            }

            const query = `
                SELECT game_id as id, version_id as "versionId", name, type, is_expansion as "isExpansion",
                       year, rating, comment, thumbnail, image, num_plays as numplays
                FROM bgg_collection 
                WHERE user_name = $1 
                ORDER BY name, version_id;
            `;

            const result = await this.client.query(query, [userName]);
            return result.rows;
        } catch (error) {
            console.error('❌ Erro ao buscar coleção do BGG:', error);
            throw error;
        }
    }
}

module.exports = DatabaseManager;