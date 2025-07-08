const { Client } = require('pg');

class MatchManager {
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
            console.log('✅ MatchManager conectado ao banco de dados PostgreSQL');
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
            console.log('🔌 MatchManager desconectado do banco de dados');
        }
    }

    /**
     * Salva múltiplos matches no banco de dados com validação anti-duplicação
     */
    async saveMatches(matches) {
        try {
            if (!this.client) {
                await this.connect();
            }

            if (!matches || matches.length === 0) {
                console.log('⚠️ Nenhum match para salvar');
                return 0;
            }

            let savedCount = 0;
            for (const match of matches) {
                // Verificar se o jogo BGG já tem match
                const bggExistingMatch = await this.client.query(`
                    SELECT ludopedia_game_id FROM collection_matches 
                    WHERE bgg_user_name = $1 AND bgg_game_id = $2 AND bgg_version_id = $3
                `, [match.bggUser, match.bggId, match.bggVersionId || '0']);

                if (bggExistingMatch.rows.length > 0) {
                    console.error(`❌ INCONSISTÊNCIA: BGG game ${match.bggId} (v${match.bggVersionId || '0'}) já tem match com Ludopedia ${bggExistingMatch.rows[0].ludopedia_game_id}. Tentativa de match com ${match.ludoId} rejeitada.`);
                    continue;
                }

                // Verificar se o jogo Ludopedia já tem match
                const ludoExistingMatch = await this.client.query(`
                    SELECT bgg_game_id, bgg_version_id FROM collection_matches 
                    WHERE ludopedia_user_name = $1 AND ludopedia_game_id = $2
                `, [match.ludoUser, match.ludoId]);

                if (ludoExistingMatch.rows.length > 0) {
                    const existingBgg = ludoExistingMatch.rows[0];
                    console.error(`❌ INCONSISTÊNCIA: Ludopedia game ${match.ludoId} já tem match com BGG ${existingBgg.bgg_game_id} (v${existingBgg.bgg_version_id}). Tentativa de match com BGG ${match.bggId} rejeitada.`);
                    continue;
                }

                // Se chegou aqui, pode inserir
                const query = `
                    INSERT INTO collection_matches (
                        bgg_user_name, bgg_game_id, bgg_version_id,
                        ludopedia_user_name, ludopedia_game_id, match_type
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `;

                const values = [
                    match.bggUser,
                    match.bggId,
                    match.bggVersionId || '0',
                    match.ludoUser,
                    match.ludoId,
                    match.matchType || 'manual'
                ];

                try {
                    await this.client.query(query, values);
                    savedCount++;
                    console.log(`✅ Match salvo: BGG ${match.bggId} ↔ Ludopedia ${match.ludoId} (${match.matchType})`);
                } catch (insertError) {
                    console.error(`❌ Erro ao inserir match ${match.bggId} <-> ${match.ludoId}:`, insertError.message);
                }
            }

            console.log(`✅ Salvos ${savedCount} matches no banco`);
            
            // Retornar informações detalhadas sobre o salvamento
            return {
                savedCount,
                totalProcessed: matches.length,
                hasConflicts: savedCount < matches.length
            };
        } catch (error) {
            console.error('❌ Erro ao salvar matches:', error);
            throw error;
        }
    }

    /**
     * Busca todos os matches de um usuário
     */
    async getMatches(bggUser, ludoUser) {
        try {
            if (!this.client) {
                await this.connect();
            }

            const query = `
                SELECT 
                    cm.id,
                    cm.bgg_user_name as "bggUser",
                    cm.bgg_game_id as "bggId", 
                    cm.bgg_version_id as "bggVersionId",
                    cm.ludopedia_user_name as "ludoUser",
                    cm.ludopedia_game_id as "ludoId",
                    cm.match_type as "matchType",
                    cm.created_at as "createdAt",
                    bg.name as "bggName",
                    lg.name as "ludoName"
                FROM collection_matches cm
                LEFT JOIN bgg_collection bg ON (
                    cm.bgg_user_name = bg.user_name AND 
                    cm.bgg_game_id = bg.game_id AND 
                    cm.bgg_version_id = bg.version_id
                )
                LEFT JOIN ludopedia_collection lg ON (
                    cm.ludopedia_user_name = lg.user_name AND 
                    cm.ludopedia_game_id = lg.game_id
                )
                WHERE cm.bgg_user_name = $1 AND cm.ludopedia_user_name = $2
                ORDER BY cm.created_at DESC
            `;

            const result = await this.client.query(query, [bggUser, ludoUser]);
            return result.rows;
        } catch (error) {
            console.error('❌ Erro ao buscar matches:', error);
            throw error;
        }
    }

    /**
     * Remove um match específico
     */
    async removeMatch(matchId) {
        try {
            if (!this.client) {
                await this.connect();
            }

            const query = 'DELETE FROM collection_matches WHERE id = $1';
            const result = await this.client.query(query, [matchId]);
            
            console.log(`✅ Match ${matchId} removido`);
            return result.rowCount > 0;
        } catch (error) {
            console.error('❌ Erro ao remover match:', error);
            throw error;
        }
    }

    /**
     * Busca estatísticas de matches para um usuário
     */
    async getMatchStats(bggUser, ludoUser) {
        try {
            if (!this.client) {
                await this.connect();
            }

            const queries = {
                total: `
                    SELECT COUNT(*) as count 
                    FROM collection_matches 
                    WHERE bgg_user_name = $1 AND ludopedia_user_name = $2
                `,
                byType: `
                    SELECT match_type, COUNT(*) as count 
                    FROM collection_matches 
                    WHERE bgg_user_name = $1 AND ludopedia_user_name = $2
                    GROUP BY match_type
                `
            };

            const [totalResult, byTypeResult] = await Promise.all([
                this.client.query(queries.total, [bggUser, ludoUser]),
                this.client.query(queries.byType, [bggUser, ludoUser])
            ]);

            const stats = {
                total: parseInt(totalResult.rows[0].count),
                byType: {}
            };

            byTypeResult.rows.forEach(row => {
                stats.byType[row.match_type] = parseInt(row.count);
            });

            return stats;
        } catch (error) {
            console.error('❌ Erro ao buscar estatísticas de matches:', error);
            throw error;
        }
    }

    /**
     * Remove todos os matches de um usuário
     */
    async clearUserMatches(bggUser, ludoUser) {
        try {
            if (!this.client) {
                await this.connect();
            }

            const query = `
                DELETE FROM collection_matches 
                WHERE bgg_user_name = $1 AND ludopedia_user_name = $2
            `;
            
            const result = await this.client.query(query, [bggUser, ludoUser]);
            console.log(`✅ Removidos ${result.rowCount} matches do usuário`);
            return result.rowCount;
        } catch (error) {
            console.error('❌ Erro ao limpar matches do usuário:', error);
            throw error;
        }
    }
}

module.exports = MatchManager;