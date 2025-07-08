-- Script para popular a tabela taglines com exemplos
-- Execute este script manualmente no seu banco de dados PostgreSQL

-- Criar a tabela taglines (caso não exista)
CREATE TABLE IF NOT EXISTS taglines (
    id SERIAL PRIMARY KEY,
    text VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE
);

-- Inserir taglines de exemplo
INSERT INTO taglines (text) VALUES 
('Sincronize suas coleções com maestria'),
('Onde BGG e Ludopedia se encontram'),
('Transformando caos em ordem desde 2024'),
('O guru das suas coleções de board games'),
('Conectando mundos, organizando jogos');

-- Verificar se as taglines foram inseridas
SELECT * FROM taglines ORDER BY id;

-- Comandos úteis para manutenção:
-- Para desativar uma tagline específica:
-- UPDATE taglines SET active = FALSE WHERE id = 1;

-- Para adicionar uma nova tagline:
-- INSERT INTO taglines (text) VALUES ('Nova tagline aqui');

-- Para listar apenas taglines ativas:
-- SELECT * FROM taglines WHERE active = TRUE;

-- Para selecionar uma tagline aleatória (como será usado no código):
-- SELECT text FROM taglines WHERE active = TRUE ORDER BY RANDOM() LIMIT 1;