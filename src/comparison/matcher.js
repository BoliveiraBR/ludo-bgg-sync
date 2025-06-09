const fs = require('fs');

class CollectionMatcher {
  static compareCollections(bggCollection, ludoCollection) {
    const normalize = name => name.trim().toLowerCase();

    // Incluir todos os jogos (base e expansões) no pareamento
    const bggAllNames = bggCollection
      .map(item => ({ original: item.name.trim(), normalized: normalize(item.name) }));

    const ludoAllNames = ludoCollection
      .map(item => ({ original: item.name.trim(), normalized: normalize(item.name) }));

    const bggSet = new Map(bggAllNames.map(({ normalized, original }) => [normalized, original]));
    const ludoSet = new Map(ludoAllNames.map(({ normalized, original }) => [normalized, original]));

    return {
      matches: [...bggSet.keys()].filter(name => ludoSet.has(name)),
      onlyInBGG: [...bggSet.keys()].filter(name => !ludoSet.has(name)),
      onlyInLudo: [...ludoSet.keys()].filter(name => !bggSet.has(name)),
      bggSet,
      ludoSet
    };
  }
}

module.exports = CollectionMatcher;