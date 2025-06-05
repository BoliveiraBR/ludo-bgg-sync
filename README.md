# Comparador Ludopedia x BGG

Script para sincronizar e comparar coleções entre BoardGameGeek (BGG) e Ludopedia, ajudando colecionadores de jogos de tabuleiro a manter suas coleções atualizadas em ambas as plataformas.

## 🎯 Objetivo

Facilitar a vida de colecionadores que mantêm suas coleções tanto no BGG quanto na Ludopedia, oferecendo:
- Comparação automática entre as coleções
- Identificação de jogos presentes em apenas uma das plataformas
- Match inteligente usando IA para identificar jogos com nomes diferentes (ex: traduções)
- Geração de relatório detalhado das diferenças

## 🚀 Funcionalidades

- **Sincronização de Coleções**
  - Busca automática da coleção do BGG via API XML
  - Busca automática da coleção da Ludopedia via API REST
  - Suporte a jogos base e expansões

- **Comparação Inteligente**
  - Match exato de nomes
  - Match aproximado usando ChatGPT para identificar variações de nomes
  - Relatório detalhado de diferenças

- **Persistência de Dados**
  - Salva coleções localmente para uso offline
  - Mantém histórico de comparações

## 🏗 Estrutura do Projeto

### `/src/api`
- **bggApi.js**: Interface com a API do BGG
  - `fetchCollection()`: Busca coleção completa
  - `fetchCollectionByType()`: Busca jogos por tipo (base/expansão)

- **ludopediaApi.js**: Interface com a API da Ludopedia
  - `fetchCollection()`: Busca coleção completa
  - `fetchCollectionByType()`: Busca jogos por tipo com paginação

### `/src/collection`
- **loader.js**: Gerenciamento de arquivos de coleção
  - `loadFromFile()`: Carrega coleção de arquivo local
  - `saveToFile()`: Salva coleção em arquivo local

### `/src/comparison`
- **matcher.js**: Lógica de comparação de coleções
  - `compareCollections()`: Compara coleções e identifica diferenças

- **chatGptMatch.js**: Integração com ChatGPT
  - `findMatches()`: Busca matches usando IA para nomes diferentes

### `/src/scripts`
- **sync.js**: Script principal de sincronização
  - Orquestra o processo completo de comparação
  - Gera relatório final