const { Client } = require('pg');

class UserManager {
    constructor() {
        this.client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
     * Cria um refresh token para o usuário
     * @param {number} userId - ID do usuário
     * @param {string} tokenHash - Hash do refresh token
     * @param {Date} expiresAt - Data de expiração
     * @returns {Promise<string>} - UUID do refresh token
     */
    async createRefreshToken(userId, tokenHash, expiresAt) {
        const query = `
            INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
            VALUES ($1, $2, $3)
            RETURNING id
        `;

        try {
            const result = await this.client.query(query, [userId, tokenHash, expiresAt]);
            return result.rows[0].id;
        } catch (error) {
            console.error('❌ Erro ao criar refresh token:', error);
            throw error;
        }
    }

    /**
     * Valida e atualiza refresh token
     * @param {string} tokenId - UUID do token
     * @param {string} tokenHash - Hash do token para validação
     * @returns {Promise<Object|null>} - Dados do usuário se token válido
     */
    async validateRefreshToken(tokenId, tokenHash) {
        const query = `
            UPDATE refresh_tokens 
            SET last_used = CURRENT_TIMESTAMP
            WHERE id = $1 AND token_hash = $2 AND expires_at > CURRENT_TIMESTAMP AND revoked = FALSE
            RETURNING user_id
        `;

        try {
            const result = await this.client.query(query, [tokenId, tokenHash]);
            if (result.rows.length === 0) return null;

            const userId = result.rows[0].user_id;
            return await this.getUserById(userId);
        } catch (error) {
            console.error('❌ Erro ao validar refresh token:', error);
            throw error;
        }
    }

    /**
     * Revoga refresh token
     * @param {string} tokenId - UUID do token
     * @returns {Promise<boolean>} - True se token foi revogado
     */
    async revokeRefreshToken(tokenId) {
        const query = `
            UPDATE refresh_tokens 
            SET revoked = TRUE
            WHERE id = $1
            RETURNING id
        `;

        try {
            const result = await this.client.query(query, [tokenId]);
            return result.rows.length > 0;
        } catch (error) {
            console.error('❌ Erro ao revogar refresh token:', error);
            throw error;
        }
    }

    /**
     * Remove refresh tokens expirados
     * @returns {Promise<number>} - Número de tokens removidos
     */
    async cleanupExpiredTokens() {
        const query = `
            DELETE FROM refresh_tokens 
            WHERE expires_at < CURRENT_TIMESTAMP OR revoked = TRUE
        `;

        try {
            const result = await this.client.query(query);
            return result.rowCount;
        } catch (error) {
            console.error('❌ Erro ao limpar tokens expirados:', error);
            throw error;
        }
    }
}

module.exports = UserManager;