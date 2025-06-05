#!/usr/bin/env node
const { Command } = require('commander');
const inquirer = require('inquirer');
const ora = require('ora');
const chalk = require('chalk');
const BGGApi = require('../../api/bggApi');
const LudopediaApi = require('../../api/ludopediaApi');
const CollectionLoader = require('../../collection/loader');
const CollectionMatcher = require('../../comparison/matcher');
const ChatGPTMatcher = require('../../comparison/chatGptMatch');

const program = new Command();

program
  .name('bgg-ludo-sync')
  .description('Sincronize e compare suas coleções do BGG e Ludopedia')
  .version('1.0.0');

// Comando para configurar as credenciais
program
  .command('config')
  .description('Configurar credenciais das APIs')
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'bggUsername',
        message: 'Qual seu username do BGG?'
      },
      {
        type: 'input',
        name: 'ludoToken',
        message: 'Qual seu token de acesso da Ludopedia?'
      },
      {
        type: 'password',
        name: 'openaiKey',
        message: 'Qual sua chave da API do OpenAI? (opcional)',
      }
    ]);

    // Salvar no .env
    // TODO: Implementar salvamento seguro das credenciais
  });

// Comando para sincronizar coleções
program
  .command('sync')
  .description('Sincronizar coleções do BGG e Ludopedia')
  .option('-f, --force', 'Força atualização ignorando cache')
  .option('-s, --skip-ai', 'Pula o matching via IA')
  .action(async (options) => {
    const spinner = ora('Iniciando sincronização...').start();

    try {
      // Instanciar APIs
      const bggApi = new BGGApi(process.env.ID_BGG);
      const ludoApi = new LudopediaApi(process.env.LUDO_ACCESS_TOKEN);

      // Buscar coleções
      spinner.text = 'Buscando coleções...';
      const [bggCollection, ludoCollection] = await Promise.all([
        bggApi.fetchCollection(),
        ludoApi.fetchCollection()
      ]);

      // Comparar coleções
      spinner.text = 'Comparando coleções...';
      const comparison = CollectionMatcher.compareCollections(bggCollection, ludoCollection);

      // Matching via IA se necessário
      let extraMatches = [];
      if (!options.skipAi && process.env.OPENAI_API_KEY) {
        spinner.text = 'Buscando matches adicionais via IA...';
        const chatGptMatcher = new ChatGPTMatcher(process.env.OPENAI_API_KEY);
        extraMatches = await chatGptMatcher.findMatches(
          comparison.onlyInBGG,
          comparison.onlyInLudo
        );
      }

      // Exibir resultados
      spinner.succeed('Sincronização concluída!');
      
      console.log('\n📊 Estatísticas:');
      console.log(chalk.green(`✓ ${comparison.matches.length} matches exatos`));
      console.log(chalk.blue(`ℹ ${extraMatches.length} matches via IA`));
      console.log(chalk.yellow(`⚠ ${comparison.onlyInBGG.length} jogos só no BGG`));
      console.log(chalk.yellow(`⚠ ${comparison.onlyInLudo.length} jogos só na Ludopedia`));

    } catch (error) {
      spinner.fail('Erro na sincronização');
      console.error(chalk.red('❌ Erro:'), error.message);
    }
  });

// Comando para ver estatísticas
program
  .command('stats')
  .description('Ver estatísticas das coleções')
  .action(async () => {
    // TODO: Implementar visualização de estatísticas
  });

program.parse();
