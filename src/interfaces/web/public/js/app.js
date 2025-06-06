// Declaração de variáveis globais
let loadBtn, loadingIndicator, bggList, ludoList, saveBtn;
let bggTotal, bggBase, bggExp, ludoTotal, ludoBase, ludoExp;
let configModal, configBtn, saveConfigBtn, ludoAuthBtn, bggUserInput, ludoTokenInput, ludoUserDisplay;
let selectAllMatches, acceptMatchesBtn, matchesList, compareWithAIBtn, aiMatchesList;
let perfectMatchesCount, onlyBGGCount, onlyLudoCount, previousMatchesCount;
let isLoading = false;
let currentBGGGames = [];
let currentLudoGames = [];
let currentMatches = [];
let currentAIMatches = [];
let selectedMatches = new Set();
let selectedAIMatches = new Set();

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

    // Elementos da aba de pareamento
    selectAllMatches = document.getElementById('selectAllMatches');
    acceptMatchesBtn = document.getElementById('acceptMatchesBtn');
    matchesList = document.getElementById('matchesList');
    perfectMatchesCount = document.getElementById('perfectMatches');
    onlyBGGCount = document.getElementById('onlyBGG');
    onlyLudoCount = document.getElementById('onlyLudo');
    previousMatchesCount = document.getElementById('previousMatches');

    // Elementos da aba de pareamento com AI
    compareWithAIBtn = document.getElementById('compareWithAIBtn');
    aiMatchesList = document.getElementById('aiMatchesList');

    // Configurar event listeners
    configBtn.addEventListener('click', () => {
        loadConfig();
        configModal.show();
    });
    
    saveConfigBtn.addEventListener('click', saveConfig);
    ludoAuthBtn.addEventListener('click', startLudopediaAuth);
    loadBtn.addEventListener('click', loadCollections);
    saveBtn.addEventListener('click', saveCollections);

    // Event listeners para filtros e pareamento
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

    // Funções de Pareamento
    async function handleAcceptMatches() {
        try {
            const selectedPairs = Array.from(selectedMatches).map(index => {
                const match = currentMatches[index];
                // Validate the match object before including it
                if (!match?.bggGame?.id || !match?.ludoGame?.id) {
                    console.warn('Invalid match found:', match);
                    return null;
                }
                return {
                    bggId: match.bggGame.id,
                    ludoId: match.ludoGame.id,
                    bggName: match.bggGame.name,
                    ludoName: match.ludoGame.name
                };
            }).filter(match => match !== null);

            if (selectedPairs.length === 0) {
                alert('Nenhum match válido selecionado');
                return;
            }

            // Enviar para o servidor
            const response = await fetch('/api/accept-matches', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ matches: selectedPairs })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            alert('Matches aceitos com sucesso!');
            // Limpar seleções
            selectedMatches.clear();
            document.getElementById('selectAllMatches').checked = false;
            updateAcceptButtonState();
            
            // Recarregar matches
            findMatches();
        } catch (error) {
            console.error('Error accepting matches:', error);
            alert('Erro ao aceitar matches: ' + error.message);
        }
    }

    // Event listeners do pareamento
    selectAllMatches.addEventListener('change', handleSelectAllMatches);
    acceptMatchesBtn.addEventListener('click', handleAcceptMatches);
    
    // Event listeners do pareamento com AI
    document.getElementById('selectAllAIMatches')?.addEventListener('change', handleSelectAllAIMatches);
    document.getElementById('acceptAIMatchesBtn')?.addEventListener('click', handleAcceptAIMatches);
    
    // Event listener para o botão "Comparar com AI"
    const compareAIBtn = document.getElementById('compareWithAIBtn');
    if (compareAIBtn) {
        console.log('Event listener adicionado ao botão Comparar com AI');
        compareAIBtn.addEventListener('click', findAIMatches);
    } else {
        console.error('Botão compareWithAIBtn não encontrado!');
    }

    // Disparar findMatches quando mudar para a aba de pareamento
    document.getElementById('matching-tab')?.addEventListener('shown.bs.tab', findMatches);

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

        // Procurar matches após carregar as coleções
        if (currentBGGGames.length > 0 && currentLudoGames.length > 0) {
            findMatches();
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Erro ao carregar coleções: ' + error.message);
        saveBtn.disabled = true;
    } finally {
        setLoading(false);
    }
}

// Funções de Pareamento
async function findMatches() {
    console.log('findMatches chamado', { bggGames: currentBGGGames.length, ludoGames: currentLudoGames.length });
    
    if (!currentBGGGames.length || !currentLudoGames.length) {
        alert('Carregue ambas as coleções primeiro');
        return;
    }

    try {
        console.log('Buscando matches no servidor...');
        const response = await fetch('/api/match-collections', {
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

        const data = await response.json();
        console.log('Matches recebidos:', data);
        currentMatches = data.matches || [];
        
        // Atualizar estatísticas
        previousMatchesCount.textContent = data.previousMatchCount;
        perfectMatchesCount.textContent = data.matches.length;
        onlyBGGCount.textContent = data.onlyInBGG.length;
        onlyLudoCount.textContent = data.onlyInLudo.length;

        // Limpar seleções anteriores
        selectedMatches.clear();
        selectAllMatches.checked = false;
        acceptMatchesBtn.disabled = true;

        // Renderizar matches
        renderMatches();
    } catch (error) {
        console.error('Error finding matches:', error);
        alert('Erro ao buscar matches: ' + error.message);
    }
}

function renderMatches() {
    matchesList.innerHTML = '';
    currentMatches.forEach((match, index) => {
        // Skip invalid matches
        if (!match || !match.bggGame || !match.ludoGame) {
            console.warn('Invalid match found:', match);
            return;
        }

        const div = document.createElement('div');
        div.className = 'match-item' + (match.exactMatch ? ' perfect-match' : '');
        
        // Use optional chaining and nullish coalescing to safely access properties
        const bggName = match.bggGame?.name ?? 'Unknown BGG Game';
        const ludoName = match.ludoGame?.name ?? 'Unknown Ludo Game';
        
        div.innerHTML = `
            <div class="form-check">
                <input class="form-check-input match-checkbox" type="checkbox" 
                       data-index="${index}" id="match${index}">
            </div>
            <div class="match-names">
                <span class="bgg-name">${bggName}</span>
                <i class="bi bi-arrow-left-right match-arrow"></i>
                <span class="ludo-name">${ludoName}</span>
            </div>
        `;
        matchesList.appendChild(div);

        // Adicionar event listener para o checkbox
        const checkbox = div.querySelector('.match-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedMatches.add(index);
            } else {
                selectedMatches.delete(index);
            }
            updateAcceptButtonState();
        });
    });
}

// Funções de Pareamento com AI
async function findAIMatches() {
    console.log('🤖 findAIMatches foi chamada!');
    
    if (!currentBGGGames.length || !currentLudoGames.length) {
        alert('Carregue ambas as coleções primeiro');
        return;
    }

    const aiLoadingIndicator = document.getElementById('aiLoadingIndicator');
    const compareWithAIBtn = document.getElementById('compareWithAIBtn');
    const aiMatchesListContainer = document.getElementById('aiMatchesList');
    const aiStatusMessage = document.getElementById('aiStatusMessage');
    
    try {
        // Mostrar indicador de loading e desabilitar o botão
        aiLoadingIndicator.style.display = 'block';
        compareWithAIBtn.disabled = true;
        
        // Mostrar mensagem de status inicial
        aiStatusMessage.textContent = 'Iniciando análise com ChatGPT...';
        aiStatusMessage.style.display = 'block';
        
        aiStatusMessage.textContent = 'Preparando dados para análise...';
        const response = await fetch('/api/match-collections-ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bggCollection: currentBGGGames,
                ludoCollection: currentLudoGames
            })
        });

        let data;
        try {
            aiStatusMessage.textContent = 'Processando resposta...';
            data = await response.json();
        } catch (parseError) {
            throw new Error('Erro ao processar resposta do servidor');
        }

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        
        if (data.message) {
            aiMatchesListContainer.innerHTML = `<div class="alert alert-info">${data.message}</div>`;
            return;
        }
        
        currentAIMatches = data.matches || [];
        
        // Limpar seleções anteriores
        selectedAIMatches.clear();
        aiMatchesList.innerHTML = '';

        // Renderizar matches com AI
        renderAIMatches();
    } catch (error) {
        console.error('Error finding AI matches:', error);
        const errorMessage = error.message || 'Erro desconhecido';
        aiMatchesListContainer.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i>
                Erro ao buscar matches com AI: ${errorMessage}
            </div>`;
    } finally {
        // Esconder indicador de loading e reabilitar o botão
        aiLoadingIndicator.style.display = 'none';
        aiStatusMessage.style.display = 'none';
        compareWithAIBtn.disabled = false;
    }
}

function renderAIMatches() {
    if (currentAIMatches.length === 0) {
        aiMatchesList.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i>
                Nenhum match encontrado pela AI.
            </div>`;
        return;
    }

    aiMatchesList.innerHTML = `
        <div class="alert alert-info mb-3">
            <i class="bi bi-robot"></i>
            ${currentAIMatches.length} possíveis matches encontrados pela AI.
        </div>`;
    
    currentAIMatches.forEach((match, index) => {
        // Skip invalid matches
        if (!match || !match.bggGame || !match.ludoGame) {
            console.warn('Invalid AI match found:', match);
            return;
        }

        const div = document.createElement('div');
        div.className = 'match-item' + (match.exactMatch ? ' perfect-match' : '');
        
        // Use optional chaining and nullish coalescing to safely access properties
        const bggName = match.bggGame?.name ?? 'Unknown BGG Game';
        const ludoName = match.ludoGame?.name ?? 'Unknown Ludo Game';
        
        div.innerHTML = `
            <div class="form-check">
                <input class="form-check-input ai-match-checkbox" type="checkbox" 
                       data-index="${index}" id="aimatch${index}">
            </div>
            <div class="match-names">
                <span class="bgg-name">${bggName}</span>
                <i class="bi bi-arrow-left-right match-arrow"></i>
                <span class="ludo-name">${ludoName}</span>
            </div>
        `;
        aiMatchesList.appendChild(div);

        // Adicionar event listener para o checkbox
        const checkbox = div.querySelector('.ai-match-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedAIMatches.add(index);
            } else {
                selectedAIMatches.delete(index);
            }
            updateAIAcceptButtonState();
        });
    });
}

function handleSelectAllAIMatches(e) {
    const checkboxes = document.querySelectorAll('.ai-match-checkbox');
    checkboxes.forEach((checkbox, index) => {
        checkbox.checked = e.target.checked;
        if (e.target.checked) {
            selectedAIMatches.add(index);
        } else {
            selectedAIMatches.delete(index);
        }
    });
    updateAIAcceptButtonState();
}

// Função para aceitar matches de AI selecionados
async function handleAcceptAIMatches() {
    try {
        const selectedPairs = Array.from(selectedAIMatches).map(index => {
            const match = currentAIMatches[index];
            // Validate the match object before including it
            if (!match?.bggGame?.id || !match?.ludoGame?.id) {
                console.warn('Invalid AI match found:', match);
                return null;
            }
            return {
                bggId: match.bggGame.id,
                ludoId: match.ludoGame.id,
                bggName: match.bggGame.name,
                ludoName: match.ludoGame.name,
                confidence: match.confidence,
                reasoning: match.reasoning
            };
        }).filter(match => match !== null);

        if (selectedPairs.length === 0) {
            alert('Nenhum match de AI válido selecionado');
            return;
        }

        // Enviar para o servidor
        const response = await fetch('/api/accept-matches', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ matches: selectedPairs })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        alert('Matches de AI aceitos com sucesso!');
        // Limpar seleções
        selectedAIMatches.clear();
        document.getElementById('selectAllAIMatches').checked = false;
        updateAIAcceptButtonState();
        
        // Recarregar matches
        findMatches();
    } catch (error) {
        console.error('Error accepting AI matches:', error);
        alert('Erro ao aceitar matches de AI: ' + error.message);
    }
}

// Funções de controle
function handleSelectAllMatches(e) {
    const checkboxes = document.querySelectorAll('.match-checkbox');
    checkboxes.forEach((checkbox, index) => {
        checkbox.checked = e.target.checked;
        if (e.target.checked) {
            selectedMatches.add(index);
        } else {
            selectedMatches.delete(index);
        }
    });
    updateAcceptButtonState();
}

// Funções de controle de estado dos botões
function updateAcceptButtonState() {
    const acceptMatchesBtn = document.getElementById('acceptMatchesBtn');
    if (acceptMatchesBtn) {
        acceptMatchesBtn.disabled = selectedMatches.size === 0;
    }
}

function updateAIAcceptButtonState() {
    const acceptAIMatchesBtn = document.getElementById('acceptAIMatchesBtn');
    if (acceptAIMatchesBtn) {
        acceptAIMatchesBtn.disabled = selectedAIMatches.size === 0;
    }
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

        // Procurar matches após carregar as coleções
        if (currentBGGGames.length > 0 && currentLudoGames.length > 0) {
            findMatches();
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Erro ao carregar coleções: ' + error.message);
        saveBtn.disabled = true;
    } finally {
        setLoading(false);
    }
}

// Funções de Pareamento
async function findMatches() {
    console.log('findMatches chamado', { bggGames: currentBGGGames.length, ludoGames: currentLudoGames.length });
    
    if (!currentBGGGames.length || !currentLudoGames.length) {
        alert('Carregue ambas as coleções primeiro');
        return;
    }

    try {
        console.log('Buscando matches no servidor...');
        const response = await fetch('/api/match-collections', {
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

        const data = await response.json();
        console.log('Matches recebidos:', data);
        currentMatches = data.matches || [];
        
        // Atualizar estatísticas
        previousMatchesCount.textContent = data.previousMatchCount;
        perfectMatchesCount.textContent = data.matches.length;
        onlyBGGCount.textContent = data.onlyInBGG.length;
        onlyLudoCount.textContent = data.onlyInLudo.length;

        // Limpar seleções anteriores
        selectedMatches.clear();
        selectAllMatches.checked = false;
        acceptMatchesBtn.disabled = true;

        // Renderizar matches
        renderMatches();
    } catch (error) {
        console.error('Error finding matches:', error);
        alert('Erro ao buscar matches: ' + error.message);
    }
}

function renderMatches() {
    matchesList.innerHTML = '';
    currentMatches.forEach((match, index) => {
        // Skip invalid matches
        if (!match || !match.bggGame || !match.ludoGame) {
            console.warn('Invalid match found:', match);
            return;
        }

        const div = document.createElement('div');
        div.className = 'match-item' + (match.exactMatch ? ' perfect-match' : '');
        
        // Use optional chaining and nullish coalescing to safely access properties
        const bggName = match.bggGame?.name ?? 'Unknown BGG Game';
        const ludoName = match.ludoGame?.name ?? 'Unknown Ludo Game';
        
        div.innerHTML = `
            <div class="form-check">
                <input class="form-check-input match-checkbox" type="checkbox" 
                       data-index="${index}" id="match${index}">
            </div>
            <div class="match-names">
                <span class="bgg-name">${bggName}</span>
                <i class="bi bi-arrow-left-right match-arrow"></i>
                <span class="ludo-name">${ludoName}</span>
            </div>
        `;
        matchesList.appendChild(div);

        // Adicionar event listener para o checkbox
        const checkbox = div.querySelector('.match-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedMatches.add(index);
            } else {
                selectedMatches.delete(index);
            }
            updateAcceptButtonState();
        });
    });
}

