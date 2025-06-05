// Elementos da UI
const loadBtn = document.getElementById('loadBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const bggList = document.getElementById('bggList');
const ludoList = document.getElementById('ludoList');

// Estatísticas
const bggTotal = document.getElementById('bggTotal');
const bggBase = document.getElementById('bggBase');
const bggExp = document.getElementById('bggExp');
const ludoTotal = document.getElementById('ludoTotal');
const ludoBase = document.getElementById('ludoBase');
const ludoExp = document.getElementById('ludoExp');

// Estado da aplicação
let isLoading = false;

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

// Configurações
const configModal = new bootstrap.Modal(document.getElementById('configModal'));
const configBtn = document.getElementById('configBtn');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const ludoAuthBtn = document.getElementById('ludoAuthBtn');
const bggUserInput = document.getElementById('bggUser');
const ludoTokenInput = document.getElementById('ludoToken');

// Carregar configurações do servidor
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        bggUserInput.value = data.BGG_USER || '';
        ludoTokenInput.value = data.LUDO_ACCESS_TOKEN || '';
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

// Event listeners
loadBtn.addEventListener('click', async () => {
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
});


// Event listeners para configurações
configBtn.addEventListener('click', () => {
    loadConfig();
    configModal.show();
});

saveConfigBtn.addEventListener('click', saveConfig);
ludoAuthBtn.addEventListener('click', startLudopediaAuth);
