// Declaração de variáveis globais
let loadBtn, loadingIndicator, bggList, ludoList;
let bggTotal, bggBase, bggExp, ludoTotal, ludoBase, ludoExp;
let maxTotal, maxBase, maxExpansions; // Estatísticas da coleção
let loadSummary, changeLegend; // Elementos da aba de atualização
let configModal, configBtn, loginModal, logoutBtn, loginLink;
let selectAllMatches, acceptMatchesBtn, matchesList, compareWithAIBtn, aiMatchesList;
let perfectMatchesCount, onlyBGGCount, onlyLudoCount, previousMatchesCount;
let manualBggList, manualLudoList, manualBggCount, manualLudoCount, acceptManualMatchBtn;
let manualBggTotal, manualBggBase, manualBggExp, manualLudoTotal, manualLudoBase, manualLudoExp;
let isLoading = false;
let currentBGGGames = [];
let currentLudoGames = [];
let currentMatches = [];
let currentAIMatches = [];
let selectedMatches = new Set();
let selectedAIMatches = new Set();
let selectedManualBggGame = null;
let selectedManualLudoGame = null;
let currentManualBggGames = [];
let currentManualLudoGames = [];

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

    // Estatísticas da coleção (maior valor)
    maxTotal = document.getElementById('maxTotal');
    maxBase = document.getElementById('maxBase');
    maxExpansions = document.getElementById('maxExpansions');

    // Elementos da aba de atualização
    loadSummary = document.getElementById('loadSummary');
    changeLegend = document.getElementById('changeLegend');

    // Elementos dos modais e navbar
    configModal = new bootstrap.Modal(document.getElementById('configModal'));
    loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    configBtn = document.getElementById('configBtn');
    logoutBtn = document.getElementById('logoutBtn');
    loginLink = document.getElementById('loginLink');

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

    // Estatísticas dos filtros manuais
    manualBggTotal = document.getElementById('manualBggTotal');
    manualBggBase = document.getElementById('manualBggBase');
    manualBggExp = document.getElementById('manualBggExp');
    manualLudoTotal = document.getElementById('manualLudoTotal');
    manualLudoBase = document.getElementById('manualLudoBase');
    manualLudoExp = document.getElementById('manualLudoExp');

    // Configurar event listeners
    configBtn.addEventListener('click', handleConfigClick);
    logoutBtn.addEventListener('click', handleLogout);
    loginLink.addEventListener('click', handleConfigClick);
    
    // Event listener para o form de login
    document.getElementById('quickLoginForm').addEventListener('submit', handleQuickLogin);
    loadBtn.addEventListener('click', loadCollectionsFromAPI);

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
            
            // Handle manual matching filters
            if (collection === 'manual-bgg') {
                const games = currentManualBggGames;
                const container = manualBggList;
                
                if (filter === 'all') {
                    renderManualGameList(games, container, 'bgg');
                } else {
                    const filtered = games.filter(game => 
                        filter === 'base' ? !game.isExpansion : game.isExpansion
                    );
                    renderManualGameList(filtered, container, 'bgg');
                }
                return;
            }
            
            if (collection === 'manual-ludo') {
                const games = currentManualLudoGames;
                const container = manualLudoList;
                
                if (filter === 'all') {
                    renderManualGameList(games, container, 'ludo');
                } else {
                    const filtered = games.filter(game => 
                        filter === 'base' ? !game.isExpansion : game.isExpansion
                    );
                    renderManualGameList(filtered, container, 'ludo');
                }
                return;
            }
            
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
                    bggVersionId: match.bggGame.versionId,
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
            const response = await window.authManager.authenticatedFetch('/api/accept-matches', {
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

    // Disparar findMatches quando mudar para a aba de pareamento (apenas se autenticado)
    document.getElementById('matching-tab')?.addEventListener('shown.bs.tab', () => {
        if (window.authManager && window.authManager.isAuthenticated()) {
            findMatches();
        }
    });


    // Inicializar estado dos filtros na carga da página
    updateFilterLinksState();

    // Inicializar interface do usuário e carregar coleções se autenticado
    // Aguardar um pouco para garantir que o authManager foi inicializado
    setTimeout(() => {
        updateUserInterface();
        if (window.authManager && window.authManager.isAuthenticated()) {
            loadCollections();
        }
    }, 100);
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


// Função para salvar as coleções
async function saveCollections() {
    if (!currentBGGGames.length && !currentLudoGames.length) {
        alert('Nenhuma coleção carregada para salvar');
        return;
    }

    try {
        setLoading(true);

        const response = await window.authManager.authenticatedFetch('/api/save-collections', {
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
        }
    }
}

// Carregar coleções automaticamente do banco de dados
async function loadCollections() {
    try {
        setLoading(true);
        
        // Carregar do banco usando GET (sem body)
        const response = await window.authManager.authenticatedFetch('/api/collections');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Mostrar mensagem se houver
        if (data.message) {
            console.log('ℹ️', data.message);
        }
        
        // Store the collections
        currentBGGGames = data.bggCollection || [];
        currentLudoGames = data.ludoCollection || [];
        
        // Habilitar botão de salvar se há coleções carregadas
        
        // Atualizar UI
        updateStats(currentBGGGames, 'bgg');
        updateStats(currentLudoGames, 'ludo');
        
        // Atualizar estado dos links de filtro
        updateFilterLinksState();
        
        // Reset filters to "all" and render full lists
        document.querySelectorAll('.filter-link[data-filter="all"]').forEach(link => {
            link.classList.add('active');
        });
        document.querySelectorAll('.filter-link[data-filter="base"], .filter-link[data-filter="expansion"]').forEach(link => {
            link.classList.remove('active');
        });
        
        renderGameList(currentBGGGames, bggList);
        renderGameList(currentLudoGames, ludoList);

        // Procurar matches após carregar as coleções (apenas se autenticado)
        if (currentBGGGames.length > 0 && currentLudoGames.length > 0 && window.authManager && window.authManager.isAuthenticated()) {
            findMatches();
        }
        
        // Show success message after successful load apenas se carregou dados
        
        // Log sobre a fonte dos dados
        console.log(`📊 Coleções carregadas (${data.source}): BGG=${currentBGGGames.length}, Ludopedia=${currentLudoGames.length}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        // Não mostrar alert para erros automáticos, apenas log
        console.warn('⚠️ Erro ao carregar coleções automaticamente:', error.message);
    } finally {
        setLoading(false);
    }
}

// Função para carregar coleções via API (quando o botão for clicado)
async function loadCollectionsFromAPI() {
    try {
        setLoading(true);
        
        // Ocultar seções de resumo ao iniciar carregamento
        if (loadSummary) loadSummary.style.display = 'none';
        if (changeLegend) changeLegend.style.display = 'none';
        
        const response = await window.authManager.authenticatedFetch('/api/collections', {
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
        
        // Capturar estatísticas atuais ANTES de atualizar a UI
        const currentBggStats = {
            total: parseInt(bggTotal?.textContent || '0'),
            base: parseInt(bggBase?.textContent || '0'),
            expansions: parseInt(bggExp?.textContent || '0')
        };
        const currentLudoStats = {
            total: parseInt(ludoTotal?.textContent || '0'),
            base: parseInt(ludoBase?.textContent || '0'),
            expansions: parseInt(ludoExp?.textContent || '0')
        };
        
        // Store the collections
        currentBGGGames = data.bggCollection;
        currentLudoGames = data.ludoCollection;
        
        // Habilitar botão de salvar se há coleções carregadas
        
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
        

        // Mostrar resumo dos dados carregados
        showLoadSummary(data.bggCollection, data.ludoCollection, currentBggStats, currentLudoStats);

        // Salvar automaticamente as coleções carregadas
        await saveCollections();
        
    } catch (error) {
        console.error('Error:', error);
        alert('Erro ao carregar coleções via API: ' + error.message);
    } finally {
        setLoading(false);
    }
}

// Mostrar resumo dos dados carregados na aba de atualização
function showLoadSummary(bggCollection, ludoCollection, currentBggStats, currentLudoStats) {
    if (!loadSummary || !changeLegend) return;

    // Calcular estatísticas dos dados carregados
    const loadedBggStats = calculateStats(bggCollection);
    const loadedLudoStats = calculateStats(ludoCollection);

    // Atualizar elementos BGG
    updateLoadedStat('loadedBggTotal', loadedBggStats.total, currentBggStats.total);
    updateLoadedStat('loadedBggBase', loadedBggStats.base, currentBggStats.base);
    updateLoadedStat('loadedBggExp', loadedBggStats.expansions, currentBggStats.expansions);

    // Atualizar elementos Ludopedia
    updateLoadedStat('loadedLudoTotal', loadedLudoStats.total, currentLudoStats.total);
    updateLoadedStat('loadedLudoBase', loadedLudoStats.base, currentLudoStats.base);
    updateLoadedStat('loadedLudoExp', loadedLudoStats.expansions, currentLudoStats.expansions);

    // Mostrar seções
    loadSummary.style.display = 'block';
    changeLegend.style.display = 'block';
}

// Função auxiliar para calcular estatísticas
function calculateStats(collection) {
    const base = collection.filter(game => !game.isExpansion).length;
    const expansions = collection.filter(game => game.isExpansion).length;
    return {
        total: collection.length,
        base: base,
        expansions: expansions
    };
}

// Função auxiliar para atualizar estatística carregada com diferença
function updateLoadedStat(elementId, loadedValue, currentValue) {
    const element = document.getElementById(elementId);
    const changeElement = document.getElementById(elementId + 'Change');
    
    console.log(`🔄 updateLoadedStat: ${elementId} = ${loadedValue} (atual: ${currentValue})`);
    
    if (element) {
        element.textContent = loadedValue;
    }
    
    if (changeElement) {
        const difference = loadedValue - currentValue;
        console.log(`📊 Diferença para ${elementId}: ${difference}`);
        
        if (difference > 0) {
            changeElement.innerHTML = `<span class="badge bg-success badge-large">+${difference}</span>`;
        } else if (difference < 0) {
            changeElement.innerHTML = `<span class="badge bg-danger badge-large">${difference}</span>`;
        } else {
            changeElement.innerHTML = `<span class="badge bg-secondary badge-large">=</span>`;
        }
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
        const response = await window.authManager.authenticatedFetch('/api/match-collections', {
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
        const response = await window.authManager.authenticatedFetch('/api/match-collections-ai', {
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
                bggVersionId: match.bgg.versionId,
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
        const response = await window.authManager.authenticatedFetch('/api/save-matches-ai', {
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

function updateManualStats(bggGames, ludoGames) {
    // BGG Manual Stats
    const bggBase = bggGames.filter(game => !game.isExpansion);
    const bggExp = bggGames.filter(game => game.isExpansion);
    
    manualBggTotal.textContent = bggGames.length;
    manualBggBase.textContent = bggBase.length;
    manualBggExp.textContent = bggExp.length;
    
    // Ludopedia Manual Stats
    const ludoBase = ludoGames.filter(game => !game.isExpansion);
    const ludoExpansions = ludoGames.filter(game => game.isExpansion);
    
    manualLudoTotal.textContent = ludoGames.length;
    manualLudoBase.textContent = ludoBase.length;
    manualLudoExp.textContent = ludoExpansions.length;
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
    
    // Armazenar as listas completas para uso nos filtros
    currentManualBggGames = combinedBggGames;
    currentManualLudoGames = combinedLudoGames;
    
    // Renderizar lista BGG
    renderManualGameList(combinedBggGames, manualBggList, 'bgg');
    manualBggCount.textContent = combinedBggGames.length;
    
    // Renderizar lista Ludopedia
    renderManualGameList(combinedLudoGames, manualLudoList, 'ludo');
    manualLudoCount.textContent = combinedLudoGames.length;
    
    // Atualizar estatísticas dos filtros
    updateManualStats(combinedBggGames, combinedLudoGames);
    
    // Reset filters to "all" and set active state
    document.querySelectorAll('.filter-link[data-collection="manual-bgg"], .filter-link[data-collection="manual-ludo"]').forEach(link => {
        if (link.dataset.filter === 'all') {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
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
                    <span class="game-type-badge ${game.isExpansion ? 'badge-expansion' : 'badge-base'}">
                        ${game.isExpansion ? 'Expansão' : 'Base'}
                    </span>
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
            bggVersionId: selectedManualBggGame.versionId,
            ludoId: selectedManualLudoGame.id,
            bggName: selectedManualBggGame.name,
            ludoName: selectedManualLudoGame.name,
            confidence: 'manual',
            reasoning: 'Match manual criado pelo usuário'
        };
        
        const response = await window.authManager.authenticatedFetch('/api/save-manual-match', {
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

// Função para formatar nome (apenas primeiro nome, primeira letra maiúscula)
function formatFirstName(fullName) {
    if (!fullName) return 'Usuário';
    
    const firstName = fullName.trim().split(' ')[0];
    if (!firstName) return 'Usuário';
    
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

// Função para atualizar interface do usuário baseada no estado de autenticação
function updateUserInterface() {
    const unauthenticatedDiv = document.getElementById('unauthenticatedUser');
    const authenticatedDiv = document.getElementById('authenticatedUser');
    const userNameSpan = document.querySelector('.user-name');
    
    // Verificar se os elementos existem
    if (!unauthenticatedDiv || !authenticatedDiv) {
        console.log('🔍 DEBUG: Elementos de navbar não encontrados');
        return;
    }
    
    const isAuthenticated = window.authManager && window.authManager.isAuthenticated();
    console.log('🔍 DEBUG: Estado de autenticação:', isAuthenticated);
    
    if (isAuthenticated) {
        // Usuário autenticado - mostrar "Olá, Nome" e esconder "Entrar"
        console.log('🔍 DEBUG: Mostrando interface para usuário autenticado');
        unauthenticatedDiv.classList.remove('d-flex');
        unauthenticatedDiv.classList.add('d-none');
        authenticatedDiv.classList.remove('d-none');
        authenticatedDiv.classList.add('d-flex');
        
        // Atualizar nome do usuário
        const user = window.authManager.getCurrentUser();
        if (user && user.name && userNameSpan) {
            const firstName = formatFirstName(user.name);
            userNameSpan.textContent = firstName;
            console.log('🔍 DEBUG: Nome atualizado para:', firstName);
        }
    } else {
        // Usuário não autenticado - mostrar "Entrar" e esconder "Olá, Nome"
        console.log('🔍 DEBUG: Mostrando interface para usuário não autenticado');
        unauthenticatedDiv.classList.remove('d-none');
        unauthenticatedDiv.classList.add('d-flex');
        authenticatedDiv.classList.remove('d-flex');
        authenticatedDiv.classList.add('d-none');
    }
}

// Função para verificar se o usuário está autenticado
async function checkAuthentication() {
    try {
        // Usar authManager se disponível
        if (window.authManager) {
            return window.authManager.isAuthenticated();
        }
        
        // Fallback manual
        const token = localStorage.getItem('authToken');
        if (!token) return false;
        
        const response = await fetch('/api/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Função para lidar com o clique na roda dentada
async function handleConfigClick() {
    const isAuthenticated = await checkAuthentication();
    
    if (isAuthenticated) {
        await loadUserProfile();
        configModal.show();
    } else {
        loginModal.show();
    }
}

// Função para carregar os dados do usuário
async function loadUserProfile() {
    try {
        const response = await fetch('/api/me', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const userData = data.user;
            
            // Preencher os campos do modal
            document.getElementById('userDisplayName').textContent = userData.name || '-';
            document.getElementById('userDisplayEmail').textContent = userData.email || '-';
            document.getElementById('userDisplayBgg').textContent = userData.bgg_username || '-';
            document.getElementById('userDisplayLudopedia').textContent = userData.ludopedia_username || '-';
            
            // Formatar plataforma preferida
            const platformMap = {
                'bgg': 'BoardGameGeek',
                'ludopedia': 'Ludopedia'
            };
            document.getElementById('userDisplayPlatform').textContent = platformMap[userData.preferred_platform] || userData.preferred_platform || '-';
            
            // Formatar data de criação (só dia/mês/ano)
            if (userData.created_at) {
                const date = new Date(userData.created_at);
                const formattedDate = date.toLocaleDateString('pt-BR');
                document.getElementById('userDisplayCreated').textContent = formattedDate;
            } else {
                document.getElementById('userDisplayCreated').textContent = '-';
            }
        }
    } catch (error) {
        console.error('Erro ao carregar perfil do usuário:', error);
    }
}

// Função para lidar com o login rápido
async function handleQuickLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const submitBtn = document.getElementById('quickLoginBtn');
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Entrando...';
        
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Salvar token e dados do usuário (mesmo formato da página de login)
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Atualizar authManager
            if (window.authManager) {
                window.authManager.setAuth(data.token, data.user);
                // Não chamar updateUserInterface do authManager pois temos nossa própria lógica
            }
            
            // Atualizar interface do usuário
            updateUserInterface();
            
            // Fechar modal de login
            loginModal.hide();
            
            // Carregar coleções automaticamente
            loadCollections();
        } else {
            alert(data.error || 'Erro ao fazer login');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        alert('Erro ao fazer login. Tente novamente.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Entrar';
    }
}

// Função para fazer logout
async function handleLogout() {
    try {
        // Usar authManager para logout se disponível
        if (window.authManager) {
            await window.authManager.logout();
        } else {
            // Fallback manual
            await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            // Limpar dados locais
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            
            // Redirecionar para home
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Erro no logout:', error);
        // Mesmo com erro, limpar dados locais e redirecionar
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

