// Sistema de autenticação JWT para o frontend

class AuthManager {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.user = null;
        
        // Carregar dados do usuário se há token
        if (this.token) {
            const userData = localStorage.getItem('user');
            if (userData) {
                try {
                    this.user = JSON.parse(userData);
                } catch (error) {
                    console.error('Erro ao carregar dados do usuário:', error);
                    this.clearAuth();
                }
            }
        }
    }

    // Verifica se usuário está autenticado
    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    // Obtém token para requisições
    getAuthHeader() {
        return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
    }

    // Obtém dados do usuário atual
    getCurrentUser() {
        return this.user;
    }

    // Salva dados de autenticação
    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
    }

    // Remove dados de autenticação
    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
    }

    // Faz logout
    async logout() {
        if (!this.token) return;

        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeader()
                }
            });
        } catch (error) {
            console.error('Erro no logout:', error);
        }

        this.clearAuth();
        window.location.href = '/';
    }

    // Faz logout global (todas as sessões)
    async logoutAll() {
        if (!this.token) return;

        try {
            const response = await fetch('/api/logout-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeader()
                }
            });

            if (response.ok) {
                const result = await response.json();
                alert(`Logout realizado em ${result.revokedSessions} dispositivos`);
            }
        } catch (error) {
            console.error('Erro no logout global:', error);
        }

        this.clearAuth();
        window.location.href = '/';
    }

    // Valida token atual com o servidor
    async validateToken() {
        if (!this.token) return false;

        try {
            const response = await fetch('/api/me', {
                headers: this.getAuthHeader()
            });

            if (response.ok) {
                const result = await response.json();
                // Atualizar dados do usuário se necessário
                if (JSON.stringify(result.user) !== JSON.stringify(this.user)) {
                    this.user = result.user;
                    localStorage.setItem('user', JSON.stringify(result.user));
                }
                return true;
            } else {
                // Token inválido
                this.clearAuth();
                return false;
            }
        } catch (error) {
            console.error('Erro ao validar token:', error);
            return false;
        }
    }

    // Faz requisição autenticada
    async authenticatedFetch(url, options = {}) {
        if (!this.token) {
            throw new Error('Usuário não autenticado');
        }

        const authOptions = {
            ...options,
            headers: {
                ...options.headers,
                ...this.getAuthHeader()
            }
        };

        const response = await fetch(url, authOptions);

        // Se token expirou ou é inválido
        if (response.status === 401 || response.status === 403) {
            this.clearAuth();
            window.location.href = '/login';
            throw new Error('Sessão expirada. Faça login novamente.');
        }

        return response;
    }

    // Atualiza informações do usuário na interface
    updateUserInterface() {
        if (!this.isAuthenticated()) return;

        // Mostrar nome do usuário na navbar
        const userElements = document.querySelectorAll('.user-name');
        userElements.forEach(el => {
            el.textContent = this.user.name;
        });

        // Mostrar email do usuário
        const emailElements = document.querySelectorAll('.user-email');
        emailElements.forEach(el => {
            el.textContent = this.user.email;
        });

        // Adicionar botão de logout se não existir
        this.addLogoutButton();
    }

    // Adiciona botão de logout à navbar
    addLogoutButton() {
        const navbar = document.querySelector('.navbar .container');
        if (!navbar || document.getElementById('logoutBtn')) return;

        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logoutBtn';
        logoutBtn.className = 'btn btn-link text-white ms-2';
        logoutBtn.title = 'Logout';
        logoutBtn.innerHTML = '<i class="bi bi-box-arrow-right"></i>';
        logoutBtn.addEventListener('click', () => this.logout());

        // Inserir antes do botão de configurações
        const configBtn = document.getElementById('configBtn');
        if (configBtn) {
            navbar.insertBefore(logoutBtn, configBtn);
        } else {
            navbar.appendChild(logoutBtn);
        }
    }
}

// Instância global do gerenciador de autenticação
window.authManager = new AuthManager();

// Verificar autenticação na inicialização
document.addEventListener('DOMContentLoaded', async () => {
    if (window.authManager.isAuthenticated()) {
        // Validar token e atualizar interface
        const isValid = await window.authManager.validateToken();
        if (isValid) {
            window.authManager.updateUserInterface();
        }
    } else {
        // Se não está autenticado e está numa página que precisa de auth, redirecionar
        if (window.location.pathname === '/' && !document.querySelector('.hero-section')) {
            window.location.href = '/';
        }
    }
});