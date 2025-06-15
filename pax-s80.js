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

// نمایش پیام خطا
function showErrorMessage(messageText) {
    const message = document.getElementById('message');
    message.innerText = messageText;
    setTimeout(() => {
        message.innerText = '';
    }, 2000);
}

// فرمت‌بندی عدد با کاما و افزودن "ریال"
function formatNumberWithCommas(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ریال';
}

// افزودن عدد به ورودی
function appendNumber(number) {
    if (!isCardReaderConnected) {
        showErrorMessage('کارتخوان متصل نیست!');
        return;
    }
    const input = document.getElementById('amount-input');
    let currentValue = input.value.replace(/[^0-9]/g, '');
    currentValue += number;
    input.value = formatNumberWithCommas(currentValue);
}

// حذف یک رقم از ورودی
function backspace() {
    if (!isCardReaderConnected) {
        showErrorMessage('کارتخوان متصل نیست!');
        return;
    }
    const input = document.getElementById('amount-input');
    let currentValue = input.value.replace(/[^0-9]/g, '');
    currentValue = currentValue.slice(0, -1);
    input.value = currentValue ? formatNumberWithCommas(currentValue) : '';
}

// بررسی اتصال به کارتخوان PAX S80
async function checkCardReaderConnection() {
    try {
        const ports = await navigator.serial.getPorts();
        if (!serialPort && ports.length === 0) {
            isCardReaderConnected = false;
            disablePaymentButtons();
            return false;
        }

        if (!serialPort && ports.length > 0) {
            serialPort = ports[0];
            await serialPort.open({
                baudRate: 115200,
                dataBits: 8,
                stopBits: 1,
                parity: 'none'
            });
            isCardReaderConnected = true;
            enablePaymentButtons();
            showErrorMessage('متصل به کارتخوان PAX S80!');
            return true;
        }

        if (serialPort) {
            if (serialPort.readable && serialPort.writable) {
                isCardReaderConnected = true;
                enablePaymentButtons();
                return true;
            } else {
                serialPort = null;
                isCardReaderConnected = false;
                disablePaymentButtons();
                return await connectToSerial();
            }
        }

        return false;
    } catch (error) {
        isCardReaderConnected = false;
        disablePaymentButtons();
        showErrorMessage('خطا در بررسی اتصال کارتخوان: ' + error.message);
        console.log('Error in checkCardReaderConnection:', error);
        return false;
    }
}

// اتصال به پورت سریال PAX S80
async function connectToSerial() {
    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({
            baudRate: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        isCardReaderConnected = true;
        enablePaymentButtons();
        showErrorMessage('متصل به کارتخوان PAX S80!');
        return true;
    } catch (error) {
        isCardReaderConnected = false;
        disablePaymentButtons();
        showErrorMessage('خطا در اتصال به کارتخوان: ' + error.message);
        console.log('Error in connectToSerial:', error);
        return false;
    }
}

// ارسال داده به کارتخوان PAX S80
async function sendToCardReader(amount, paymentType) {
    if (!serialPort || !isCardReaderConnected) {
        showErrorMessage('ابتدا به کارتخوان متصل شوید!');
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
            setTimeout(() => reject(new Error('مهلت پاسخ دستگاه تمام شد')), 5000);
        });
        const { value, done } = await Promise.race([reader.read(), timeoutPromise]);
        reader.releaseLock();

        if (done || !value) {
            showErrorMessage('اتصال قطع شد یا پاسخی دریافت نشد!');
            console.log('No response or connection closed');
            return false;
        }

        const response = new TextDecoder().decode(value);
        console.log('Received from PAX S80:', response);
        if (response.includes('APPROVED') || response.includes('00')) {
            return true;
        } else {
            showErrorMessage('خطا در پرداخت: ' + response);
            return false;
        }
    } catch (error) {
        showErrorMessage('خطا در ارتباط با کارتخوان: ' + error.message);
        console.log('Error in sendToCardReader:', error);
        return false;
    }
}

// بستن پورت سریال
async function closeSerialPort() {
    if (serialPort) {
        await serialPort.close();
        serialPort = null;
        isCardReaderConnected = false;
        disablePaymentButtons();
        showErrorMessage('اتصال کارتخوان قطع شد.');
    }
}

// انتخاب مبالغ پیش‌فرض
function selectPredefinedAmount(amount) {
    if (!isCardReaderConnected) {
        showErrorMessage('کارتخوان متصل نیست!');
        return;
    }
    if (amount < 10000) {
        showErrorMessage('مبلغ نمی‌تواند کمتر از 10,000 ریال باشد!');
        return;
    }
    console.log('Processing predefined amount:', amount);
    processPayment(amount / 10);
}

// پردازش پرداخت
async function processPayment(amount) {
    if (!isCardReaderConnected) {
        showErrorMessage('کارتخوان متصل نیست!');
        return;
    }

    const message = document.getElementById('message');
    const receiptType = document.getElementById('receipt-type');
    const receiptAmount = document.getElementById('receipt-amount');
    const receiptDate = document.getElementById('receipt-date');
    const receiptStatus = document.getElementById('receipt-status');

    message.innerText = `لطفاً کارت خود را وارد کنید...\nدر حال پردازش پرداخت ${amount.toLocaleString('fa-IR')} تومان برای ${currentPaymentType}...`;

    setTimeout(async () => {
        const isSuccess = await sendToCardReader(amount, currentPaymentType);
        if (isSuccess) {
            message.innerText = 'پرداخت موفق! در حال چاپ رسید...';
            receiptType.innerText = `نوع پرداخت: ${currentPaymentType}`;
            receiptAmount.innerText = `مبلغ: ${amount.toLocaleString('fa-IR')} تومان`;
            receiptDate.innerText = `تاریخ: ${new Date().toLocaleString('fa-IR')}`;
            receiptStatus.innerText = 'پرداخت با موفقیت انجام شد.';
            document.getElementById('receipt').style.display = 'block';
            setTimeout(() => {
                window.print();
                backToMainMenu();
            }, 2000);
        } else {
            message.innerText = 'خطا در پرداخت! لطفاً دوباره تلاش کنید.';
            receiptStatus.innerText = 'پرداخت ناموفق بود.';
            setTimeout(() => {
                message.innerText = '';
                backToMainMenu();
            }, 2000);
        }
    }, 6000);
}

function showAmountMenu(type) {
    if (!isCardReaderConnected) {
        showErrorMessage('کارتخوان متصل نیست!');
        return;
    }
    console.log('نوع نمایش:', type);
    const mainMenu = document.querySelector('#main-menu');
    const amountMenu = document.querySelector('#amount-menu');
    const paymentTypeEl = document.querySelector('#payment-type');
    if (!mainMenu || !amountMenu || !paymentTypeEl) {
        console.error('One or more elements not found in showAmountMenu');
        return;
    }
    currentPaymentType = type;
    mainMenu.style.display = 'none';
    amountMenu.style.display = 'block';
    paymentTypeEl.innerText = type;
}

function backToMainMenu() {
    console.log('Back to main menu');
    const amountMenu = document.querySelector('#amount-menu');
    const customAmount = document.querySelector('#custom-amount');
    const receipt = document.querySelector('#receipt');
    const mainMenu = document.querySelector('#main-menu');
    const message = document.querySelector('#message');
    if (!amountMenu || !customAmount || !receipt || !mainMenu || !message) {
        console.error('One or more elements not found in backToMainMenu');
        return;
    }
    amountMenu.style.display = 'none';
    customAmount.style.display = 'none';
    receipt.style.display = 'none';
    mainMenu.style.display = 'block';
    message.innerText = '';
}

function showCustomAmount() {
    if (!isCardReaderConnected) {
        showErrorMessage('کارتخوان متصل نیست!');
        return;
    }
    console.log('Showing custom amount page');
    try {
        const amountMenu = document.querySelector('#amount-menu');
        const customAmount = document.querySelector('#custom-amount');
        const amountInput = document.querySelector('#amount-input');
        if (!amountMenu || !customAmount || !amountInput) {
            throw new Error('One or more elements not found in showCustomAmount');
        }
        amountMenu.style.display = 'none';
        customAmount.style.display = 'block';
        amountInput.value = '';
    } catch (error) {
        console.error(error.message);
        showErrorMessage('خطا در نمایش صفحه مبلغ دلخواه!');
    }
}

function backToAmountMenu() {
    if (!isCardReaderConnected) {
        showErrorMessage('کارتخوان متصل نیست!');
        return;
    }
    console.log('Back to amount menu');
    try {
        const customAmount = document.querySelector('#custom-amount');
        const amountMenu = document.querySelector('#amount-menu');
        const message = document.querySelector('#message');
        if (!customAmount || !amountMenu || !message) {
            throw new Error('One or more elements not found in backToAmountMenu');
        }
        customAmount.style.display = 'none';
        amountMenu.style.display = 'block';
        message.innerText = '';
    } catch (error) {
        console.error(error.message);
        showErrorMessage('خطا در بازگشت به منوی مبالغ!');
    }
}

// تأیید مبلغ دلخواه
function confirmCustomAmount() {
    if (!isCardReaderConnected) {
        showErrorMessage('کارتخوان متصل نیست!');
        return;
    }
    const input = document.getElementById('amount-input');
    const amount = parseInt(input.value.replace(/[^0-9]/g, ''));
    if (isNaN(amount) || amount <= 0) {
        showErrorMessage('لطفاً مبلغ معتبر وارد کنید!');
        return;
    }
    if (amount < 10000) {
        showErrorMessage('مبلغ نمی‌تواند کمتر از 10,000 ریال باشد!');
        return;
    }
    console.log('Processing custom amount:', amount);
    processPayment(amount / 10);
}

// بررسی اتصال هنگام بارگذاری صفحه
window.addEventListener('load', async () => {
    await checkCardReaderConnection();
});