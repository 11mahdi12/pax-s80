// تنظیمات برنامه
const config = {
    quotes: [
        "«خداوند به کسانی که در راه خیر قدم برمی‌دارند، برکت می‌دهد.»",
        "«چو نیکی کنی، نیکی به تو بازگردد.»",
        "«سعادت آن است که دیگران را خوشحال کنی.» - سعدی",
        "«دست که دادی، دل نیز بده.»",
        "«هر که خیر دیگران خواهد، خیرش به او بازآید.»"
    ],
    messages: {
        connected: "متصل به کارتخوان PAX S80!",
        disconnected: "اتصال کارتخوان قطع شد.",
        invalidAmount: "لطفاً مبلغ معتبر وارد کنید!",
        minAmountError: "مبلغ نمی‌تواند کمتر از 10,000 ریال باشد!",
        connectionError: "خطا در اتصال به کارتخوان: ",
        paymentError: "خطا در پرداخت: ",
        timeoutError: "مهلت پاسخ دستگاه تمام شد",
        noResponse: "اتصال قطع شد یا پاسخی دریافت نشد!",
        processingPayment: (amount, type) => `لطفاً کارت خود را وارد کنید...\nدر حال پردازش پرداخت ${amount.toLocaleString('fa-IR')} تومان برای ${type}...`,
        paymentSuccess: "پرداخت موفق! در حال چاپ رسید...",
        paymentFailed: "خطا در پرداخت! لطفاً دوباره تلاش کنید.",
        elementNotFound: "خطا در دسترسی به عناصر صفحه!",
        customAmountError: "خطا در نمایش صفحه مبلغ دلخواه!",
        amountMenuError: "خطا در بازگشت به منوی مبالغ!"
    },
    minAmount: 10000,
    serialConfig: {
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
    },
    timeout: 5000
};

// ذخیره عناصر DOM برای دسترسی سریع
const elements = {
    mainMenu: document.querySelector('#main-menu'),
    amountMenu: document.querySelector('#amount-menu'),
    customAmount: document.querySelector('#custom-amount'),
    receipt: document.querySelector('#receipt'),
    statusMessage: document.querySelector('#status-message'),
    paymentType: document.querySelector('#payment-type'),
    amountInput: document.querySelector('#amount-input'),
    receiptType: document.querySelector('#receipt-type'),
    receiptAmount: document.querySelector('#receipt-amount'),
    receiptDate: document.querySelector('#receipt-date'),
    receiptStatus: document.querySelector('#receipt-status'),
    receiptStatusMessage: document.querySelector('#receipt-status-message'),
    receiptImage: document.querySelector('#receipt-image'),
    receiptTime: document.querySelector('#receipt-time'),
    receiptDateWeekday: document.querySelector('#receipt-date-weekday'),
    receiptQuote: document.querySelector('#receipt-quote')
};

let currentPaymentType = '';
let serialPort = null;
let isCardReaderConnected = false;

// غیرفعال کردن دکمه‌های پرداخت
function disablePaymentButtons() {
    const buttons = document.querySelectorAll('#sadaqeh-btn, #orphans-btn, #fitr-btn, .amount-button, .keyboard-button');
    buttons.forEach(button => button.disabled = true);
}

// فعال کردن دکمه‌های پرداخت
function enablePaymentButtons() {
    const buttons = document.querySelectorAll('#sadaqeh-btn, #orphans-btn, #fitr-btn, .amount-button, .keyboard-button');
    buttons.forEach(button => button.disabled = false);
}

// نمایش پیام وضعیت
function showStatusMessage(messageText) {
    elements.statusMessage.textContent = messageText;
    setTimeout(() => {
        elements.statusMessage.textContent = '';
    }, 3000);
}

// فرمت‌بندی عدد با کاما و افزودن "ریال"
function formatNumberWithCommas(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ریال';
}

// افزودن عدد به ورودی
function appendNumber(number) {
    try {
        let currentValue = elements.amountInput.value.replace(/[^0-9]/g, '');
        currentValue += number;
        elements.amountInput.value = formatNumberWithCommas(currentValue);
    } catch (error) {
        console.error('Error in appendNumber:', error);
        showStatusMessage(config.messages.elementNotFound);
    }
}

// حذف یک رقم از ورودی
function backspace() {
    try {
        let currentValue = elements.amountInput.value.replace(/[^0-9]/g, '');
        currentValue = currentValue.slice(0, -1);
        elements.amountInput.value = currentValue ? formatNumberWithCommas(currentValue) : '';
    } catch (error) {
        console.error('Error in backspace:', error);
        showStatusMessage(config.messages.elementNotFound);
    }
}

// بررسی پشتیبانی مرورگر از API سریال
function isSerialSupported() {
    return 'serial' in navigator;
}

// بررسی اتصال به کارتخوان PAX S80
async function checkCardReaderConnection() {
    try {
        if (!isSerialSupported()) {
            throw new Error('مرورگر شما از API سریال پشتیبانی نمی‌کند.');
        }
        const ports = await navigator.serial.getPorts();
        if (!serialPort && ports.length === 0) {
            isCardReaderConnected = false;
            disablePaymentButtons();
            return false;
        }

        if (!serialPort && ports.length > 0) {
            serialPort = ports[0];
            await serialPort.open(config.serialConfig);
            isCardReaderConnected = true;
            enablePaymentButtons();
            showStatusMessage(config.messages.connected);
            return true;
        }

        if (serialPort && serialPort.readable && serialPort.writable) {
            isCardReaderConnected = true;
            enablePaymentButtons();
            return true;
        } else {
            serialPort = null;
            isCardReaderConnected = false;
            disablePaymentButtons();
            return await connectToSerial();
        }
    } catch (error) {
        isCardReaderConnected = false;
        disablePaymentButtons();
        showStatusMessage(config.messages.connectionError + error.message);
        console.error('Error in checkCardReaderConnection:', error);
        return false;
    }
}

// اتصال به پورت سریال PAX S80
async function connectToSerial() {
    try {
        if (!isSerialSupported()) {
            throw new Error('مرورگر شما از API سریال پشتیبانی نمی‌کند.');
        }
        serialPort = await navigator.serial.requestPort();
        await serialPort.open(config.serialConfig);
        isCardReaderConnected = true;
        enablePaymentButtons();
        showStatusMessage(config.messages.connected);
        return true;
    } catch (error) {
        isCardReaderConnected = false;
        disablePaymentButtons();
        showStatusMessage(config.messages.connectionError + error.message);
        console.error('Error in connectToSerial:', error);
        return false;
    }
}

// ارسال داده به کارتخوان PAX S80
async function sendToCardReader(amount, paymentType) {
    if (!serialPort || !isCardReaderConnected) {
        showStatusMessage(config.messages.connectionError + 'کارتخوان متصل نیست!');
        return false;
    }

    try {
        const refId = `REF${Date.now()}`;
        const terminalId = 'TERMID123';
        const dataToSend = `T01|PUR|${amount * 100}|${paymentType}|${refId}|${terminalId}\n`;
        console.log('Sending to PAX S80:', dataToSend);
        const writer = serialPort.writable.getWriter();
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(dataToSend));
        writer.releaseLock();

        const reader = serialPort.readable.getReader();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(config.messages.timeoutError)), config.timeout);
        });
        const { value, done } = await Promise.race([reader.read(), timeoutPromise]);
        reader.releaseLock();

        if (done || !value) {
            showStatusMessage(config.messages.noResponse);
            console.log('No response or connection closed');
            return false;
        }

        const response = new TextDecoder().decode(value);
        console.log('Received from PAX S80:', response);
        if (response.includes('APPROVED') || response.includes('00')) {
            return true;
        } else {
            showStatusMessage(config.messages.paymentError + response);
            return false;
        }
    } catch (error) {
        showStatusMessage(config.messages.connectionError + error.message);
        console.error('Error in sendToCardReader:', error);
        return false;
    }
}

// بستن پورت سریال
async function closeSerialPort() {
    try {
        if (serialPort) {
            await serialPort.close();
            serialPort = null;
            isCardReaderConnected = false;
            disablePaymentButtons();
            showStatusMessage(config.messages.disconnected);
        }
    } catch (error) {
        console.error('Error in closeSerialPort:', error);
        showStatusMessage(config.messages.connectionError + error.message);
    }
}

// تولید رسید پویا به‌صورت PNG
async function generateReceiptImage() {
    try {
        const receiptElement = elements.receipt;
        const canvas = await html2canvas(receiptElement, { scale: 2 });
        elements.receiptImage.src = canvas.toDataURL('image/png');
    } catch (error) {
        console.error('Error in generateReceiptImage:', error);
        showStatusMessage('خطا در تولید تصویر رسید!');
    }
}

// انتخاب مبالغ پیش‌فرض
function selectPredefinedAmount(amount) {
    try {
        if (amount < config.minAmount) {
            showStatusMessage(config.messages.minAmountError);
            return;
        }
        console.log('Processing predefined amount:', amount);
        processPayment(amount / 10);
    } catch (error) {
        console.error('Error in selectPredefinedAmount:', error);
        showStatusMessage(config.messages.elementNotFound);
    }
}

// پردازش پرداخت
async function processPayment(amount) {
    try {
        const now = new Date();
        elements.statusMessage.textContent = config.messages.processingPayment(amount, currentPaymentType);
        elements.receiptTime.textContent = `ساعت: ${now.toLocaleTimeString('fa-IR')}`;
        elements.receiptDateWeekday.textContent = `${now.toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
        elements.receiptQuote.textContent = config.quotes[Math.floor(Math.random() * config.quotes.length)];

        const isSuccess = await sendToCardReader(amount, currentPaymentType);
        elements.receiptType.textContent = `نوع پرداخت: ${currentPaymentType}`;
        elements.receiptAmount.textContent = `مبلغ: ${amount.toLocaleString('fa-IR')} تومان`;
        elements.receiptDate.textContent = `تاریخ: ${now.toLocaleString('fa-IR')}`;

        if (isSuccess) {
            elements.statusMessage.textContent = config.messages.paymentSuccess;
            elements.receiptStatusMessage.textContent = 'پرداخت موفق';
            elements.receiptStatusMessage.classList.remove('error');
            elements.receiptStatus.textContent = 'پرداخت با موفقیت انجام شد.';
            elements.receipt.style.display = 'block';
            await generateReceiptImage();
            setTimeout(() => {
                window.print();
                backToMainMenu();
            }, 2000);
        } else {
            elements.statusMessage.textContent = config.messages.paymentFailed;
            elements.receiptStatusMessage.textContent = 'پرداخت ناموفق';
            elements.receiptStatusMessage.classList.add('error');
            elements.receiptStatus.textContent = 'پرداخت ناموفق بود.';
            elements.receipt.style.display = 'block';
            setTimeout(() => {
                elements.statusMessage.textContent = '';
                backToMainMenu();
            }, 2000);
        }
    } catch (error) {
        console.error('Error in processPayment:', error);
        showStatusMessage(config.messages.elementNotFound);
    }
}

// نمایش منوی مبالغ
function showAmountMenu(type) {
    try {
        console.log('نوع نمایش:', type);
        if (!elements.mainMenu || !elements.amountMenu || !elements.paymentType) {
            throw new Error('One or more elements not found in showAmountMenu');
        }
        currentPaymentType = type;
        elements.mainMenu.style.display = 'none';
        elements.amountMenu.style.display = 'block';
        elements.paymentType.textContent = type;
    } catch (error) {
        console.error('Error in showAmountMenu:', error);
        showStatusMessage(config.messages.elementNotFound);
    }
}

// بازگشت به منوی اصلی
function backToMainMenu() {
    try {
        console.log('Back to main menu');
        if (!elements.amountMenu || !elements.customAmount || !elements.receipt || !elements.mainMenu || !elements.statusMessage) {
            throw new Error('One or more elements not found in backToMainMenu');
        }
        elements.amountMenu.style.display = 'none';
        elements.customAmount.style.display = 'none';
        elements.receipt.style.display = 'none';
        elements.mainMenu.style.display = 'block';
        elements.statusMessage.textContent = '';
    } catch (error) {
        console.error('Error in backToMainMenu:', error);
        showStatusMessage(config.messages.elementNotFound);
    }
}

// نمایش صفحه مبلغ دلخواه
function showCustomAmount() {
    try {
        console.log('Showing custom amount page');
        if (!elements.amountMenu || !elements.customAmount || !elements.amountInput) {
            throw new Error('One or more elements not found in showCustomAmount');
        }
        elements.amountMenu.style.display = 'none';
        elements.customAmount.style.display = 'block';
        elements.amountInput.value = '';
    } catch (error) {
        console.error('Error in showCustomAmount:', error);
        showStatusMessage(config.messages.customAmountError);
    }
}

// بازگشت به منوی مبالغ
function backToAmountMenu() {
    try {
        console.log('Back to amount menu');
        if (!elements.customAmount || !elements.amountMenu || !elements.statusMessage) {
            throw new Error('One or more elements not found in backToAmountMenu');
        }
        elements.customAmount.style.display = 'none';
        elements.amountMenu.style.display = 'block';
        elements.statusMessage.textContent = '';
    } catch (error) {
        console.error('Error in backToAmountMenu:', error);
        showStatusMessage(config.messages.amountMenuError);
    }
}

// تأیید مبلغ دلخواه
function confirmCustomAmount() {
    try {
        const amount = parseInt(elements.amountInput.value.replace(/[^0-9]/g, ''));
        if (isNaN(amount) || amount <= 0) {
            showStatusMessage(config.messages.invalidAmount);
            return;
        }
        if (amount < config.minAmount) {
            showStatusMessage(config.messages.minAmountError);
            return;
        }
        console.log('Processing custom amount:', amount);
        processPayment(amount / 10);
    } catch (error) {
        console.error('Error in confirmCustomAmount:', error);
        showStatusMessage(config.messages.elementNotFound);
    }
}

// بررسی اتصال هنگام بارگذاری صفحه
window.addEventListener('load', async () => {
    await checkCardReaderConnection();
});