import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const monthNames = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

const maxMonthsBack = 3;

function chunkButtons(buttons) {
  const rows = [];
  let currentRow = new ActionRowBuilder();
  let count = 0;

  for (const button of buttons) {
    currentRow.addComponents(button);
    count += 1;

    if (count === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
      count = 0;
    }
  }

  if (count > 0) {
    rows.push(currentRow);
  }

  return rows;
}

export async function buildScheduleMenu(prisma, employeeId) {
  const now = new Date();
  const monthsToCheck = [];

  for (let diff = -maxMonthsBack; diff <= 0; diff += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + diff, 1);
    monthsToCheck.push({
      month: date.getMonth(),
      year: date.getFullYear(),
      label: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
      difference: diff
    });
  }

  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  monthsToCheck.push({
    month: nextMonthDate.getMonth(),
    year: nextMonthDate.getFullYear(),
    label: `${monthNames[nextMonthDate.getMonth()]} ${nextMonthDate.getFullYear()}`,
    difference: 1
  });

  const buttons = [];
  let currentMonthScheduleId = null;

  for (const monthInfo of monthsToCheck) {
    const schedule = await prisma.schedule.findFirst({
      where: {
        month: monthInfo.month,
        year: monthInfo.year
      },
      select: {
        id: true
      }
    });

    if (!schedule) {
      if (monthInfo.difference === 0) {
        currentMonthScheduleId = null;
      }
      continue;
    }

    if (monthInfo.difference === 0) {
      currentMonthScheduleId = schedule.id;
    }

    const style = (() => {
      if (monthInfo.difference === 0) {
        return ButtonStyle.Success;
      }
      if (monthInfo.difference === -1 || monthInfo.difference === 1) {
        return ButtonStyle.Primary;
      }
      return ButtonStyle.Secondary;
    })();

    buttons.push(
      new ButtonBuilder()
        .setCustomId(`schedule_${schedule.id}_${employeeId}`)
        .setLabel(
          monthInfo.difference === 0
            ? `${monthNames[monthInfo.month]} ${monthInfo.year} (obecny)`
            : `${monthNames[monthInfo.month]} ${monthInfo.year}`
        )
        .setStyle(style)
    );
  }

  if (!buttons.length) {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Brak dostępnych grafików')
      .setDescription('Nie znaleziono żadnych grafików z ostatnich miesięcy. Gdy tylko grafik zostanie opublikowany, będzie można go tu sprawdzić.')
      .setTimestamp();

    return {
      embed,
      components: []
    };
  }

  if (!currentMonthScheduleId) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('schedule_disabled_current')
        .setLabel(`${monthNames[now.getMonth()]} ${now.getFullYear()} (brak grafiku)`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
  }

  const embedDescriptionParts = [
    'Wybierz miesiąc, aby zobaczyć swój grafik. Dostępne są maksymalnie trzy poprzednie miesiące, bieżący oraz najbliższy przyszły (jeśli dostępny).'
  ];

  if (!currentMonthScheduleId) {
    embedDescriptionParts.push('⚠️ Grafik dla bieżącego miesiąca nie jest jeszcze dostępny.');
  }

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('Wybierz miesiąc grafiku')
    .setDescription(embedDescriptionParts.join('\n'))
    .setTimestamp();

  return {
    embed,
    components: chunkButtons(buttons)
  };
}

const hoursFormatter = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

function formatHours(value) {
  const normalized = Math.round((value ?? 0) * 100) / 100;
  return hoursFormatter.format(normalized);
}

function toIsoDate(value) {
  return new Date(value).toISOString().split('T')[0];
}

function formatDayData(isoDate) {
  const [yearStr, monthStr, dayStr] = isoDate.split('-');
  const dateObj = new Date(Date.UTC(
    Number(yearStr),
    Number(monthStr) - 1,
    Number(dayStr)
  ));

  const weekdayName = dateObj.toLocaleDateString('pl-PL', {
    weekday: 'long',
    timeZone: 'UTC'
  });

  const rawMonthName = dateObj.toLocaleDateString('pl-PL', {
    month: 'long',
    timeZone: 'UTC'
  });

  const monthName = rawMonthName
    ? `${rawMonthName.charAt(0).toUpperCase()}${rawMonthName.slice(1)}`
    : '';

  return {
    dayNumber: Number(dayStr),
    monthName,
    weekdayName,
    weekdayIndex: dateObj.getUTCDay()
  };
}

function getEmojiForDay(weekdayIndex) {
  if (weekdayIndex === 6) {
    return '🟨';
  }
  if (weekdayIndex === 0) {
    return '⬜';
  }
  return '🟦';
}

export function buildScheduleDetail(schedule, employee, assignments) {
  const monthName = new Date(schedule.year, schedule.month).toLocaleString('pl-PL', { month: 'long' });
  const sortedAssignments = [...assignments].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let formattedShifts = `**${monthName} ${schedule.year}**\n\n`;

  if (sortedAssignments.length === 0) {
    formattedShifts += 'Brak przypisań w tym miesiącu.';
  } else {
    const dayStats = new Map();
    let totalHours = 0;

    const lines = sortedAssignments.map((assignment) => {
      const isoDate = toIsoDate(assignment.date);
      const { dayNumber, monthName: formattedMonthName, weekdayName, weekdayIndex } = formatDayData(isoDate);
      const emoji = getEmojiForDay(weekdayIndex);
      const storeName = assignment.Store?.name ?? 'Sklep';
      const hours = assignment.hours ?? 0;
      totalHours += hours;

      const stats = dayStats.get(isoDate) ?? { hours: 0, weekdayIndex };
      stats.hours += hours;
      dayStats.set(isoDate, stats);

      return `${emoji} **${dayNumber} ${formattedMonthName}** (${weekdayName}) – ${storeName} (${formatHours(hours)}h)`;
    });

    let weekdayCount = 0;
    let saturdayCount = 0;
    let sundayCount = 0;

    dayStats.forEach(({ hours, weekdayIndex }) => {
      if (hours <= 0) {
        return;
      }
      if (weekdayIndex === 6) {
        saturdayCount += 1;
      } else if (weekdayIndex === 0) {
        sundayCount += 1;
      } else {
        weekdayCount += 1;
      }
    });

    const totalWorkingDays = weekdayCount + saturdayCount;

    formattedShifts += lines.join('\n');
    formattedShifts += `\n\n**Podsumowanie:**\n`;
    formattedShifts += `• Łącznie godzin: ${formatHours(totalHours)}h\n`;
    formattedShifts += `• Dni pracujące: ${totalWorkingDays} (robocze: ${weekdayCount}, soboty: ${saturdayCount})`;
    if (sundayCount > 0) {
      formattedShifts += `\n• Niedziele z godzinami: ${sundayCount}`;
    }
    formattedShifts += `\n\n**Legenda:**\n`;
    formattedShifts += `🟦 dzień roboczy\n`;
    formattedShifts += `🟨 sobota`;
    if (sundayCount > 0) {
      formattedShifts += `\n⬜ niedziela`;
    }
  }

  const employeeName = employee.firstName && employee.lastName
    ? `${employee.firstName} ${employee.lastName}`
    : employee.clerkId || employee.id;

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`Grafik - ${employeeName}`)
    .setDescription(formattedShifts)
    .setTimestamp();

  const actionRow = new ActionRowBuilder();
  const buttons = [];

  if (sortedAssignments.length > 0) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`timesheet_${schedule.id}_${employee.id}`)
        .setLabel('Pobierz godzinówkę')
        .setStyle(ButtonStyle.Primary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`schedule_menu_${employee.id}`)
      .setLabel('Wróć do wyboru miesiąca')
      .setStyle(ButtonStyle.Secondary)
  );

  actionRow.addComponents(...buttons);

  return {
    embed,
    components: [actionRow]
  };
}

