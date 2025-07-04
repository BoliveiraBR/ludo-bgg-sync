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
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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

            // Remover coleção existente do usuário
            await this.client.query('DELETE FROM ludopedia_collection WHERE user_name = $1', [userName]);
            
            // Inserir nova coleção
            for (const game of games) {
                const query = `
                    INSERT INTO ludopedia_collection (
                        user_name, game_id, name, type, is_expansion, year, 
                        rating, favorite, comment, link, thumbnail, image
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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

                await this.client.query(query, values);
            }
            
            console.log(`✅ Salvos ${games.length} jogos da Ludopedia para ${userName}`);
            return games.length;
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

            // Remover coleção existente do usuário
            await this.client.query('DELETE FROM bgg_collection WHERE user_name = $1', [userName]);
            
            // Inserir nova coleção
            for (const game of games) {
                const query = `
                    INSERT INTO bgg_collection (
                        user_name, game_id, name, type, is_expansion, year, 
                        rating, comment, thumbnail, image, num_plays
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `;

                const values = [
                    userName,
                    game.id,
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

                await this.client.query(query, values);
            }
            
            console.log(`✅ Salvos ${games.length} jogos do BGG para ${userName}`);
            return games.length;
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
                SELECT game_id as id, name, type, is_expansion as "isExpansion",
                       year, rating, comment, thumbnail, image, num_plays as numplays
                FROM bgg_collection 
                WHERE user_name = $1 
                ORDER BY name;
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