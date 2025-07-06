-- Migration: Remove foreign keys from collection_matches table
-- OBJETIVO: Permitir que matches sejam preservados mesmo quando jogos saem das coleções
-- Os matches representam correlações semânticas permanentes entre jogos das plataformas

-- Verificar as foreign keys existentes antes de remover
-- (comando informativo - pode ser executado para conferir)
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'collection_matches';

-- Remover foreign key para BGG collection
ALTER TABLE collection_matches 
DROP CONSTRAINT IF EXISTS collection_matches_bgg_user_name_bgg_game_id_bgg_version_i_fkey;

-- Remover foreign key para Ludopedia collection  
ALTER TABLE collection_matches 
DROP CONSTRAINT IF EXISTS collection_matches_ludopedia_user_name_ludopedia_game_id_fkey;

-- Verificar se as foreign keys foram removidas
-- (comando informativo - executar para confirmar)
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'collection_matches';

-- Adicionar comentário explicativo
COMMENT ON TABLE collection_matches IS 'Pareamentos/matches entre jogos do BGG e Ludopedia. Matches são preservados independentemente da presença dos jogos nas coleções, representando correlações semânticas permanentes.';