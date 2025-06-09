// Declaração de variáveis globais
let loadBtn, loadingIndicator, successMessage, bggList, ludoList, saveBtn;
let bggTotal, bggBase, bggExp, ludoTotal, ludoBase, ludoExp;
let maxTotal, maxBase, maxExpansions; // Estatísticas da coleção
let configModal, configBtn, saveConfigBtn, ludoAuthBtn, bggUserInput, ludoTokenInput, ludoUserDisplay;
let selectAllMatches, acceptMatchesBtn, matchesList, compareWithAIBtn, aiMatchesList;
let perfectMatchesCount, onlyBGGCount, onlyLudoCount, previousMatchesCount;
let manualBggList, manualLudoList, manualBggCount, manualLudoCount, acceptManualMatchBtn;
let isLoading = false;
let currentBGGGames = [];
let currentLudoGames = [];
let currentMatches = [];
let currentAIMatches = [];
let selectedMatches = new Set();
let selectedAIMatches = new Set();
let selectedManualBggGame = null;
let selectedManualLudoGame = null;

// Inicializar elementos quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    // Elementos da UI
    loadBtn = document.getElementById('loadBtn');
    saveBtn = document.getElementById('saveBtn');
    loadingIndicator = document.getElementById('loadingIndicator');
    successMessage = document.getElementById('successMessage');
    bggList = document.getElementById('bggList');
    ludoList = document.getElementById('ludoList');

    // Estatísticas
    bggTotal = document.getElementById('bggTotal');
    bggBase = document.getElementById('bggBase');
    bggExp = document.getElementById('bggExp');
    ludoTotal = document.getElementById('ludoTotal');
    ludoBase = document.getElementById('ludoBase');
    ludoExp = document.getElementById('ludoExp');

    // Estatísticas da coleção (maior valor)
    maxTotal = document.getElementById('maxTotal');
    maxBase = document.getElementById('maxBase');
    maxExpansions = document.getElementById('maxExpansions');

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

    // Elementos da seção Manual Matching
    manualBggList = document.getElementById('manualBggList');
    manualLudoList = document.getElementById('manualLudoList');
    manualBggCount = document.getElementById('manualBggCount');
    manualLudoCount = document.getElementById('manualLudoCount');
    acceptManualMatchBtn = document.getElementById('acceptManualMatchBtn');

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
            
            const linkElement = e.target.closest('.filter-link');
            
            // Verificar se o link está desabilitado
            if (linkElement.classList.contains('disabled')) {
                return;
            }
            
            const collection = linkElement.dataset.collection;
            const filter = linkElement.dataset.filter;
            
            // Remove active class from all links in this collection
            document.querySelectorAll(`.filter-link[data-collection="${collection}"]`)
                .forEach(el => el.classList.remove('active'));
            
            // Add active class to clicked link
            linkElement.classList.add('active');
            
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

    // Event listeners para os quadros de estatísticas
    document.querySelectorAll('.stat-card[data-stat-filter]').forEach(statCard => {
        statCard.addEventListener('click', (e) => {
            // Verificar se há dados carregados
            if (!currentBGGGames.length && !currentLudoGames.length) {
                return;
            }
            
            const filter = e.currentTarget.dataset.statFilter;
            
            // Aplicar filtro em ambas as coleções
            applyFilterToBothCollections(filter);
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
    
    // Event listeners do pareamento manual
    acceptManualMatchBtn?.addEventListener('click', handleAcceptManualMatch);
    
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

    // Inicializar estado dos filtros na carga da página
    updateFilterLinksState();

    // Carregar coleções automaticamente via API ao inicializar a página
    loadCollections();
});

// Função para gerenciar estado dos links de filtro
function updateFilterLinksState() {
    const bggHasData = currentBGGGames && currentBGGGames.length > 0;
    const ludoHasData = currentLudoGames && currentLudoGames.length > 0;
    
    // Atualizar links BGG
    const bggLinks = document.querySelectorAll('.filter-link[data-collection="bgg"]');
    bggLinks.forEach(link => {
        if (bggHasData) {
            link.classList.remove('disabled');
        } else {
            link.classList.add('disabled');
        }
    });
    
    // Atualizar links Ludopedia
    const ludoLinks = document.querySelectorAll('.filter-link[data-collection="ludo"]');
    ludoLinks.forEach(link => {
        if (ludoHasData) {
            link.classList.remove('disabled');
        } else {
            link.classList.add('disabled');
        }
    });
}

// Função para aplicar filtro em ambas as coleções simultaneamente
function applyFilterToBothCollections(filter) {
    // Remover classe active de todos os links de filtro
    document.querySelectorAll('.filter-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Adicionar classe active aos links correspondentes
    document.querySelectorAll(`.filter-link[data-filter="${filter}"]`).forEach(link => {
        link.classList.add('active');
    });
    
    // Aplicar filtro na coleção BGG
    if (currentBGGGames.length > 0) {
        let bggFiltered;
        if (filter === 'all') {
            bggFiltered = currentBGGGames;
        } else {
            bggFiltered = currentBGGGames.filter(game => 
                filter === 'base' ? !game.isExpansion : game.isExpansion
            );
        }
        renderGameList(bggFiltered, bggList);
    }
    
    // Aplicar filtro na coleção Ludopedia
    if (currentLudoGames.length > 0) {
        let ludoFiltered;
        if (filter === 'all') {
            ludoFiltered = currentLudoGames;
        } else {
            ludoFiltered = currentLudoGames.filter(game => 
                filter === 'base' ? !game.isExpansion : game.isExpansion
            );
        }
        renderGameList(ludoFiltered, ludoList);
    }
}

// Funções auxiliares
function setLoading(loading) {
    isLoading = loading;
    loadBtn.disabled = loading;
    loadingIndicator.style.display = loading ? 'block' : 'none';
    
    // Hide success message when loading starts
    if (loading && successMessage) {
        successMessage.style.display = 'none';
    }
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

    // Atualizar estatísticas da coleção (maior valor)
    updateCollectionStats();
}

function updateCollectionStats() {
    // Obter valores atuais
    const bggTotalVal = parseInt(bggTotal.textContent) || 0;
    const bggBaseVal = parseInt(bggBase.textContent) || 0;
    const bggExpVal = parseInt(bggExp.textContent) || 0;
    
    const ludoTotalVal = parseInt(ludoTotal.textContent) || 0;
    const ludoBaseVal = parseInt(ludoBase.textContent) || 0;
    const ludoExpVal = parseInt(ludoExp.textContent) || 0;

    // Calcular o maior valor para cada métrica
    maxTotal.textContent = Math.max(bggTotalVal, ludoTotalVal);
    maxBase.textContent = Math.max(bggBaseVal, ludoBaseVal);
    maxExpansions.textContent = Math.max(bggExpVal, ludoExpVal);
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

// Atualizar loadCollections para sempre carregar via API
async function loadCollections() {
    try {
        setLoading(true);
        saveBtn.disabled = true;
        
        const response = await fetch('/api/collections', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ loadType: 'api' })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Store the collections
        currentBGGGames = data.bggCollection;
        currentLudoGames = data.ludoCollection;
        
        // Habilitar botão de salvar se há coleções carregadas
        saveBtn.disabled = !(currentBGGGames.length || currentLudoGames.length);
        
        // Atualizar UI
        updateStats(data.bggCollection, 'bgg');
        updateStats(data.ludoCollection, 'ludo');
        
        // Atualizar estado dos links de filtro
        updateFilterLinksState();
        
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
        
        // Show success message after successful load
        if (successMessage) {
            successMessage.style.display = 'block';
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
        
        // Renderizar listas manuais
        renderManualLists(data.onlyInBGG, data.onlyInLudo);
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
        //aiStatusMessage.textContent = 'Aguardando análise do ChatGPT...';
        aiStatusMessage.style.display = 'block';
        
        //aiStatusMessage.textContent = 'Preparando dados para análise...';
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

    // Ordenar matches alfabeticamente pelo nome do jogo BGG
    const sortedMatches = [...currentAIMatches]
        .map((match, originalIndex) => ({ ...match, originalIndex }))
        .sort((a, b) => {
            const nameA = a.bgg?.name?.toLowerCase() ?? '';
            const nameB = b.bgg?.name?.toLowerCase() ?? '';
            return nameA.localeCompare(nameB, 'pt-BR');
        });

    aiMatchesList.innerHTML = `
        <div class="alert alert-info mb-3">
            <i class="bi bi-robot"></i>
            ${currentAIMatches.length} possíveis matches encontrados pela AI.
        </div>`;
    
    sortedMatches.forEach((match, displayIndex) => {
        // Skip invalid matches
        if (!match || !match.bgg || !match.ludopedia) {
            console.warn('Invalid AI match found:', match);
            return;
        }

        const div = document.createElement('div');
        div.className = 'match-item' + (match.exactMatch ? ' perfect-match' : '');
        
        // Use the correct property names: bgg and ludopedia
        const bggName = match.bgg?.name ?? 'Unknown BGG Game';
        const ludoName = match.ludopedia?.name ?? 'Unknown Ludo Game';
        
        // Use original index for selection tracking
        const originalIndex = match.originalIndex;
        
        div.innerHTML = `
            <div class="form-check">
                <input class="form-check-input ai-match-checkbox" type="checkbox" 
                       data-index="${originalIndex}" id="aimatch${originalIndex}">
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
                selectedAIMatches.add(originalIndex);
            } else {
                selectedAIMatches.delete(originalIndex);
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
            // Validate the match object before including it - use correct property names
            if (!match?.bgg?.id || !match?.ludopedia?.id) {
                console.warn('Invalid AI match found:', match);
                return null;
            }
            return {
                bggId: match.bgg.id,
                ludoId: match.ludopedia.id,
                bggName: match.bgg.name,
                ludoName: match.ludopedia.name,
                confidence: match.confidence,
                reasoning: match.reasoning
            };
        }).filter(match => match !== null);

        if (selectedPairs.length === 0) {
            alert('Nenhum match de AI válido selecionado');
            return;
        }

        // Enviar para o servidor
        const response = await fetch('/api/save-matches-ai', {
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
        
        // Remover os matches aceitos da lista atual
        const selectedIndices = Array.from(selectedAIMatches).sort((a, b) => b - a); // Ordem decrescente para não afetar os índices
        selectedIndices.forEach(index => {
            currentAIMatches.splice(index, 1);
        });
        
        // Limpar seleções
        selectedAIMatches.clear();
        document.getElementById('selectAllAIMatches').checked = false;
        updateAIAcceptButtonState();
        
        // Renderizar novamente a lista de matches da AI (sem os aceitos)
        renderAIMatches();
        
        // Recarregar matches regulares para atualizar estatísticas
        findMatches();
    } catch (error) {
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

// Funções de Manual Matching
function renderManualLists(onlyBGGGames, onlyLudoGames) {
    // Criar listas combinadas: jogos únicos + jogos de matches pendentes
    const combinedBggGames = [...onlyBGGGames];
    const combinedLudoGames = [...onlyLudoGames];
    
    // Adicionar jogos dos matches pendentes que ainda não foram aceitos
    if (currentMatches && currentMatches.length > 0) {
        currentMatches.forEach(match => {
            if (match.bggGame && match.ludoGame) {
                // Verificar se o jogo BGG já não está na lista
                if (!combinedBggGames.find(game => game.id === match.bggGame.id)) {
                    combinedBggGames.push(match.bggGame);
                }
                // Verificar se o jogo Ludopedia já não está na lista
                if (!combinedLudoGames.find(game => game.id === match.ludoGame.id)) {
                    combinedLudoGames.push(match.ludoGame);
                }
            }
        });
    }
    
    // Renderizar lista BGG
    renderManualGameList(combinedBggGames, manualBggList, 'bgg');
    manualBggCount.textContent = combinedBggGames.length;
    
    // Renderizar lista Ludopedia
    renderManualGameList(combinedLudoGames, manualLudoList, 'ludo');
    manualLudoCount.textContent = combinedLudoGames.length;
    
    // Reset selections
    selectedManualBggGame = null;
    selectedManualLudoGame = null;
    updateManualAcceptButtonState();
}

function renderManualGameList(games, container, type) {
    container.innerHTML = '';
    
    if (games.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info m-2">
                <i class="bi bi-info-circle"></i>
                Nenhum jogo encontrado apenas nesta coleção.
            </div>`;
        return;
    }
    
    // Ordenar jogos alfabeticamente por nome
    const sortedGames = [...games].sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'pt-BR')
    );
    
    sortedGames.forEach((game, index) => {
        const div = document.createElement('div');
        div.className = 'manual-game-item';
        
        const radioId = `manual-${type}-${index}`;
        div.innerHTML = `
            <div class="d-flex align-items-center">
                <input class="form-check-input manual-game-radio" type="radio" 
                       name="manual-${type}" value="${index}" id="${radioId}">
                <label class="form-check-label flex-grow-1" for="${radioId}">
                    ${game.name}
                    ${game.isExpansion ? '<span class="game-type-badge badge-expansion">Expansão</span>' : ''}
                </label>
            </div>
        `;
        
        container.appendChild(div);
        
        // Event listener para seleção
        const radio = div.querySelector('.manual-game-radio');
        radio.addEventListener('change', () => {
            if (type === 'bgg') {
                selectedManualBggGame = game;
                // Remove visual selection from all items
                container.querySelectorAll('.manual-game-item').forEach(item => item.classList.remove('selected'));
                div.classList.add('selected');
            } else {
                selectedManualLudoGame = game;
                // Remove visual selection from all items
                container.querySelectorAll('.manual-game-item').forEach(item => item.classList.remove('selected'));
                div.classList.add('selected');
            }
            updateManualAcceptButtonState();
        });
        
        // Event listener para click no item
        div.addEventListener('click', (e) => {
            if (e.target.type !== 'radio') {
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            }
        });
    });
}

function updateManualAcceptButtonState() {
    if (acceptManualMatchBtn) {
        acceptManualMatchBtn.disabled = !selectedManualBggGame || !selectedManualLudoGame;
    }
}

async function handleAcceptManualMatch() {
    if (!selectedManualBggGame || !selectedManualLudoGame) {
        alert('Selecione um jogo de cada lista');
        return;
    }
    
    try {
        const manualMatch = {
            bggId: selectedManualBggGame.id,
            ludoId: selectedManualLudoGame.id,
            bggName: selectedManualBggGame.name,
            ludoName: selectedManualLudoGame.name,
            confidence: 'manual',
            reasoning: 'Match manual criado pelo usuário'
        };
        
        const response = await fetch('/api/save-manual-match', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ match: manualMatch })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        alert('Match manual criado com sucesso!');
        
        // Reset selections
        selectedManualBggGame = null;
        selectedManualLudoGame = null;
        
        // Clear radio selections
        document.querySelectorAll('input[name="manual-bgg"]').forEach(radio => radio.checked = false);
        document.querySelectorAll('input[name="manual-ludo"]').forEach(radio => radio.checked = false);
        
        // Remove visual selections
        manualBggList.querySelectorAll('.manual-game-item').forEach(item => item.classList.remove('selected'));
        manualLudoList.querySelectorAll('.manual-game-item').forEach(item => item.classList.remove('selected'));
        
        updateManualAcceptButtonState();
        
        // Recarregar matches para atualizar estatísticas e listas
        findMatches();
        
    } catch (error) {
        console.error('Error creating manual match:', error);
        alert('Erro ao criar match manual: ' + error.message);
    }
}

