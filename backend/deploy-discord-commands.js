import { REST, Routes } from 'discord.js';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';
import { readdirSync, statSync, existsSync } from 'fs';
import logger from '../backend/src/config/logger.js';
import { config as loadEnv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load default .env in current working directory first (if present)
const defaultEnvResult = loadEnv();
if (defaultEnvResult?.parsed) {
  logger.info('Wczytano zmienne środowiskowe z domyślnego pliku .env (bieżący katalog).');
}

const envCandidates = [
  './.env.development',
];

let envLoaded = false;
for (const relativePath of envCandidates) {
  const candidatePath = resolve(__dirname, relativePath);
  if (existsSync(candidatePath)) {
    loadEnv({ path: candidatePath });
    logger.info(`Wczytano konfigurację środowiska z ${candidatePath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  logger.warn('Nie znaleziono żadnego dodatkowego pliku .env (sprawdzane katalogi: bieżący oraz nadrzędny). Używam aktualnych zmiennych środowiskowych.');
}

async function loadCommandModules(commandsDir) {
  const files = readdirSync(commandsDir).filter((file) => file.endsWith('Command.js'));
  const commands = [];

  for (const file of files) {
    const filePath = resolve(commandsDir, file);
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      continue;
    }

    const commandModule = await import(pathToFileURL(filePath).href);
    if (!commandModule?.data) {
      logger.warn(`Pomijam plik ${file}: brak eksportu "data".`);
      continue;
    }

    const json = commandModule.data.toJSON();
    commands.push(json);
  }

  return commands;
}

async function deployCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    logger.error('Brak wymaganych zmiennych środowiskowych: DISCORD_BOT_TOKEN i DISCORD_CLIENT_ID');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const commandsDir = resolve(__dirname, './src/bot/commands');
  const commands = await loadCommandModules(commandsDir);

  if (!commands.length) {
    logger.warn('Nie znaleziono żadnych komend do zdeployowania.');
    return;
  }

  logger.info(`Rozpoczynam deployment ${commands.length} komend...`);

  try {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    logger.info('Komendy zostały pomyślnie zarejestrowane globalnie.');
  } catch (error) {
    logger.error(`Błąd podczas rejestrowania komend: ${error.message}`, { stack: error.stack });
    process.exit(1);
  }
}

deployCommands().catch((error) => {
  logger.error('Nieoczekiwany błąd podczas deploymentu komend:', error);
  process.exit(1);
});

