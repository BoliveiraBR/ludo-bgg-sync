console.log('🚀 Iniciando servidor simples...');

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World! Server is working!');
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    port: process.env.PORT || 8081,
    env: process.env.NODE_ENV || 'development'
  });
});

const port = process.env.PORT || 8081;
console.log(`🔍 Tentando iniciar na porta: ${port}`);

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Servidor simples funcionando na porta ${port}`);
}).on('error', (err) => {
  console.error('❌ Erro ao iniciar servidor:', err);
});