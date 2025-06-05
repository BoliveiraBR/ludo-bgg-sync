const fs = require('fs');

class CollectionMatcher {
  static compareCollections(bggCollection, ludoCollection) {
    const normalize = name => name.trim().toLowerCase();

    const bggBaseNames = bggCollection
      .filter(item => item.subtype === 'base')
      .map(item => ({ original: item.name.trim(), normalized: normalize(item.name) }));

    const ludoBaseNames = ludoCollection
      .filter(item => item.type === 'base')
      .map(item => ({ original: item.name.trim(), normalized: normalize(item.name) }));

    const bggSet = new Map(bggBaseNames.map(({ normalized, original }) => [normalized, original]));
    const ludoSet = new Map(ludoBaseNames.map(({ normalized, original }) => [normalized, original]));

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