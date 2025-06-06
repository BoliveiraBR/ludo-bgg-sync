// Declaração de variáveis globais
let loadBtn, loadingIndicator, bggList, ludoList;
let bggTotal, bggBase, bggExp, ludoTotal, ludoBase, ludoExp;
let configModal, configBtn, saveConfigBtn, ludoAuthBtn, bggUserInput, ludoTokenInput;
let isLoading = false;

// Inicializar elementos quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    // Elementos da UI
    loadBtn = document.getElementById('loadBtn');
    loadingIndicator = document.getElementById('loadingIndicator');
    bggList = document.getElementById('bggList');
    ludoList = document.getElementById('ludoList');

    // Estatísticas
    bggTotal = document.getElementById('bggTotal');
    bggBase = document.getElementById('bggBase');
    bggExp = document.getElementById('bggExp');
    ludoTotal = document.getElementById('ludoTotal');
    ludoBase = document.getElementById('ludoBase');
    ludoExp = document.getElementById('ludoExp');

    // Elementos do modal de configuração
    configModal = new bootstrap.Modal(document.getElementById('configModal'));
    configBtn = document.getElementById('configBtn');
    saveConfigBtn = document.getElementById('saveConfigBtn');
    ludoAuthBtn = document.getElementById('ludoAuthBtn');
    bggUserInput = document.getElementById('bggUser');
    ludoTokenInput = document.getElementById('ludoToken');

    // Configurar event listeners
    configBtn.addEventListener('click', () => {
        loadConfig();
        configModal.show();
    });
    
    saveConfigBtn.addEventListener('click', saveConfig);
    ludoAuthBtn.addEventListener('click', startLudopediaAuth);
    loadBtn.addEventListener('click', loadCollections);

    // Carregar configurações iniciais
    loadConfig();
});

// Funções auxiliares
function setLoading(loading) {
    isLoading = loading;
    loadBtn.disabled = loading;
    loadingIndicator.style.display = loading ? 'block' : 'none';
}

function updateStats(collection, type) {
    const baseGames = collection.filter(game => !game.isExpansion);
    const expansions = collection.filter(game => game.isExpansion);
    
    if (type === 'bgg') {
        bggTotal.textContent = collection.length;
        bggBase.textContent = baseGames.length;
        bggExp.textContent = expansions.length;
    } else {
        ludoTotal.textContent = collection.length;
        ludoBase.textContent = baseGames.length;
        ludoExp.textContent = expansions.length;
    }
}

function renderGameList(games, container) {
    container.innerHTML = '';
    games.forEach(game => {
        const div = document.createElement('div');
        div.className = `game-item ${game.isExpansion ? 'expansion' : ''}`;
        div.innerHTML = `
            ${game.name}
            <span class="game-type-badge ${game.isExpansion ? 'badge-expansion' : 'badge-base'}">
                ${game.isExpansion ? 'Expansão' : 'Base'}
            </span>
        `;
        container.appendChild(div);
    });
}

// Carregar configurações do servidor
async function loadConfig() {
    try {
        console.log('Carregando configurações...');
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Dados recebidos:', data);
        
        console.log('Elementos do form:', {
            bggUserInput: bggUserInput?.id,
            ludoTokenInput: ludoTokenInput?.id
        });
        
        if (bggUserInput && ludoTokenInput) {
            bggUserInput.value = data.BGG_USER || '';
            ludoTokenInput.value = data.LUDO_ACCESS_TOKEN || '';
            console.log('Configurações aplicadas aos campos');
        } else {
            console.error('Elementos do form não encontrados');
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// Salvar configurações no servidor
async function saveConfig() {
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                BGG_USER: bggUserInput.value,
                LUDO_ACCESS_TOKEN: ludoTokenInput.value
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        configModal.hide();
    } catch (error) {
        console.error('Error saving config:', error);
        alert('Erro ao salvar configurações: ' + error.message);
    }
}

// Iniciar autenticação Ludopedia
async function startLudopediaAuth() {
    try {
        const response = await fetch('/api/auth/ludopedia');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const { authUrl } = await response.json();
        const authWindow = window.open(authUrl, 'LudopediaAuth', 'width=600,height=600');

        // Receber mensagem de sucesso da autenticação
        window.addEventListener('message', async (event) => {
            if (event.data.type === 'AUTH_SUCCESS') {
                authWindow.close();
                ludoTokenInput.value = event.data.token;
                await saveConfig();
            }
        }, { once: true });
    } catch (error) {
        console.error('Error starting auth:', error);
        alert('Erro ao iniciar autenticação: ' + error.message);
    }
}

// Carregar coleções
async function loadCollections() {
    try {
        setLoading(true);
        const loadType = document.querySelector('input[name="loadType"]:checked').value;
        
        const response = await fetch('/api/collections', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ loadType })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Atualizar UI
        updateStats(data.bggCollection, 'bgg');
        updateStats(data.ludoCollection, 'ludo');
        
        renderGameList(data.bggCollection, bggList);
        renderGameList(data.ludoCollection, ludoList);
        
    } catch (error) {
        console.error('Error:', error);
        alert('Erro ao carregar coleções: ' + error.message);
    } finally {
        setLoading(false);
    }
}
