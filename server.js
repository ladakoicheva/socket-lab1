const net = require('net'); // Вбудований модуль Node.js для мережевої взаємодії через TCP

// Об'єкт конфігурації для зручного налаштування параметрів сервера
const CONFIG = {
  HOST: '127.0.0.1', // Локальна IP-адреса (localhost)
  PORT: 3000,        // Порт, який прослуховує сервер
  DELIMITER: '\n'    // Символ-роздільник для визначення меж повідомлень у байтовому потоці
};

// Створюємо TCP-сервер
// Колбек викликається кожного разу, коли новий клієнт встановлює з'єднання
const server = net.createServer((socket) => {
  
  const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[СЕРВЕР] Нове підключення! IP: ${socket.remoteAddress}, PORT: ${socket.remotePort}`);

  // Локальний буфер для даного клієнта (завдяки замиканню кожен сокет має свій незалежний buffer)
  let buffer = '';

  // 1. Подія 'data': спрацьовує при отриманні нової порції байтів від клієнта
  socket.on('data', (chunk) => {
    // Декодуємо байтовий потік (chunk) у UTF-8 рядок та додаємо до накопичувального буфера
    buffer += chunk.toString('utf-8');

    // Викликаємо функцію для витягування всіх завершених повідомлень з буфера
    const { messages, remainingBuffer } = extractMessages(buffer, CONFIG.DELIMITER);

    // Оновлюємо буфер, залишаючи в ньому тільки необроблені залишки даних
    buffer = remainingBuffer;

    // Почергово обробляємо кожне витягнуте з буфера повідомлення
    messages.forEach((mess) => {
      console.log(`[СЕРВЕР] Отримано від ${clientAddr}: "${mess}"`);

      // Формуємо відповідь залежно від команди
      const response = handleCommand(mess, socket);

      // Надсилаємо відповідь клієнту, ОБОВ'ЯЗКОВО додаючи символ-роздільник '\n'
      socket.write(response + CONFIG.DELIMITER);
    });
  });

  // 2. Подія 'end': клієнт коректно ініціював закриття з'єднання (надіслав FIN-пакет)
  socket.on('end', () => {
    console.log(`[СЕРВЕР] Клієнт ${clientAddr} відключив з'єднання.`);
  });

  // 3. Подія 'error': обробка системних або мережевих помилок сокета
  socket.on('error', (err) => {
    console.error(`[СЕРВЕР] Помилка сокета (${clientAddr}):`, err.message);
  });
});

/**
 * Допоміжна функція для парсингу буфера та розбиття його на окремі повідомлення.
 * @param {string} currentBuffer - поточний накопичений рядок
 * @param {string} delimiter - символ-роздільник ('\n')
 * @returns {Object} { messages: Array, remainingBuffer: String }
 */
function extractMessages(currentBuffer, delimiter) {
  const messages = [];

  // Шукаємо перше входження роздільника '\n'
  let boundary = currentBuffer.indexOf(delimiter);

  // Цикл триває доти, доки в буфері є хоча б один символ '\n'
  while (boundary !== -1) {
    // 1. Вирізаємо чисте повідомлення від початку буфера до розделителя (без пробілів/переносів)
    const message = currentBuffer.slice(0, boundary).trim();

    // 2. Відрізаємо з буфера оброблену частину РАЗОМ із символом '\n' (boundary + 1)
    currentBuffer = currentBuffer.slice(boundary + 1);

    // Якщо повідомлення не порожнє, зберігаємо його в масив
    if (message.length > 0) {
      messages.push(message);
    }

    // Шукаємо наступний символ '\n' у залишку буфера
    boundary = currentBuffer.indexOf(delimiter);
  }

  // Повертаємо масив знайдених команд та залишок буфера (який чекає наступних даних)
  return {
    messages,
    remainingBuffer: currentBuffer
  };
}

/**
 * Функція аналізу отриманого тексту та формування відповіді сервера.
 * @param {string} message - текстове повідомлення/команда від клієнта
 * @param {net.Socket} socket - сокет клієнта (потрібен для закриття через EXIT)
 * @returns {string} текст відповіді сервера
 */
function handleCommand(message, socket) {
  // Розбиваємо рядок по пробілу: перше слово — команда, решта — аргументи
  const [command, ...args] = message.split(' ');
  const upperCmd = command.toUpperCase(); // Приводимо до верхнього регістру для регістронезалежності
  const payload = args.join(' ');          // Збираємо аргументи назад у суцільний рядок

  switch (upperCmd) {
    case 'HELLO':
      return '200 OK: Привіт!\n Соединение с TCP-сервером \n установлено.';

    case 'STATUS':
      // Обчислюємо обсяг використаної оперативної пам'яті процесом у МБ
      const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      return `200 OK: Сервер активен. Использование памяти: ${memoryUsage} MB.`;

    case 'ECHO':
      // Перевіряємо наявність аргументу після команди ECHO
      if (!payload) {
        return '400 BAD REQUEST: Команда ECHO требует текст (пример: ECHO Привет)';
      }
      return `200 ECHO: ${payload}`;

    case 'EXIT':
      // Затримуємо закриття сокета на 100 мс, щоб відповідь встигла повністю відправитися в мережу
      setTimeout(() => socket.end(), 100);
      return '200 OK: Завершение сеанса. До связи!';

    default:
      // Обробка невідомої команди
      return `404 UNKNOWN COMMAND: Неизвестная команда "${command}". Доступные команды: HELLO, STATUS, ECHO <текст>, EXIT`;
  }
}

// Запускаем сервер на прослушивание порта 3000
server.listen(CONFIG.PORT, CONFIG.HOST, () => {
  console.log(`[СЕРВЕР] Запущен и ожидает подключений на ${CONFIG.HOST}:${CONFIG.PORT}`);
});