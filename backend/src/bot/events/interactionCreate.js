/**
 * Interaction Create Event Handler
 * Handles Discord interactions (slash commands, buttons, etc.)
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import logger from '../../config/logger.js';
import { config } from '../../config/index.js';
import { rpsState } from '../../utils/rpsState.js';
import { ticTacToeState } from '../../utils/ticTacToeState.js';
import { buildScheduleMenu, buildScheduleDetail } from '../utils/scheduleUi.js';
import { buildTicTacToeEmbed, buildTicTacToeComponents } from '../utils/ticTacToeUi.js';

/**
 * Handles interaction creation events
 * @param {Interaction} interaction - Discord interaction
 * @param {Object} services - Services object
 */
export async function execute(interaction, services) {
  try {
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction, services);
    } else if (interaction.isModalSubmit()) {
      await handleModalInteraction(interaction, services);
    } else if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
      await services.commandHandler.handle(interaction);
    }
  } catch (error) {
    logger.error(`Interaction handling error: ${error.message}`, { stack: error.stack });

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Wystąpił błąd podczas przetwarzania interakcji.',
        ephemeral: true
      }).catch(err => logger.error(`Failed to send error reply: ${err.message}`));
    }
  }
}

/**
 * Handles button interactions
 * @param {ButtonInteraction} interaction - Button interaction
 * @param {Object} services - Services object
 */
async function handleButtonInteraction(interaction, services) {
  const customId = interaction.customId;

  if (customId.startsWith('rps_')) {
    await handleRPSButton(interaction);
  } else if (customId.startsWith('ttt_')) {
    await handleTicTacToeButton(interaction);
  } else if (customId.startsWith('timesheet_') || customId.startsWith('schedule_')) {
    await handleScheduleButton(interaction, services);
  }
}

/**
 * Handles RPS game button interactions
 * @param {ButtonInteraction} interaction - Button interaction
 */
async function handleRPSButton(interaction) {
  const customId = interaction.customId;
  const parts = customId.split('_');
  const gameId = `${parts[0]}_${parts[1]}_${parts[2]}_${parts[3]}`;
  const choice = parts[4];

  const game = rpsState.getState(gameId);
  if (!game) {
    return interaction.reply({
      content: 'Gra nie została znaleziona lub wygasła.',
      ephemeral: true
    });
  }

  if (game.user1 !== interaction.user.id && game.user2 !== interaction.user.id) {
    return interaction.reply({
      content: 'Nie jesteś uczestnikiem tej gry.',
      ephemeral: true
    });
  }

  if ((game.user1 === interaction.user.id && game.user1Choice) ||
      (game.user2 === interaction.user.id && game.user2Choice)) {
    return interaction.reply({
      content: 'Już wybrałeś swój ruch.',
      ephemeral: true
    });
  }

  rpsState.updateChoice(gameId, interaction.user.id, choice);

  await interaction.reply({
    content: `Wybrałeś: ${getChoiceEmoji(choice)}`,
    ephemeral: true
  });

  const updatedGame = rpsState.getState(gameId);
  if (updatedGame.status === 'completed') {
    await finishRPSGame(interaction, gameId, updatedGame);
  } else {
    // Update embed to show who is still waiting
    const waitingFor = [];
    if (!updatedGame.user1Choice) {
      waitingFor.push(`<@${updatedGame.user1}>`);
    }
    if (!updatedGame.user2Choice) {
      waitingFor.push(`<@${updatedGame.user2}>`);
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Papier-Kamień-Nożyce')
      .setDescription(
        `Wyzwanie: <@${updatedGame.user1}> vs <@${updatedGame.user2}>\n` +
        `⏳ Czekam na: ${waitingFor.join(' i ')}\n` +
        `Wybierz swój ruch klikając przycisk.`
      )
      .setTimestamp();

    try {
      await interaction.message.edit({
        embeds: [embed]
      });
    } catch (error) {
      logger.error(`Failed to update RPS game message: ${error.message}`);
    }
  }
}

/**
 * Handles schedule-related button interactions
 * @param {ButtonInteraction} interaction - Button interaction
 * @param {Object} services - Services object
 */
async function handleScheduleButton(interaction, services) {
  const customId = interaction.customId;
  const [action, ...rest] = customId.split('_');
  const scheduleService = services.scheduleService;
  const prisma = scheduleService?.prisma;

  try {
    if (action === 'timesheet') {
      if (!scheduleService || !prisma) {
        logger.error('Schedule service is not available for timesheet interaction.');
        return interaction.reply({
          content: 'Usługa grafików jest aktualnie niedostępna.',
          ephemeral: true
        });
      }

      const scheduleId = parseInt(rest[0], 10);
      const employeeId = rest[1];

      if (Number.isNaN(scheduleId) || !employeeId) {
        return interaction.reply({
          content: 'Nieprawidłowy identyfikator grafików.',
          ephemeral: true
        });
      }

      logger.info(`Discord: Generating timesheet for scheduleId: ${scheduleId}, employeeId: ${employeeId}`);

      const buffer = await scheduleService.generateEmployeeTimesheet(scheduleId, employeeId);

      const employee = await prisma.user.findUnique({
        where: { id: employeeId }
      });
      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId }
      });

      let filename = `Godziny_${employeeId}_${scheduleId}.xlsx`;

      if (employee && schedule) {
        const monthName = new Date(schedule.year, schedule.month).toLocaleString('pl-PL', { month: 'long' });
        const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        const employeeName = employee.firstName && employee.lastName
          ? `${employee.firstName} ${employee.lastName}`
          : employee.clerkId || 'Pracownik';

        const toAscii = (s) => s
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9\s\-_.()]/g, '')
          .trim()
          .replace(/\s+/g, ' ');
        const asciiEmployee = toAscii(employeeName);
        const asciiMonth = toAscii(capitalizedMonthName);
        filename = `Godzinowka - ${asciiEmployee} (${asciiMonth}).xlsx`;
      }

      await interaction.reply({
        content: 'Oto Twoja godzinówka:',
        files: [{
          attachment: buffer,
          name: filename
        }],
        ephemeral: true
      });
    } else if (action === 'schedule') {
      if (!scheduleService || !prisma) {
        logger.error('Schedule service is not available for schedule interaction.');
        return interaction.reply({
          content: 'Usługa grafików jest aktualnie niedostępna.',
          ephemeral: true
        });
      }

      const subAction = rest[0];
      const employeeId = rest[1];

      if (subAction === 'menu') {
        if (!employeeId) {
          return interaction.reply({
            content: 'Nie udało się odczytać identyfikatora pracownika.',
            ephemeral: true
          });
        }

        const menu = await buildScheduleMenu(prisma, employeeId);

        return interaction.update({
          content: null,
          embeds: [menu.embed],
          components: menu.components
        });
      }

      const scheduleId = parseInt(subAction, 10);

      if (Number.isNaN(scheduleId) || !employeeId) {
        return interaction.reply({
          content: 'Nieprawidłowe dane grafiku.',
          ephemeral: true
        });
      }

      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: {
          Assignments: {
            where: { employeeId },
            include: { Store: true }
          }
        }
      });

      const employee = await prisma.user.findUnique({
        where: { id: employeeId }
      });

      if (!schedule || !employee) {
        const menu = await buildScheduleMenu(prisma, employeeId);

        return interaction.update({
          content: 'Nie znaleziono grafiku lub pracownika.',
          embeds: [menu.embed],
          components: menu.components
        });
      }

      const detail = buildScheduleDetail(schedule, employee, schedule.Assignments ?? []);

      return interaction.update({
        content: null,
        embeds: [detail.embed],
        components: detail.components
      });
    }
  } catch (error) {
    logger.error(`Schedule button error: ${error.message}`, { stack: error.stack });
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Wystąpił błąd podczas przetwarzania żądania.',
        ephemeral: true
      });
    } else {
      await interaction.followUp({
        content: 'Wystąpił błąd podczas przetwarzania żądania.',
        ephemeral: true
      });
    }
  }
}

/**
 * Handles Tic Tac Toe button interactions
 * @param {ButtonInteraction} interaction - Button interaction
 */
async function handleTicTacToeButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    if (parts.length < 6) {
      return interaction.reply({
        content: 'Nie udało się rozpoznać tej gry.',
        ephemeral: true
      });
    }

    const gameId = `${parts[0]}_${parts[1]}_${parts[2]}_${parts[3]}`;
    const action = parts[4];
    const position = parseInt(parts[5], 10);

    if (action !== 'cell') {
      return interaction.reply({
        content: 'Nieznana akcja gry.',
        ephemeral: true
      });
    }

    const game = ticTacToeState.getGame(gameId);
    if (!game) {
      return interaction.reply({
        content: 'Gra nie została znaleziona lub wygasła.',
        ephemeral: true
      });
    }

    const isParticipant = game.playerX === interaction.user.id || game.playerO === interaction.user.id;
    if (!isParticipant) {
      return interaction.reply({
        content: 'Nie jesteś uczestnikiem tej gry.',
        ephemeral: true
      });
    }

    if (game.status !== 'active') {
      return interaction.reply({
        content: 'Ta gra została już zakończona.',
        ephemeral: true
      });
    }

    const result = ticTacToeState.applyMove(gameId, interaction.user.id, position);
    if (!result.success) {
      let message = 'Nie można wykonać tego ruchu.';
      switch (result.error) {
        case 'invalid_position':
          message = 'Nieprawidłowe pole.';
          break;
        case 'occupied':
          message = 'To pole jest już zajęte.';
          break;
        case 'not_turn':
          message = 'Teraz ruch przeciwnika.';
          break;
        case 'inactive':
          message = 'Ta gra została już zakończona.';
          break;
        case 'not_participant':
          message = 'Nie jesteś uczestnikiem tej gry.';
          break;
        case 'not_found':
          message = 'Gra nie została znaleziona lub wygasła.';
          break;
        default:
          message = 'Nie udało się wykonać ruchu.';
      }

      return interaction.reply({
        content: message,
        ephemeral: true
      });
    }

    const updatedGame = result.game;
    const embed = buildTicTacToeEmbed(updatedGame);
    const components = buildTicTacToeComponents(updatedGame);

    await interaction.update({
      embeds: [embed],
      components
    });

    if (updatedGame.status !== 'active') {
      ticTacToeState.finishGame(gameId);
    }
  } catch (error) {
    logger.error(`Tic Tac Toe button error: ${error.message}`, { stack: error.stack });

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Wystąpił błąd podczas obsługi przycisku.',
        ephemeral: true
      }).catch(err => logger.error(`Failed to send Tic Tac Toe error reply: ${err.message}`));
    }
  }
}

/**
 * Finishes an RPS game and shows results
 * @param {ButtonInteraction} interaction - Button interaction
 * @param {string} gameId - Game ID
 * @param {Object} game - Game state
 */
async function finishRPSGame(interaction, gameId, game) {
  const result = determineWinner(game.user1Choice, game.user2Choice);

  let description = `**Wyniki:**\n`;
  description += `<@${game.user1}>: ${getChoiceEmoji(game.user1Choice)}\n`;
  description += `<@${game.user2}>: ${getChoiceEmoji(game.user2Choice)}\n\n`;

  if (result === 'tie') {
    description += `**Remis!** 🤝`;
  } else if (result === 'user1') {
    description += `**<@${game.user1}> wygrywa!** 🎉`;
  } else {
    description += `**<@${game.user2}> wygrywa!** 🎉`;
  }

  const embed = new EmbedBuilder()
    .setColor(result === 'tie' ? '#FFA500' : '#00FF00')
    .setTitle('Papier-Kamień-Nożyce - Wynik')
    .setDescription(description)
    .setTimestamp();

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${gameId}_kamien`)
      .setLabel('🧱 Kamień')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${gameId}_papier`)
      .setLabel('📄 Papier')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${gameId}_nozyce`)
      .setLabel('✂️ Nożyce')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true)
  );

  try {
    await interaction.message.edit({
      embeds: [embed],
      components: [disabledRow]
    });
  } catch (error) {
    logger.error(`Failed to update RPS game message: ${error.message}`);
  }

  rpsState.removeByGame(gameId);
}

/**
 * Determines the winner of an RPS game
 * @param {string} choice1 - First player's choice
 * @param {string} choice2 - Second player's choice
 * @returns {string} Winner ('user1', 'user2', or 'tie')
 */
function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 'tie';

  const winConditions = {
    'kamien': 'nozyce',
    'papier': 'kamien',
    'nozyce': 'papier'
  };

  return winConditions[choice1] === choice2 ? 'user1' : 'user2';
}

/**
 * Gets emoji for RPS choice
 * @param {string} choice - Choice
 * @returns {string} Emoji
 */
function getChoiceEmoji(choice) {
  const emojis = {
    'kamien': '🧱 Kamień',
    'papier': '📄 Papier',
    'nozyce': '✂️ Nożyce'
  };
  return emojis[choice] || choice;
}

/**
 * Handles modal interactions
 * @param {ModalSubmitInteraction} interaction - Modal interaction
 * @param {Object} services - Services object
 */
async function handleModalInteraction(interaction, services) {
  const customId = interaction.customId;

  if (customId === 'barcode_modal') {
    await handleBarcodeModal(interaction, services);
  }
}

/**
 * Handles barcode modal submission
 * @param {ModalSubmitInteraction} interaction - Modal interaction
 * @param {Object} services - Services object
 */
async function handleBarcodeModal(interaction, services) {
  try {
    const productName = interaction.fields.getTextInputValue('product_name');
    const barcode = interaction.fields.getTextInputValue('barcode');
    const user = interaction.user;

    // Get channel ID from config
    const channelId = config.discord.barcodeChannel;

    if (!channelId) {
      logger.error('DISCORD_BARCODE_CHANNEL is not set in environment variables');
      return interaction.reply({
        content: 'Błąd konfiguracji: kanał dla kodów kreskowych nie jest skonfigurowany.',
        ephemeral: true
      });
    }

    // Get the channel
    const channel = await interaction.client.channels.fetch(channelId);
    if (!channel) {
      logger.error(`Channel ${channelId} not found`);
      return interaction.reply({
        content: 'Nie znaleziono kanału dla kodów kreskowych.',
        ephemeral: true
      });
    }

    // Format message: nazwa produktu - `kod kreskowy`
    const message = `${productName} - \`${barcode}\``;

    // Create embed with user info
    const embed = new EmbedBuilder()
      .setDescription(message)
      .setAuthor({
        name: user.tag,
        iconURL: user.displayAvatarURL() || user.defaultAvatarURL
      })
      .setTimestamp()
      .setColor('#0099ff');

    // Send message to channel
    await channel.send({ embeds: [embed] });

    // Reply to user
    await interaction.reply({
      content: `Kod kreskowy został wysłany na kanał <#${channelId}>`,
      ephemeral: true
    });

    logger.info(`Barcode submitted by ${user.tag} (${user.id}): ${productName} - ${barcode}`);
  } catch (error) {
    logger.error(`Barcode modal error: ${error.message}`, { stack: error.stack });
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Wystąpił błąd podczas przetwarzania kodu kreskowego.',
        ephemeral: true
      }).catch(err => logger.error(`Failed to send error reply: ${err.message}`));
    }
  }
}
