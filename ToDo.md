# 📋 ToDo List

Próximo Prompt:
A mensagem de erro na edição/inclusão de itens no modal de configuração não deve ser em uma       │
│   janela separada. Mostre o erro logo acima dos botões, antes do HR no próprio modal, de uma        │
│   maneira discreta, com letras pequenas, apenas deixando claro que qual foi o erro.\                │
│   \                                                                                                 │
│   A caixa de texto para adição do bgg_username está grande e os placeholder e caracteres também     │
│   estão em um padrão maior do que o próprio modal. Acerte isso.\                                    │
│   \                                                                                                 │
│   Antes de fazer a adição do bgg_username, confirme se ele existe no BGG, consultando a API do      │
│   mesmo jeito que voce faz na tela de cadastro



## TODO Urgente
- [ ] Confirmar e-mail por PIN
- [ ] Resetar senha
- [ ] Confirmar senha no cadastro
- [ ] Corrigir excesso de conexões com o banco: implementar um padrão singleton para garantir reutilização da instância de conexão

## Próximos Passos

### Alta Prioridade
- [ ]Permitir edição (ou inclusão) de bgg_username e alteração de site preferido na tela de configuração
- [ ] Permitir deleção de matches feitos anteriormente pelo pareamento
- [ ] Colocar novo ícone na aba do Safari para MacOS e iOS
- [ ] Colocar mensagens de "Como funciona" na aba de pareamento
- [ ] Implementar sistema de log estruturado
- [ ] Adicionar testes unitários para componentes principais

### Média Prioridade
- [ ] Atualização automática entre plataformas
- [ ] Adicionar suporte a sincronia de partidas
- [ ] Adicionar progress bars para operações longas

### Baixa Prioridade
- [ ] Implementar exportação de relatórios em diferentes formatos

### Novas Funcionalidades
🧠 Inteligência de uso da coleção
1. Jogos que merecem sair da estante
	•	Lista de jogos que você jogou poucas vezes ou nunca jogou (usando dados de partidas jogadas).
	•	Destaque para os jogos que estão há mais tempo sem serem jogados.
2. Recomendações para a próxima jogatina
	•	Sugestões personalizadas de jogos com base no número de jogadores disponíveis e tempo disponível.
	•	Filtro por jogos da sua coleção que são mais bem avaliados (BGG/Ludopedia) e encaixam no contexto.
3. Jogos ideais por faixa de jogadores
	•	Agrupamento da coleção por número de jogadores ideais.
	•	Destaque para jogos que funcionam melhor com 2, 3, 4, 5+ jogadores.
4. Jogos por tempo de duração
	•	Filtragem da coleção por tempo estimado de partida.
	•	Sugestão de combos de jogos para preencher um tempo específico (ex: “2h de jogo para 3 pessoas”).
📊 Análise e perfil da coleção
5. Raio-X da sua coleção
	•	Análise da composição da coleção por tipos de jogos (ex: filler, festa, euro médio, pesado).
	•	Gráficos ou percentuais de distribuição temática e de complexidade.
6. Diagnóstico de gaps
	•	Identificação de lacunas na coleção (ex: ausência de jogos leves, party games, cooperativos, jogos para 2).
	•	Sugestões de compra ou trocas para equilibrar a coleção.
🌟 Qualidade e prioridade
7. Ranking de destaque da coleção
	•	Lista dos melhores jogos da coleção com base em notas agregadas (BGG/Ludopedia).
	•	Sugestão de prioridades para jogar mais os jogos bem avaliados que você joga pouco.
8. Coleção recomendada por ocasião
	•	Filtro automático por contexto: jogos para encontros rápidos, noites longas, família, iniciantes, etc.

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
