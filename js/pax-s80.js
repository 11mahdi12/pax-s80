// مدیریت وضعیت برنامه
const PaymentApp = (() => {
    // تنظیمات برنامه
    const config = {
        quotes: [
            "خداوند به کسانی که در راه خیر قدم برمی‌دارند، برکت می‌دهد.",
            "چو نیکی کنی، نیکی به تو بازگردد.",
            "سعادت آن است که دیگران را خوشحال کنی. - سعدی",
            "دست که دادی، دل نیز بده.",
            "هر که خیر دیگران خواهد، خیرش به او بازآید."
        ],
        messages: {
            connected: "✅ متصل به کارتخوان PAX S80",
            disconnected: "⚠️ اتصال کارتخوان قطع شد",
            invalidAmount: "❌ لطفاً مبلغ معتبر وارد کنید",
            minAmountError: "❌ مبلغ نمی‌تواند کمتر از 10,000 ریال باشد",
            maxAmountError: "❌ مبلغ نمی‌تواند بیش از 100,000,000 تومان باشد",
            maxDigitsError: "❌ مبلغ نمی‌تواند بیش از 10 رقم باشد",
            connectionError: "❌ خطا در اتصال به کارتخوان از طریق شبکه",
            paymentError: "❌ خطا در پرداخت! لطفاً دوباره تلاش کنید",
            timeoutError: "⏳ مهلت پاسخ دستگاه تمام شد",
            noResponse: "🔌 اتصال شبکه قطع شد یا پاسخی دریافت نشد",
            invalidResponse: "❌ پاسخ کارتخوان نامعتبر است",
            processingPayment: (amount, type) => 
                `💳 لطفاً کارت خود را وارد کنید...\nدر حال پردازش ${amount.toLocaleString('fa-IR')} تومان برای ${type}`,
            paymentSuccess: "✅ پرداخت موفق! در حال چاپ رسید...",
            paymentFailed: "❌ پرداخت ناموفق! لطفاً دوباره تلاش کنید",
            customAmountError: "⚠️ خطا در نمایش صفحه مبلغ دلخواه",
            receiptGenerationError: "⚠️ خطا در تولید رسید",
            wsConnectionError: "❌ خطا در برقراری اتصال WebSocket",
            wsClosedError: "⚠️ اتصال WebSocket بسته شد"
        },
        minAmount: 10000,
        maxAmount: 1000000000,
        maxDigits: 10,
        wsConfig: {
            wsUrl: 'ws://192.168.1.100:12345',
            terminalId: 'TERMID123',
            merchantId: 'MERCH123'
        },
        timeout: 10000,
        debounceDelay: 500
    };

    // وضعیت برنامه
    const state = {
        ws: null,
        isCardReaderConnected: false,
        isConnecting: false,
        isProcessingPayment: false,
        currentPaymentType: '',
        lastClickTime: 0,
        statusTimeout: null
    };

    // عناصر DOM
    const elements = {
        screens: {
            main: document.getElementById('main-menu'),
            amount: document.getElementById('amount-menu'),
            customAmount: document.getElementById('custom-amount'),
            successReceipt: document.getElementById('success-recept'),
            failedReceipt: document.getElementById('failed-recept')
        },
        buttons: {
            connect: document.getElementById('connect-btn'),
            payment: [
                document.getElementById('sadaqeh-btn'),
                document.getElementById('orphans-btn'),
                document.getElementById('fitr-btn')
            ],
            amount: document.querySelectorAll('.amount-button'),
            keyboard: document.querySelectorAll('.keyboard-button'),
            backspace: document.getElementById('backspace-btn'),
            confirmAmount: document.getElementById('confirm-amount-btn'),
            backToMain: document.getElementById('back-to-main-btn'),
            backToAmount: document.getElementById('back-to-amount-btn'),
            successBack: document.getElementById('success-back-btn'),
            failedBack: document.getElementById('failed-back-btn'),
            customAmount: document.getElementById('custom-amount-btn')
        },
        fields: {
            paymentType: document.getElementById('payment-type'),
            amountInput: document.getElementById('amount-input'),
            statusMessage: document.getElementById('status-message'),
            success: {
                type: document.getElementById('success-recept-type'),
                amount: document.getElementById('success-recept-amount'),
                status: document.getElementById('success-recept-status'),
                statusMessage: document.getElementById('success-recept-status-message'),
                time: document.getElementById('success-recept-time'),
                date: document.getElementById('success-recept-date-weekday'),
                quote: document.getElementById('success-recept-quote')
            },
            failed: {
                type: document.getElementById('failed-recept-type'),
                amount: document.getElementById('failed-recept-amount'),
                status: document.getElementById('failed-recept-status'),
                statusMessage: document.getElementById('failed-recept-status-message'),
                time: document.getElementById('failed-recept-time'),
                date: document.getElementById('failed-recept-date-weekday'),
                quote: document.getElementById('failed-recept-quote')
            }
        }
    };

    // توابع کمکی
    const helpers = {
        formatAmount: (amount) => {
            return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ریال';
        },
        getCurrentDateTime: () => {
            const now = new Date();
            return {
                time: new Intl.DateTimeFormat('fa-IR', { timeStyle: 'medium' }).format(now),
                date: new Intl.DateTimeFormat('fa-IR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }).format(now)
            };
        },
        debounce: (func, delay) => {
            return (...args) => {
                const now = Date.now();
                if (now - state.lastClickTime < delay) return;
                state.lastClickTime = now;
                return func(...args);
            };
        },
        showScreen: (screenId) => {
            Object.values(elements.screens).forEach(screen => {
                screen.classList.remove('active');
            });
            elements.screens[screenId].classList.add('active');
        },
        showStatus: (message, isError = false) => {
            clearTimeout(state.statusTimeout);
            elements.fields.statusMessage.textContent = message;
            elements.fields.statusMessage.style.color = isError ? '#ef4444' : '#10b981';
            state.statusTimeout = setTimeout(() => {
                elements.fields.statusMessage.textContent = '';
            }, 4000);
        },
        validateAmount: (amount) => {
            if (isNaN(amount) || amount <= 0) {
                helpers.showStatus(config.messages.invalidAmount, true);
                return false;
            }
            if (amount < config.minAmount) {
                helpers.showStatus(config.messages.minAmountError, true);
                return false;
            }
            if (amount > config.maxAmount) {
                helpers.showStatus(config.messages.maxAmountError, true);
                return false;
            }
            if (amount.toString().length > config.maxDigits) {
                helpers.showStatus(config.messages.maxDigitsError, true);
                return false;
            }
            return true;
        }
    };

    // مدیریت اتصال کارتخوان
    const cardReader = {
        async connect() {
            if (state.isConnecting || state.isCardReaderConnected) {
                console.log('Connection already in progress or connected');
                return;
            }
            state.isConnecting = true;
            try {
                console.log('Attempting WebSocket connection to:', config.wsConfig.wsUrl);
                state.ws = new WebSocket(config.wsConfig.wsUrl);
                return new Promise((resolve, reject) => {
                    state.ws.onopen = () => {
                        console.log('WebSocket connection established successfully');
                        state.isCardReaderConnected = true;
                        this.enablePaymentButtons();
                        helpers.showStatus(config.messages.connected);
                        resolve(true);
                    };
                    state.ws.onerror = (error) => {
                        console.error('WebSocket connection failed:', error);
                        helpers.showStatus(config.messages.wsConnectionError, true);
                        reject(error);
                    };
                    state.ws.onclose = () => {
                        console.log('WebSocket connection closed unexpectedly');
                        state.isCardReaderConnected = false;
                        this.disablePaymentButtons();
                        helpers.showStatus(config.messages.wsClosedError, true);
                    };
                });
            } catch (error) {
                console.error('WebSocket initialization error:', error);
                helpers.showStatus(config.messages.connectionError, true);
                return false;
            } finally {
                state.isConnecting = false;
                console.log('Connection attempt completed');
            }
        },
        async disconnect() {
            if (state.ws) {
                try {
                    state.ws.close();
                } catch (error) {
                    console.error('Error closing WebSocket:', error);
                }
                state.ws = null;
            }
            state.isCardReaderConnected = false;
            this.disablePaymentButtons();
            helpers.showStatus(config.messages.disconnected);
        },
        async sendPayment(amount, paymentType) {
            if (!state.isCardReaderConnected || !state.ws || state.ws.readyState !== WebSocket.OPEN) {
                throw new Error(config.messages.connectionError);
            }
            const refId = `REF${Date.now()}`;
            const message = {
                mti: '0200',
                fields: {
                    3: '000000', // Processing Code (فروش)
                    4: (amount * 100).toString().padStart(12, '0'), // مبلغ به تومان
                    7: new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14), // تاریخ و زمان
                    11: Math.floor(100000 + Math.random() * 900000).toString(), // STAN
                    41: config.wsConfig.terminalId,
                    42: config.wsConfig.merchantId,
                    48: paymentType
                }
            };
            try {
                state.ws.send(JSON.stringify(message));
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error(config.messages.timeoutError));
                    }, config.timeout);
                    state.ws.onmessage = (event) => {
                        clearTimeout(timeout);
                        try {
                            const response = JSON.parse(event.data);
                            const isSuccess = response.fields && response.fields['39'] === '00';
                            resolve(isSuccess);
                        } catch (error) {
                            reject(new Error(config.messages.invalidResponse));
                        }
                    };
                });
            } catch (error) {
                await this.disconnect();
                helpers.showStatus(error.message || config.messages.paymentError, true);
                throw error;
            }
        },
        enablePaymentButtons() {
            elements.buttons.payment.forEach(btn => {
                btn.disabled = false;
                console.log(`Enabled button: ${btn.id}`);
            });
        },
        disablePaymentButtons() {
            elements.buttons.payment.forEach(btn => {
                btn.disabled = true;
                console.log(`Disabled button: ${btn.id}`);
            });
        },
        async autoConnect() {
            console.log('Starting auto-connect to card reader');
            await this.connect();
        }
    };

    // مدیریت پرداخت
    const payment = {
        async process(amount) {
            if (state.isProcessingPayment) return;
            state.isProcessingPayment = true;
            try {
                helpers.showStatus(
                    config.messages.processingPayment(amount, state.currentPaymentType)
                );
                const isSuccess = await cardReader.sendPayment(amount, state.currentPaymentType);
                await receipt.generate(isSuccess, amount);
                helpers.showStatus(isSuccess ? config.messages.paymentSuccess : config.messages.paymentFailed, !isSuccess);
                setTimeout(() => window.print(), 1000);
            } catch (error) {
                helpers.showStatus(error.message || config.messages.paymentError, true);
                await receipt.generate(false, amount);
            } finally {
                setTimeout(() => {
                    helpers.showScreen('main');
                    state.isProcessingPayment = false;
                }, 3000);
            }
        },
        handlePredefinedAmount(amountElement) {
            const amount = parseInt(amountElement.dataset.amount);
            if (helpers.validateAmount(amount)) {
                payment.process(amount / 10); // تبدیل به تومان
            }
        },
        handleCustomAmount() {
            const amount = parseInt(elements.fields.amountInput.value.replace(/[^0-9]/g, ''));
            if (helpers.validateAmount(amount)) {
                payment.process(amount / 10); // تبدیل به تومان
            }
        }
    };

    // مدیریت رسید
    const receipt = {
        async generate(isSuccess, amount) {
            const receiptType = isSuccess ? 'success' : 'failed';
            const receiptElements = elements.fields[receiptType];
            const datetime = helpers.getCurrentDateTime();
            const paymentTypeText = state.currentPaymentType === 'صدقه' ? 'صدقه' : 
                                    state.currentPaymentType === 'کمک به ایتام' ? 'کمک به ایتام' : 'فطریه';
            
            receiptElements.time.textContent = datetime.time;
            receiptElements.date.textContent = datetime.date;
            receiptElements.type.textContent = paymentTypeText;
            receiptElements.amount.textContent = helpers.formatAmount(amount);
            receiptElements.status.textContent = isSuccess ? 'پرداخت موفق' : 'پرداخت ناموفق';
            receiptElements.statusMessage.textContent = isSuccess ? 'تراکنش با موفقیت انجام شد' : 'خطای ناشناخته';
            receiptElements.quote.textContent = isSuccess ? 
                config.quotes[Math.floor(Math.random() * config.quotes.length)] : 
                'لطفاً دوباره تلاش کنید';
            
            helpers.showScreen(`${receiptType}Receipt`);
        }
    };

    // تنظیم event listeners
    const setupEventListeners = () => {
        // حذف رویداد کلیک برای دکمه اتصال، چون حالا اتصال خودکار است
        elements.buttons.payment.forEach(btn => {
            btn.addEventListener('click', () => {
                state.currentPaymentType = btn.textContent.trim();
                elements.fields.paymentType.textContent = state.currentPaymentType;
                helpers.showScreen('amount');
            });
        });
        document.querySelectorAll('.amount-button[data-amount]').forEach(btn => {
            btn.addEventListener('click', 
                helpers.debounce(() => payment.handlePredefinedAmount(btn), config.debounceDelay));
        });
        elements.buttons.customAmount.addEventListener('click', () => {
            helpers.showScreen('customAmount');
            elements.fields.amountInput.value = '';
        });
        elements.buttons.keyboard.forEach(btn => {
            if (btn.dataset.number) {
                btn.addEventListener('click', () => {
                    const currentValue = elements.fields.amountInput.value.replace(/[^0-9]/g, '');
                    if (currentValue.length < config.maxDigits) {
                        elements.fields.amountInput.value = helpers.formatAmount(
                            currentValue + btn.dataset.number
                        );
                    }
                });
            }
        });
        elements.buttons.backspace.addEventListener('click', () => {
            const currentValue = elements.fields.amountInput.value.replace(/[^0-9]/g, '');
            elements.fields.amountInput.value = helpers.formatAmount(
                currentValue.slice(0, -1)
            );
        });
        elements.buttons.confirmAmount.addEventListener('click', 
            helpers.debounce(() => payment.handleCustomAmount(), config.debounceDelay));
        elements.buttons.backToMain.addEventListener('click', () => helpers.showScreen('main'));
        elements.buttons.backToAmount.addEventListener('click', () => helpers.showScreen('amount'));
        elements.buttons.successBack.addEventListener('click', () => helpers.showScreen('main'));
        elements.buttons.failedBack.addEventListener('click', () => helpers.showScreen('main'));
    };

    // مقداردهی اولیه برنامه
    const init = () => {
        cardReader.disablePaymentButtons();
        setupEventListeners();
        helpers.showScreen('main');
        // اتصال خودکار به کارتخوان هنگام بارگذاری صفحه
        cardReader.autoConnect();
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', PaymentApp.init);