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
        maxAmountError: "مبلغ نمی‌تواند بیش از 100,000,000 تومان باشد!",
        maxDigitsError: "مبلغ نمی‌تواند بیش از 10 رقم باشد!",
        connectionError: "خطا در اتصال به کارتخوان!",
        paymentError: "خطا در پرداخت! لطفاً دوباره تلاش کنید.",
        timeoutError: "مهلت پاسخ دستگاه تمام شد!",
        noResponse: "اتصال قطع شد یا پاسخی دریافت نشد!",
        invalidResponse: "پاسخ کارتخوان نامعتبر است!",
        processingPayment: (amount, type) => `لطفاً کارت خود را وارد کنید...\nدر حال پردازش ${amount.toLocaleString('fa-IR')} تومان برای ${type}...`,
        paymentSuccess: "پرداخت موفق! در حال چاپ رسید...",
        paymentFailed: "پرداخت ناموفق! لطفاً دوباره تلاش کنید.",
        elementNotFound: "خطا در بارگذاری صفحه! لطفاً دوباره امتحان کنید.",
        customAmountError: "خطا در نمایش صفحه مبلغ دلخواه!",
        amountMenuError: "خطا در بازگشت به منوی مبالغ!",
        receiptGenerationError: "خطا در تولید تصویر رسید! رسید بدون تصویر نمایش داده می‌شود.",
        browserNotSupported: "مرورگر شما از این قابلیت پشتیبانی نمی‌کند!",
        html2canvasError: "خطا در بارگذاری ابزار تولید تصویر رسید!",
        fontLoading: "در حال بارگذاری فونت...",
        printError: "خطا در چاپ رسید! لطفاً پرینتر جداگانه را بررسی کنید.",
        printCancelled: "چاپ رسید لغو شد! لطفاً دوباره تلاش کنید یا پرینتر را بررسی کنید.",
        encodingError: "خطا در پردازش داده‌های کارتخوان!",
        portLockedError: "پورت سریال قفل شده است! لطفاً دستگاه را بررسی کنید.",
        imageLoadError: "خطا در بارگذاری لوگو! از لوگوی جایگزین استفاده شد."
    },
    minAmount: 10000,
    maxAmount: 1000000000, // 100 میلیون تومان (به ریال)
    maxDigits: 10,
    serialConfig: {
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
    },
    timeout: 10000, // Timeout 10 ثانیه
    debounceDelay: 500 // تأخیر برای جلوگیری از کلیک‌های مکرر
};

// ذخیره عناصر DOM برای دسترسی سریع
const elements = (() => {
    const requiredElements = {
        mainMenu: document.querySelector('#main-menu'),
        amountMenu: document.querySelector('#amount-menu'),
        customAmount: document.querySelector('#custom-amount'),
        successReceipt: document.querySelector('#success-recept'),
        failedReceipt: document.querySelector('#failed-recept'),
        statusMessage: document.querySelector('#status-message'),
        paymentType: document.querySelector('#payment-type'),
        amountInput: document.querySelector('#amount-input'),
        successReceiptType: document.querySelector('#success-recept-type'),
        successReceiptAmount: document.querySelector('#success-recept-amount'),
        successReceiptStatus: document.querySelector('#success-recept-status'),
        successReceiptStatusMessage: document.querySelector('#success-recept-status-message'),
        successReceiptImage: document.querySelector('#success-recept-image'),
        successReceiptTime: document.querySelector('#success-recept-time'),
        successReceiptDateWeekday: document.querySelector('#success-recept-date-weekday'),
        successReceiptQuote: document.querySelector('#success-recept-quote'),
        failedReceiptType: document.querySelector('#failed-recept-type'),
        failedReceiptAmount: document.querySelector('#failed-recept-amount'),
        failedReceiptStatus: document.querySelector('#failed-recept-status'),
        failedReceiptStatusMessage: document.querySelector('#failed-recept-status-message'),
        failedReceiptImage: document.querySelector('#failed-recept-image'),
        failedReceiptTime: document.querySelector('#failed-recept-time'),
        failedReceiptDateWeekday: document.querySelector('#failed-recept-date-weekday'),
        failedReceiptQuote: document.querySelector('#failed-recept-quote'),
        paymentButtons: document.querySelectorAll('#sadaqeh-btn, #orphans-btn, #fitr-btn'), // فقط دکمه‌های پرداخت
        connectButton: document.querySelector('#connect-btn') // دکمه اتصال جداگانه
    };

    // بررسی وجود تمام عناصر
    for (const [key, value] of Object.entries(requiredElements)) {
        if (!value || (key === 'paymentButtons' && value.length === 0)) {
            console.error(`Element ${key} not found in DOM`);
            document.body.innerHTML = '<p style="color: red; text-align: center;">خطا: صفحه به درستی بارگذاری نشد. لطفاً دوباره امتحان کنید.</p>';
            throw new Error(`Element ${key} not found`);
        }
    }
    return requiredElements;
})();

let currentPaymentType = '';
let serialPort = null;
let isCardReaderConnected = false;
let lastClickTime = 0;
let statusMessageTimeout = null;

// غیرفعال کردن دکمه‌های پرداخت (به جز دکمه اتصال)
function disablePaymentButtons() {
    elements.paymentButtons.forEach(button => button.disabled = true);
}

// فعال کردن دکمه‌های پرداخت
function enablePaymentButtons() {
    elements.paymentButtons.forEach(button => button.disabled = false);
}

// نمایش پیام وضعیت با مدیریت پویا
function showStatusMessage(messageText) {
    if (statusMessageTimeout) {
        clearTimeout(statusMessageTimeout);
    }
    elements.statusMessage.textContent = messageText;
    statusMessageTimeout = setTimeout(() => {
        elements.statusMessage.textContent = '';
        statusMessageTimeout = null;
    }, 4000);
}

// فرمت‌بندی عدد با کاما و افزودن "ریال"
function formatNumberWithCommas(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ریال';
}

// افزودن عدد به ورودی
function appendNumber(number) {
    try {
        let currentValue = elements.amountInput.value.replace(/[^0-9]/g, '');
        if (currentValue.length >= config.maxDigits) {
            showStatusMessage(config.messages.maxDigitsError);
            return;
        }
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

// بررسی پشتیبانی مرورگر از APIهای مورد نیاز
function isBrowserSupported() {
    try {
        return 'serial' in navigator && !!TextEncoder && !!TextDecoder;
    } catch (error) {
        return false;
    }
}

// بررسی اتصال به کارتخوان PAX S80
async function checkCardReaderConnection() {
    try {
        if (!isBrowserSupported()) {
            throw new Error(config.messages.browserNotSupported);
        }
        showStatusMessage(config.messages.checkingConnection);

        // تلاش برای بستن پورت‌های باز قبلی
        if (serialPort) {
            await closeSerialPort();
        }

        const ports = await navigator.serial.getPorts();
        if (!serialPort && ports.length === 0) {
            isCardReaderConnected = false;
            disablePaymentButtons();
            return false;
        }

        if (!serialPort && ports.length > 0) {
            serialPort = ports[0];
            const portInfo = serialPort.getInfo();
            console.log('Port info:', portInfo);
            try {
                await serialPort.open(config.serialConfig);
            } catch (error) {
                throw new Error(config.messages.portLockedError);
            }
            isCardReaderConnected = true;
            enablePaymentButtons();
            showStatusMessage(config.messages.connected);
            return true;
        }

        if (serialPort && serialPort.readable && serialPort.writable) {
            isCardReaderConnected = true;
            enablePaymentButtons();
            showStatusMessage(config.messages.connected);
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
        showStatusMessage(error.message || config.messages.connectionError);
        console.error('Error in checkCardReaderConnection:', error);
        return false;
    }
}

// اتصال به پورت سریال PAX S80
async function connectToSerial() {
    try {
        if (!isBrowserSupported()) {
            throw new Error(config.messages.browserNotSupported);
        }
        serialPort = await navigator.serial.requestPort();
        const portInfo = serialPort.getInfo();
        console.log('Selected port info:', portInfo);
        try {
            await serialPort.open(config.serialConfig);
        } catch (error) {
            throw new Error(config.messages.portLockedError);
        }
        isCardReaderConnected = true;
        enablePaymentButtons();
        showStatusMessage(config.messages.connected);
        return true;
    } catch (error) {
        isCardReaderConnected = false;
        disablePaymentButtons();
        showStatusMessage(error.message || config.messages.connectionError);
        console.error('Error in connectToSerial:', error);
        return false;
    }
}

// ارسال داده به کارتخوان PAX S80
async function sendToCardReader(amount, paymentType) {
    if (!serialPort || !isCardReaderConnected) {
        showStatusMessage(config.messages.connectionError);
        return false;
    }

    try {
        const refId = `REF${Date.now()}`;
        const terminalId = 'TERMID123';
        const dataToSend = `T01|PUR|${amount * 100}|${paymentType}|${refId}|${terminalId}\n`;
        console.log('Sending to PAX S80:', dataToSend);

        let encoder;
        try {
            encoder = new TextEncoder();
        } catch (error) {
            throw new Error(config.messages.encodingError);
        }

        const writer = serialPort.writable.getWriter();
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

        let response;
        try {
            response = new TextDecoder().decode(value);
        } catch (error) {
            throw new Error(config.messages.encodingError);
        }

        console.log('Received from PAX S80:', response);
        const successPattern = /(APPROVED|00)/;
        if (successPattern.test(response)) {
            return true;
        } else {
            showStatusMessage(config.messages.invalidResponse);
            console.log('Invalid response from card reader');
            return false;
        }
    } catch (error) {
        showStatusMessage(error.message || config.messages.connectionError);
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
        showStatusMessage(config.messages.connectionError);
    }
}

// تولید رسید پویا به‌صورت PNG
async function generateReceiptImage(receiptElement, imageElement) {
    try {
        if (window.html2canvasFailed || typeof html2canvas === 'undefined') {
            throw new Error(config.messages.html2canvasError);
        }
        // بررسی حافظه تقریبی
        if ('performance' in window && 'memory' in performance && performance.memory.usedJSHeapSize > performance.memory.jsHeapSizeLimit * 0.9) {
            throw new Error('حافظه مرورگر کافی نیست!');
        }
        const canvas = await html2canvas(receiptElement, {
            scale: 3, // افزایش کیفیت برای پرینترهای جداگانه
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        imageElement.src = canvas.toDataURL('image/png');
        imageElement.style.display = 'block';
        return true;
    } catch (error) {
        console.error('Error in generateReceiptImage:', error);
        showStatusMessage(config.messages.receiptGenerationError);
        imageElement.style.display = 'none';
        return false;
    }
}

// انتخاب مبالغ پیش‌فرض با debounce
function selectPredefinedAmount(amount) {
    const now = Date.now();
    if (now - lastClickTime < config.debounceDelay) return;
    lastClickTime = now;

    try {
        if (amount < config.minAmount) {
            showStatusMessage(config.messages.minAmountError);
            return;
        }
        if (amount > config.maxAmount) {
            showStatusMessage(config.messages.maxAmountError);
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
        const formatter = new Intl.DateTimeFormat('fa-IR', {
            timeStyle: 'medium',
            dateStyle: 'full'
        });
        if (statusMessageTimeout) {
            clearTimeout(statusMessageTimeout);
        }
        elements.statusMessage.textContent = config.messages.processingPayment(amount, currentPaymentType);

        let printAttempted = false;
        let printSuccess = false;
        window.onbeforeprint = () => { printAttempted = true; };
        window.onafterprint = () => { printSuccess = true; };

        const receiptElements = {
            success: {
                container: elements.successReceipt,
                type: elements.successReceiptType,
                amount: elements.successReceiptAmount,
                status: elements.successReceiptStatus,
                statusMessage: elements.successReceiptStatusMessage,
                image: elements.successReceiptImage,
                time: elements.successReceiptTime,
                dateWeekday: elements.successReceiptDateWeekday,
                quote: elements.successReceiptQuote
            },
            failed: {
                container: elements.failedReceipt,
                type: elements.failedReceiptType,
                amount: elements.failedReceiptAmount,
                status: elements.failedReceiptStatus,
                statusMessage: elements.failedReceiptStatusMessage,
                image: elements.failedReceiptImage,
                time: elements.failedReceiptTime,
                dateWeekday: elements.failedReceiptDateWeekday,
                quote: elements.failedReceiptQuote
            }
        };

        const isSuccess = await sendToCardReader(amount, currentPaymentType);
        const receipt = isSuccess ? receiptElements.success : receiptElements.failed;

        receipt.time.textContent = `ساعت: ${new Intl.DateTimeFormat('fa-IR', { timeStyle: 'medium' }).format(now)}`;
        receipt.dateWeekday.textContent = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
        receipt.quote.textContent = config.quotes[Math.floor(Math.random() * config.quotes.length)];
        receipt.type.textContent = `نوع پرداخت: ${currentPaymentType}`;
        receipt.amount.textContent = `مبلغ: ${amount.toLocaleString('fa-IR')} تومان`;
        receipt.status.textContent = isSuccess ? 'پرداخت با موفقیت انجام شد.' : 'پرداخت ناموفق بود.';
        receipt.statusMessage.textContent = isSuccess ? 'پرداخت موفق' : 'پرداخت ناموفق';

        receipt.container.style.display = 'block';
        const imageGenerated = await generateReceiptImage(receipt.container, receipt.image);

        if (isSuccess) {
            elements.statusMessage.textContent = config.messages.paymentSuccess;
            setTimeout(() => {
                try {
                    window.print();
                } catch (error) {
                    showStatusMessage(config.messages.printError);
                    console.error('Print error:', error);
                }
                setTimeout(() => {
                    if (printAttempted && !printSuccess) {
                        showStatusMessage(config.messages.printCancelled);
                    } else if (!printSuccess) {
                        showStatusMessage(config.messages.printError);
                    }
                    backToMainMenu();
                }, 500);
            }, 3000);
        } else {
            elements.statusMessage.textContent = config.messages.paymentFailed;
            setTimeout(() => {
                elements.statusMessage.textContent = '';
                backToMainMenu();
            }, 3000);
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
        elements.amountMenu.style.display = 'none';
        elements.customAmount.style.display = 'none';
        elements.successReceipt.style.display = 'none';
        elements.failedReceipt.style.display = 'none';
        elements.mainMenu.style.display = 'block';
        elements.statusMessage.textContent = '';
        elements.successReceiptImage.src = '';
        elements.successReceiptImage.style.display = 'none';
        elements.failedReceiptImage.src = '';
        elements.failedReceiptImage.style.display = 'none';
        currentPaymentType = '';
    } catch (error) {
        console.error('Error in backToMainMenu:', error);
        showStatusMessage(config.messages.elementNotFound);
    }
}

// نمایش صفحه مبلغ دلخواه
function showCustomAmount() {
    try {
        console.log('Showing custom amount page');
        elements.amountMenu.style.display = 'none';
        elements.customAmount.style.display = 'block';
        elements.amountInput.value = '';
        elements.amountInput.focus();
    } catch (error) {
        console.error('Error in showCustomAmount:', error);
        showStatusMessage(config.messages.customAmountError);
    }
}

// بازگشت به منوی مبالغ
function backToAmountMenu() {
    try {
        console.log('Back to amount menu');
        elements.customAmount.style.display = 'none';
        elements.amountMenu.style.display = 'block';
        elements.statusMessage.textContent = '';
    } catch (error) {
        console.error('Error in backToAmountMenu:', error);
        showStatusMessage(config.messages.amountMenuError);
    }
}

// تأیید مبلغ دلخواه با debounce
function confirmCustomAmount() {
    const now = Date.now();
    if (now - lastClickTime < config.debounceDelay) return;
    lastClickTime = now;

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
        if (amount > config.maxAmount) {
            showStatusMessage(config.messages.maxAmountError);
            return;
        }
        if (amount.toString().length > config.maxDigits) {
            showStatusMessage(config.messages.maxDigitsError);
            return;
        }
        console.log('Processing custom amount:', amount);
        processPayment(amount / 10);
    } catch (error) {
        console.error('Error in confirmCustomAmount:', error);
        showStatusMessage(config.messages.elementNotFound);
    }
}

// نمایش پیام موقت برای بارگذاری فونت
function showFontLoadingMessage() {
    showStatusMessage(config.messages.fontLoading);
    setTimeout(() => {
        if (document.fonts && document.fonts.check('16px Vazir')) {
            elements.statusMessage.textContent = '';
        }
    }, 2000);
}

// بستن پورت سریال هنگام خروج از صفحه
window.addEventListener('unload', async () => {
    await closeSerialPort();
});

// غیرفعال کردن دکمه‌های پرداخت در ابتدای بارگذاری
disablePaymentButtons();

// بررسی اتصال و فونت هنگام بارگذاری صفحه
window.addEventListener('load', async () => {
    // اطمینان از تکمیل DOM
    if (document.readyState === 'complete') {
        disablePaymentButtons(); // غیرفعال کردن دکمه‌های پرداخت در ابتدا
        elements.connectButton.disabled = false; // دکمه اتصال همیشه فعال
        showFontLoadingMessage();
        await checkCardReaderConnection();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            disablePaymentButtons(); // غیرفعال کردن دکمه‌های پرداخت در ابتدا
            elements.connectButton.disabled = false; // دکمه اتصال همیشه فعال
            showFontLoadingMessage();
            checkCardReaderConnection();
        }, { once: true });
    }
});