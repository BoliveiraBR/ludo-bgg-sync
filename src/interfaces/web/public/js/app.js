// Declaração de variáveis globais
let loadBtn, loadingIndicator, bggList, ludoList, saveBtn;
let bggTotal, bggBase, bggExp, ludoTotal, ludoBase, ludoExp;
let configModal, configBtn, saveConfigBtn, ludoAuthBtn, bggUserInput, ludoTokenInput, ludoUserDisplay;
let isLoading = false;
let currentBGGGames = [];
let currentLudoGames = [];

// Inicializar elementos quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    // Elementos da UI
    loadBtn = document.getElementById('loadBtn');
    saveBtn = document.getElementById('saveBtn');
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
    ludoUserDisplay = document.getElementById('ludoUserDisplay');

    // Configurar event listeners
    configBtn.addEventListener('click', () => {
        loadConfig();
        configModal.show();
    });
    
    saveConfigBtn.addEventListener('click', saveConfig);
    ludoAuthBtn.addEventListener('click', startLudopediaAuth);
    loadBtn.addEventListener('click', loadCollections);
    saveBtn.addEventListener('click', saveCollections);

    // Adicionar listeners para filtros
    document.querySelectorAll('.filter-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const collection = e.target.closest('.filter-link').dataset.collection;
            const filter = e.target.closest('.filter-link').dataset.filter;
            
            // Remove active class from all links in this collection
            document.querySelectorAll(`.filter-link[data-collection="${collection}"]`)
                .forEach(el => el.classList.remove('active'));
            
            // Add active class to clicked link
            e.target.closest('.filter-link').classList.add('active');
            
            // Apply filter
            const games = collection === 'bgg' ? currentBGGGames : currentLudoGames;
            const container = collection === 'bgg' ? bggList : ludoList;
            
            if (filter === 'all') {
                renderGameList(games, container);
            } else {
                const filtered = games.filter(game => 
                    filter === 'base' ? !game.isExpansion : game.isExpansion
                );
                renderGameList(filtered, container);
            }
        });
    });

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
    // Sort games alphabetically by name
    const sortedGames = [...games].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    
    sortedGames.forEach(game => {
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
        
        if (bggUserInput && ludoTokenInput) {
            bggUserInput.value = data.BGG_USER || '';
            ludoTokenInput.value = data.LUDO_ACCESS_TOKEN || '';
            if (data.LUDO_USER && ludoUserDisplay) {
                ludoUserDisplay.textContent = `Usuário: ${data.LUDO_USER}`;
            }
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
                LUDO_ACCESS_TOKEN: ludoTokenInput.value,
                LUDO_USER: ludoUserDisplay.textContent.replace('Usuário: ', '')
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
                if (event.data.user) {
                    ludoUserDisplay.textContent = `Usuário: ${event.data.user}`;
                }
                await saveConfig();
            }
        }, { once: true });
    } catch (error) {
        console.error('Error starting auth:', error);
        alert('Erro ao iniciar autenticação: ' + error.message);
    }
}

// Função para salvar as coleções
async function saveCollections() {
    if (!currentBGGGames.length && !currentLudoGames.length) {
        alert('Nenhuma coleção carregada para salvar');
        return;
    }

    try {
        setLoading(true);
        saveBtn.disabled = true;

        const response = await fetch('/api/save-collections', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bggCollection: currentBGGGames,
                ludoCollection: currentLudoGames
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        alert('Coleções salvas com sucesso!');
    } catch (error) {
        console.error('Error:', error);
        alert('Erro ao salvar coleções: ' + error.message);
    } finally {
        setLoading(false);
        if (currentBGGGames.length || currentLudoGames.length) {
            saveBtn.disabled = false;
        }
    }
}

// Atualizar loadCollections para habilitar o botão de salvar quando carregar via API
async function loadCollections() {
    try {
        setLoading(true);
        saveBtn.disabled = true;
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
        
        // Store the collections
        currentBGGGames = data.bggCollection;
        currentLudoGames = data.ludoCollection;
        
        // Habilitar botão de salvar se carregou via API
        saveBtn.disabled = !(loadType === 'api' && (currentBGGGames.length || currentLudoGames.length));
        
        // Atualizar UI
        updateStats(data.bggCollection, 'bgg');
        updateStats(data.ludoCollection, 'ludo');
        
        // Reset filters to "all" and render full lists
        document.querySelectorAll('.filter-link[data-filter="all"]').forEach(link => {
            link.classList.add('active');
        });
        document.querySelectorAll('.filter-link[data-filter="base"], .filter-link[data-filter="expansion"]').forEach(link => {
            link.classList.remove('active');
        });
        
        renderGameList(data.bggCollection, bggList);
        renderGameList(data.ludoCollection, ludoList);
        
    } catch (error) {
        console.error('Error:', error);
        alert('Erro ao carregar coleções: ' + error.message);
        saveBtn.disabled = true;
    } finally {
        setLoading(false);
    }
}
