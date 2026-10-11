const net = require('net');           // Вбудований модуль Node.js для роботи з низкорівневими TCP-сокетами
const readline = require('readline'); // Модуль для зчитування введення з консолі (терміналу)

// Об'єкт конфігурації мережевого підключення
const CONFIG = {
  HOST: '127.0.0.1', // IP-адреса сервера (localhost)
  PORT: 3000,        // Порт сервера
  DELIMITER: '\n'    // Символ-роздільник для визначення меж повідомлень
};

// Створюємо екземпляр TCP-сокета для клієнта
const client = new net.Socket();

// Глобальний для даного клієнтського модуля буфер накопичення байтів.
// Оголошений ЗОВНІ події 'data', щоб не скидатися при фрагментації даних мережі.
let buffer = '';

// Налаштовуємо інтерактивний інтерфейс зчитування з клавіатури (stdin/stdout)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 1. Ініціалізація підключення до сервера за заданою адресою та портом
client.connect(CONFIG.PORT, CONFIG.HOST, () => {
  console.log(`[КЛИЕНТ] Успешно подключено к серверу ${CONFIG.HOST}:${CONFIG.PORT}`);
  console.log('Доступные команды: HELLO, STATUS, ECHO <текст>, EXIT\n');

  // Запускаємо перше запитування введення команди у користувача
  promptUser();
});

// 2. Функція запиту введення команди з клавіатури
function promptUser() {
  rl.question('Введите команду > ', (input) => {
    const userInput = input.trim(); // Видаляємо зайві пробіли на початку та в кінці

    if (userInput.length > 0) {
      // Відправляємо команду в сокет, ОБОВ'ЯЗКОВО додаючи символ-роздільник '\n'
      client.write(userInput + CONFIG.DELIMITER);
    } else {
      // Якщо користувач просто натиснув Enter (порожній рядок) — запитуємо повторно
      promptUser();
    }
  });
}

// 3. Подія 'data': спрацьовує при отриманні відповіді (байтового потоку chunk) від сервера
client.on('data', (chunk) => {
  // Накапливаємо отримані байти, декодовані у UTF-8 рядок, у буфер клієнта
  buffer += chunk.toString('utf-8');

  // Витягуємо всі повністю сформовані відповіді з буфера
  const { messages, remainingBuffer } = extractMessages(buffer, CONFIG.DELIMITER);

  // Оновлюємо буфер залишком незавершених даних
  buffer = remainingBuffer;

  // Виводим кожну отриману від сервера відповідь у консоль
  messages.forEach((response) => {
    console.log(`\n[ОТВЕТ СЕРВЕРА]: ${response}`);
  });

  // Запитуємо наступне введення команди ровно ОДИН раз після обробки всіх відповідей у пакеті
  if (messages.length > 0) {
    console.log('');
    promptUser();
  }
});

/**
 * 4. Допоміжна функція парсингу буфера та розбиття його на окремі відповіді.
 * @param {string} currentBuffer - поточний накопичений рядок
 * @param {string} delimiter - символ-роздільник ('\n')
 * @returns {Object} { messages: Array, remainingBuffer: String }
 */
function extractMessages(currentBuffer, delimiter) {
  const messages = [];

  // Шукаємо перше входження символу '\n'
  let boundary = currentBuffer.indexOf(delimiter);

  // Доки в буфері є символ-роздільник, вирізаємо повні повідомлення
  while (boundary !== -1) {
    // Вирізаємо текст від початку (індекс 0) до розделітеля (не включаючи його)
    const message = currentBuffer.slice(0, boundary);

    // Перезаписуємо буфер, видаляючи опрацьовану частину РАЗОМ із символом '\n' (boundary + 1)
    currentBuffer = currentBuffer.slice(boundary + 1);

    // Зберігаємо вирізане повідомлення у масив
    messages.push(message);

    // Шукаємо наступний роздільник у залишку
    boundary = currentBuffer.indexOf(delimiter);
  }

  // Повертаємо масив знайдених відповідей та оновлений залишок буфера
  return {
    messages,
    remainingBuffer: currentBuffer
  };
}

// 5. Подія 'close': спрацьовує, коли сокет повністю закрився (наприклад, після команди EXIT)
client.on('close', () => {
  console.log('\n[КЛИЕНТ] Соединение с сервером закрыто.');
  rl.close();          // Закриваємо інтерфейс зчитування з клавіатури
  process.exit(0);     // Завершуємо процес Node.js
});

// 6. Подія 'error': обробка мережевих помилок (наприклад, сервер недоступний або впав)
client.on('error', (err) => {
  console.error('\n[КЛИЕНТ] Ошибка сети:', err.message);
  rl.close();
});