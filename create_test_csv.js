const fs = require('fs');

// Read BGG collection
const bggData = JSON.parse(fs.readFileSync('data/BGGCollection-AcemanBR.txt', 'utf8'));

// Read Ludopedia collection  
const ludoData = JSON.parse(fs.readFileSync('data/LudopediaCollection-AcemanBR.txt', 'utf8'));

// Create BGG CSV (take first 20 games for testing)
const bggCsv = ['Game Name,Year,BGG ID,Rating,Plays,Comment'];
bggData.slice(0, 20).forEach(game => {
    const name = `"${game.name.replace(/"/g, '""')}"`;
    const year = game.year || '';
    const id = game.id || '';
    const rating = game.rating || '';
    const plays = game.numplays || 0;
    const comment = `"${(game.comment || '').replace(/"/g, '""')}"`;
    bggCsv.push(`${name},${year},${id},${rating},${plays},${comment}`);
});

// Create Ludopedia CSV (take first 20 games for testing)
const ludoCsv = ['Game Name,Year,Ludo ID,Rating,Favorite,Comment'];
ludoData.slice(0, 20).forEach(game => {
    const name = `"${game.name.replace(/"/g, '""')}"`;
    const year = game.year || '';
    const id = game.id || '';
    const rating = game.rating || '';
    const favorite = game.favorite ? 'true' : 'false';
    const comment = `"${(game.comment || '').replace(/"/g, '""')}"`;
    ludoCsv.push(`${name},${year},${id},${rating},${favorite},${comment}`);
});

// Write CSV files
fs.writeFileSync('bgg_test_collection.csv', bggCsv.join('\n'));
fs.writeFileSync('ludothek_test_collection.csv', ludoCsv.join('\n'));

console.log('Test CSV files created:');
console.log('- bgg_test_collection.csv (20 games)');
console.log('- ludothek_test_collection.csv (20 games)');
