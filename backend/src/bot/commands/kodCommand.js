import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('kod')
  .setDescription('Dodaj kod kreskowy produktu');

export async function execute(interaction) {
  // Create modal
  const modal = new ModalBuilder()
    .setCustomId('barcode_modal')
    .setTitle('Dodaj kod kreskowy');

  // Create text input fields
  const productInput = new TextInputBuilder()
    .setCustomId('product_name')
    .setLabel('Nazwa produktu')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Wprowadź nazwę produktu')
    .setMaxLength(100);

  const barcodeInput = new TextInputBuilder()
    .setCustomId('barcode')
    .setLabel('Kod kreskowy')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Wprowadź kod kreskowy')
    .setMaxLength(50);

  // Add inputs to action rows
  const firstActionRow = new ActionRowBuilder().addComponents(productInput);
  const secondActionRow = new ActionRowBuilder().addComponents(barcodeInput);

  // Add action rows to modal
  modal.addComponents(firstActionRow, secondActionRow);

  // Show modal to user
  await interaction.showModal(modal);
}

