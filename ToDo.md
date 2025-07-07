# 📋 ToDo List

## TODO Urgente
- [ ] Criar a tela inicial para visitantes não autenticados, com formulário de login
- [ ] Desenvolver a tela e lógica de cadastro de usuário:
  - [ ] Nome, email, senha
  - [ ] Login via OAuth na Ludopedia
  - [ ] Informar username do BGG
  - [ ] Escolher plataforma preferida (BGG ou Ludopedia)
  - [ ] Verificação de e-mail com PIN enviado
- [ ] Criar toda a lógica de autenticação via JWT, incluindo geração, verificação e expiração dos tokens
- [ ] Implementar controle de sessão no frontend usando JWT, com armazenamento seguro (ex: httpOnly cookies ou memory + fallback)
- [ ] Corrigir excesso de conexões com o banco: implementar um padrão singleton para garantir reutilização da instância de conexão

## Próximos Passos

### Alta Prioridade
- [ ] Adicionar suporte a múltiplos usuários
- [ ] Colocar todos os dados de arquivos em banco de dados
- [ ] Implementar sistema de log estruturado
- [ ] Adicionar testes unitários para componentes principais
- [ ] Melhorar tratamento de erros e retentativas

### Média Prioridade
- [ ] Modularizar projeto para facilitar adição de funcionalidades
- [ ] Atualização automática entre plataformas
- [ ] Adicionar suporte a sincronia de partidas
- [ ] Adicionar progress bars para operações longas

### Baixa Prioridade
- [ ] Permitir um jogo de um site sendo relacionado a mais de um jogo do outro 
- [ ] Implementar exportação de relatórios em diferentes formatos

### Novas Funcionalidades
   - Usar modelo offline para matching de jogos
   - Dashboard com estatísticas da coleção mais elaborado
   - Gráficos de evolução temporal
   - Recomendações de jogos baseados na coleção
   - Dashboard da vergonha (jogos que você tem e nunca jogou)
   - Comparação de wishlist
   - Sincronização de avaliações
   - Integração com preços e promoções (comparajogos, LudoStore)
   - Compartilhar coleções com outros jogadores (amigos com afinidades)
   - Estatísticas comparativas
   - Sistema de achievements
   - App mobile
