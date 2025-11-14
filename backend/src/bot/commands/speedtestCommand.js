import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import logger from '../../config/logger.js';

const execFileAsync = promisify(execFile);

const DEFAULT_BINARY = process.platform === 'win32' ? 'speedtest.exe' : 'speedtest';
const SPEEDTEST_BIN = process.env.SPEEDTEST_BIN || DEFAULT_BINARY;
const SPEEDTEST_ARGS = ['--accept-license', '--accept-gdpr', '-f', 'json'];
const SPEEDTEST_TIMEOUT = Number.parseInt(process.env.SPEEDTEST_TIMEOUT ?? '120000', 10);

function toMbps(bandwidth) {
  if (typeof bandwidth !== 'number') {
    return null;
  }

  return (bandwidth * 8) / 1_000_000;
}

async function runSpeedtest() {
  try {
    const { stdout } = await execFileAsync(SPEEDTEST_BIN, SPEEDTEST_ARGS, {
      timeout: SPEEDTEST_TIMEOUT,
      windowsHide: true,
    });

    return JSON.parse(stdout);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `Nie znaleziono binarki "${SPEEDTEST_BIN}". Zainstaluj oficjalne narzędzie Speedtest CLI od Ookla i upewnij się, że znajduje się w PATH lub ustaw zmienną SPEEDTEST_BIN.`,
      );
    }

    const stdout = error.stdout?.toString().trim();
    if (stdout) {
      try {
        return JSON.parse(stdout);
      } catch (_) {
        // ignoruj
      }
    }

    const stderr = error.stderr?.toString().trim();
    throw new Error(stderr || error.message);
  }
}

export const data = new SlashCommandBuilder()
  .setName('speedtest')
  .setDescription('Uruchom wiarygodny test łącza (Speedtest CLI od Ookla)');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const result = await runSpeedtest();

    const downloadMbps = toMbps(result.download?.bandwidth);
    const uploadMbps = toMbps(result.upload?.bandwidth);
    const pingLatency = result.ping?.latency;
    const pingJitter = result.ping?.jitter;
    const server = result.server;

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('📡 Speedtest (Ookla CLI)')
      .setTimestamp();

    if (pingLatency !== undefined) {
      embed.addFields({
        name: 'Ping',
        value: `\`${pingLatency.toFixed(2)} ms\`${pingJitter !== undefined ? `\nJitter: ${pingJitter.toFixed(2)} ms` : ''}`,
        inline: true,
      });
    }

    embed.addFields(
      {
        name: '⬇️ Download',
        value: downloadMbps !== null ? `\`${downloadMbps.toFixed(2)} Mbps\`` : 'Brak danych',
        inline: true,
      },
      {
        name: '⬆️ Upload',
        value: uploadMbps !== null ? `\`${uploadMbps.toFixed(2)} Mbps\`` : 'Brak danych',
        inline: true,
      },
    );

    if (server) {
      embed.addFields({
        name: 'Serwer pomiarowy',
        value: `${server.name ?? 'Nieznany'} • ${server.location ?? 'brak lokalizacji'}${server.country ? ` (${server.country})` : ''}`,
      });
    }

    if (result.result?.url) {
      embed.setURL(result.result.url);
      embed.setFooter({ text: 'Kliknij tytuł, aby zobaczyć pełny raport' });
    } else {
      embed.setFooter({ text: 'Wyniki dostarczone przez Speedtest®' });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Speedtest command error: ${error.message}`, { stack: error.stack });

    const content =
      'Nie udało się uruchomić wiarygodnego speedtestu. ' +
      (error.message ?? 'Sprawdź logi bota po więcej informacji.');

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  }
}


