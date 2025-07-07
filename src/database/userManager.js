const { Client } = require('pg');

class UserManager {
    constructor() {
        this.client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
    }

    async connect() {
        try {
            await this.client.connect();
            console.log('✅ UserManager conectado ao banco de dados');
        } catch (error) {
            console.error('❌ Erro ao conectar UserManager ao banco:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            await this.client.end();
            console.log('✅ UserManager desconectado do banco');
        } catch (error) {
            console.error('❌ Erro ao desconectar UserManager:', error);
        }
    }

    /**
     * Cria um novo usuário no sistema
     * @param {Object} userData - Dados do usuário
     * @param {string} userData.email - Email do usuário
     * @param {string} userData.password_hash - Hash da senha
     * @param {string} userData.name - Nome do usuário
     * @param {string} userData.bgg_username - Username do BGG
     * @param {string} userData.ludopedia_username - Username da Ludopedia
     * @param {string} userData.preferred_platform - Plataforma preferida ('bgg' ou 'ludopedia')
     * @returns {Promise<Object>} - Dados do usuário criado
     */
    async createUser(userData) {
        const query = `
            INSERT INTO users (email, password_hash, name, bgg_username, ludopedia_username, preferred_platform)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, email, name, bgg_username, ludopedia_username, preferred_platform, created_at, active
        `;
        
        const values = [
            userData.email,
            userData.password_hash,
            userData.name,
            userData.bgg_username,
            userData.ludopedia_username,
            userData.preferred_platform || 'bgg'
        ];

        try {
            const result = await this.client.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Erro ao criar usuário:', error);
            throw error;
        }
    }

    /**
     * Busca usuário por email
     * @param {string} email - Email do usuário
     * @returns {Promise<Object|null>} - Dados do usuário ou null se não encontrado
     */
    async getUserByEmail(email) {
        const query = `
            SELECT id, email, password_hash, name, bgg_username, ludopedia_username, 
                   preferred_platform, created_at, active
            FROM users 
            WHERE email = $1 AND active = TRUE
        `;

        try {
            const result = await this.client.query(query, [email]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('❌ Erro ao buscar usuário por email:', error);
            throw error;
        }
    }

    /**
     * Busca usuário por ID
     * @param {number} userId - ID do usuário
     * @returns {Promise<Object|null>} - Dados do usuário ou null se não encontrado
     */
    async getUserById(userId) {
        const query = `
            SELECT id, email, name, bgg_username, ludopedia_username, 
                   preferred_platform, created_at, active
            FROM users 
            WHERE id = $1 AND active = TRUE
        `;

        try {
            const result = await this.client.query(query, [userId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('❌ Erro ao buscar usuário por ID:', error);
            throw error;
        }
    }

    /**
     * Atualiza dados do usuário
     * @param {number} userId - ID do usuário
     * @param {Object} updateData - Dados para atualizar
     * @returns {Promise<Object>} - Dados atualizados do usuário
     */
    async updateUser(userId, updateData) {
        const allowedFields = ['name', 'bgg_username', 'ludopedia_username', 'preferred_platform'];
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        // Construir query dinamicamente baseado nos campos fornecidos
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                updateFields.push(`${key} = $${paramIndex}`);
                updateValues.push(value);
                paramIndex++;
            }
        }

        if (updateFields.length === 0) {
            throw new Error('Nenhum campo válido para atualização');
        }

        const query = `
            UPDATE users 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex} AND active = TRUE
            RETURNING id, email, name, bgg_username, ludopedia_username, preferred_platform, created_at, active
        `;

        updateValues.push(userId);

        try {
            const result = await this.client.query(query, updateValues);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Erro ao atualizar usuário:', error);
            throw error;
        }
    }

    /**
     * Salva ou atualiza token OAuth para um usuário
     * @param {number} userId - ID do usuário
     * @param {string} provider - Provedor OAuth (ex: 'ludopedia')
     * @param {string} accessToken - Token de acesso
     * @param {Date} expiresAt - Data de expiração do token
     * @param {string} scope - Escopo do token
     * @returns {Promise<Object>} - Dados do token OAuth
     */
    async saveOAuthToken(userId, provider, accessToken, expiresAt = null, scope = null) {
        const query = `
            INSERT INTO user_oauth_tokens (user_id, provider, access_token, expires_at, scope, updated_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, provider) 
            DO UPDATE SET 
                access_token = EXCLUDED.access_token,
                expires_at = EXCLUDED.expires_at,
                scope = EXCLUDED.scope,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, user_id, provider, expires_at, scope, created_at, updated_at
        `;

        const values = [userId, provider, accessToken, expiresAt, scope];

        try {
            const result = await this.client.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Erro ao salvar token OAuth:', error);
            throw error;
        }
    }

    /**
     * Busca token OAuth do usuário
     * @param {number} userId - ID do usuário
     * @param {string} provider - Provedor OAuth (ex: 'ludopedia')
     * @returns {Promise<Object|null>} - Dados do token OAuth ou null se não encontrado
     */
    async getOAuthToken(userId, provider) {
        const query = `
            SELECT id, user_id, provider, access_token, expires_at, scope, created_at, updated_at
            FROM user_oauth_tokens 
            WHERE user_id = $1 AND provider = $2
        `;

        try {
            const result = await this.client.query(query, [userId, provider]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('❌ Erro ao buscar token OAuth:', error);
            throw error;
        }
    }

    /**
     * Busca dados completos do usuário incluindo tokens OAuth
     * @param {number} userId - ID do usuário
     * @returns {Promise<Object|null>} - Dados completos do usuário
     */
    async getUserWithTokens(userId) {
        const userQuery = `
            SELECT id, email, name, bgg_username, ludopedia_username, 
                   preferred_platform, created_at, active
            FROM users 
            WHERE id = $1 AND active = TRUE
        `;

        const tokensQuery = `
            SELECT provider, access_token, expires_at, scope, updated_at
            FROM user_oauth_tokens 
            WHERE user_id = $1
        `;

        try {
            const [userResult, tokensResult] = await Promise.all([
                this.client.query(userQuery, [userId]),
                this.client.query(tokensQuery, [userId])
            ]);

            const user = userResult.rows[0];
            if (!user) return null;

            // Organizar tokens por provider
            const tokens = {};
            tokensResult.rows.forEach(token => {
                tokens[token.provider] = {
                    access_token: token.access_token,
                    expires_at: token.expires_at,
                    scope: token.scope,
                    updated_at: token.updated_at
                };
            });

            return {
                ...user,
                tokens
            };
        } catch (error) {
            console.error('❌ Erro ao buscar usuário com tokens:', error);
            throw error;
        }
    }

    /**
     * Cria uma sessão de usuário para JWT
     * @param {number} userId - ID do usuário
     * @param {string} jwtId - JWT ID único (jti claim)
     * @param {Date} expiresAt - Data de expiração
     * @param {string} userAgent - User-Agent do navegador
     * @param {string} ipAddress - Endereço IP do usuário
     * @returns {Promise<string>} - UUID da sessão
     */
    async createSession(userId, jwtId, expiresAt, userAgent = null, ipAddress = null) {
        const query = `
            INSERT INTO user_sessions (user_id, jwt_jti, expires_at, user_agent, ip_address)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `;

        try {
            const result = await this.client.query(query, [userId, jwtId, expiresAt, userAgent, ipAddress]);
            return result.rows[0].id;
        } catch (error) {
            console.error('❌ Erro ao criar sessão:', error);
            throw error;
        }
    }

    /**
     * Valida se uma sessão JWT ainda é válida
     * @param {string} jwtId - JWT ID para validação
     * @returns {Promise<Object|null>} - Dados do usuário se sessão válida
     */
    async validateSession(jwtId) {
        const query = `
            UPDATE user_sessions 
            SET last_used = CURRENT_TIMESTAMP
            WHERE jwt_jti = $1 AND expires_at > CURRENT_TIMESTAMP AND revoked = FALSE
            RETURNING user_id
        `;

        try {
            const result = await this.client.query(query, [jwtId]);
            if (result.rows.length === 0) return null;

            const userId = result.rows[0].user_id;
            return await this.getUserById(userId);
        } catch (error) {
            console.error('❌ Erro ao validar sessão:', error);
            throw error;
        }
    }

    /**
     * Revoga uma sessão específica
     * @param {string} jwtId - JWT ID da sessão
     * @returns {Promise<boolean>} - True se sessão foi revogada
     */
    async revokeSession(jwtId) {
        const query = `
            UPDATE user_sessions 
            SET revoked = TRUE
            WHERE jwt_jti = $1
            RETURNING id
        `;

        try {
            const result = await this.client.query(query, [jwtId]);
            return result.rows.length > 0;
        } catch (error) {
            console.error('❌ Erro ao revogar sessão:', error);
            throw error;
        }
    }

    /**
     * Revoga todas as sessões de um usuário (logout global)
     * @param {number} userId - ID do usuário
     * @returns {Promise<number>} - Número de sessões revogadas
     */
    async revokeAllUserSessions(userId) {
        const query = `
            UPDATE user_sessions 
            SET revoked = TRUE
            WHERE user_id = $1 AND revoked = FALSE
            RETURNING id
        `;

        try {
            const result = await this.client.query(query, [userId]);
            return result.rowCount;
        } catch (error) {
            console.error('❌ Erro ao revogar todas as sessões do usuário:', error);
            throw error;
        }
    }

    /**
     * Remove sessões expiradas e revogadas
     * @returns {Promise<number>} - Número de sessões removidas
     */
    async cleanupExpiredSessions() {
        const query = `
            DELETE FROM user_sessions 
            WHERE expires_at < CURRENT_TIMESTAMP OR revoked = TRUE
        `;

        try {
            const result = await this.client.query(query);
            return result.rowCount;
        } catch (error) {
            console.error('❌ Erro ao limpar sessões expiradas:', error);
            throw error;
        }
    }
}

module.exports = UserManager;