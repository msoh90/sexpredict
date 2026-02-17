document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const verifyGroup = document.getElementById('verify-group');
    const predictGroup = document.getElementById('predict-group');
    const predictYearInput = document.getElementById('predict-year');

    const calcBtn = document.getElementById('calc-btn');
    const mainPanel = document.getElementById('main-panel');
    const resultArea = document.getElementById('result-area');
    const resultTitle = resultArea.querySelector('.result-title');
    const resultDesc = resultArea.querySelector('.result-desc');
    const tabs = document.querySelectorAll('.tab-btn');

    // State
    let mode = 'verify';

    // Date Pickers Storage
    const datePickers = {
        dad: null,
        mom: null,
        child: null
    };

    let isLogged = false; // Flag to prevent multi-save per calculation

    // --- Wheel Picker Logic ---
    class WheelDatePicker {
        constructor(containerId, startYear = 1950, endYear = 2030, defaultYear = 1990) {
            this.container = document.getElementById(containerId);
            this.startYear = startYear;
            this.endYear = endYear;
            this.selected = { year: defaultYear, month: 1, day: 1 };
            this.itemHeight = 40; // matches CSS

            this.init();
        }

        init() {
            this.container.innerHTML = `
                <div class="picker-column">
                    <input type="number" class="picker-input year-input" value="${this.selected.year}">
                    <div class="wheel-container year-wheel"></div>
                </div>
                <div class="picker-column">
                    <input type="number" class="picker-input month-input" value="${this.selected.month}">
                    <div class="wheel-container month-wheel"></div>
                </div>
                <div class="picker-column">
                    <input type="number" class="picker-input day-input" value="${this.selected.day}">
                    <div class="wheel-container day-wheel"></div>
                </div>
            `;

            this.els = {
                yInput: this.container.querySelector('.year-input'),
                mInput: this.container.querySelector('.month-input'),
                dInput: this.container.querySelector('.day-input'),
                yWheel: this.container.querySelector('.year-wheel'),
                mWheel: this.container.querySelector('.month-wheel'),
                dWheel: this.container.querySelector('.day-wheel'),
            };

            this.populateWheel(this.els.yWheel, this.startYear, this.endYear, 'year');
            this.populateWheel(this.els.mWheel, 1, 12, 'month');
            this.updateDays(); // Populate days based on year/month

            // Event Listeners
            this.attachEvents(this.els.yInput, this.els.yWheel, 'year');
            this.attachEvents(this.els.mInput, this.els.mWheel, 'month');
            this.attachEvents(this.els.dInput, this.els.dWheel, 'day');

            // Initial Scroll
            this.scrollToValue('year', this.selected.year);
            this.scrollToValue('month', this.selected.month);
            this.scrollToValue('day', this.selected.day);
        }

        populateWheel(element, start, end, type) {
            let html = '<div class="wheel-padding"></div>';
            for (let i = start; i <= end; i++) {
                html += `<div class="wheel-item" data-value="${i}">${i}</div>`;
            }
            html += '<div class="wheel-padding"></div>'; // Padding for centering
            element.innerHTML = html;
        }

        updateDays() {
            const daysInMonth = new Date(this.selected.year, this.selected.month, 0).getDate();
            // Check if we need to update
            const currentItems = this.els.dWheel.querySelectorAll('.wheel-item').length;
            if (currentItems !== daysInMonth) {
                // Keep current day if valid, else clamp
                if (this.selected.day > daysInMonth) this.selected.day = daysInMonth;

                this.populateWheel(this.els.dWheel, 1, daysInMonth, 'day');
                this.scrollToValue('day', this.selected.day);
            }
        }

        attachEvents(input, wheel, type) {
            // 1. Input Change -> Scroll Wheel
            input.addEventListener('input', (e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val)) return;

                // Validate constraints
                if (type === 'year') val = Math.max(this.startYear, Math.min(this.endYear, val));
                if (type === 'month') val = Math.max(1, Math.min(12, val));
                if (type === 'day') {
                    const maxDay = new Date(this.selected.year, this.selected.month, 0).getDate();
                    val = Math.max(1, Math.min(maxDay, val));
                }

                this.selected[type] = val;
                if (type !== 'day') this.updateDays(); // Year/Month change affects Day

                this.scrollToValue(type, val, true); // smooth scroll
            });

            // 2. Wheel Scroll -> Update Input
            let scrollTimeout;
            wheel.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    // Find closest item
                    const scrollTop = wheel.scrollTop;
                    const index = Math.round(scrollTop / this.itemHeight);
                    const items = wheel.querySelectorAll('.wheel-item');

                    if (items[index]) {
                        const val = parseInt(items[index].dataset.value);
                        if (this.selected[type] !== val) {
                            this.selected[type] = val;
                            input.value = val;
                            this.updateActiveItem(wheel, index);
                            if (type !== 'day') this.updateDays();
                        }
                    }
                }, 50); // Debounce

                // Update active visualization immediately logic could be here, 
                // but debouncing prevents jitter. 
                // Let's adding basic highlighting on scroll too for visual feedback
                const scrollTop = wheel.scrollTop;
                const index = Math.round(scrollTop / this.itemHeight);
                this.updateActiveItem(wheel, index);
            });
        }

        scrollToValue(type, value, smooth = false) {
            let wheel;
            let start = (type === 'year') ? this.startYear : 1;

            if (type === 'year') wheel = this.els.yWheel;
            if (type === 'month') wheel = this.els.mWheel;
            if (type === 'day') wheel = this.els.dWheel;

            const index = value - start;
            const scrollPos = index * this.itemHeight;

            wheel.scrollTo({
                top: scrollPos,
                behavior: smooth ? 'smooth' : 'auto'
            });
            this.updateActiveItem(wheel, index);
        }

        updateActiveItem(wheel, index) {
            wheel.querySelectorAll('.wheel-item').forEach((item, i) => {
                if (i === index) item.classList.add('active');
                else item.classList.remove('active');
            });
        }

        getDate() {
            // Return YYYY-MM-DD string or null
            return `${this.selected.year}-${String(this.selected.month).padStart(2, '0')}-${String(this.selected.day).padStart(2, '0')}`;
        }
    }

    // Initialize Pickers
    datePickers.dad = new WheelDatePicker('dad-picker', 1950, 2010, 1990);
    datePickers.mom = new WheelDatePicker('mom-picker', 1950, 2010, 1992);
    datePickers.child = new WheelDatePicker('child-picker', 1950, 2030, 2026);

    // --- App Logic ---
    const setMode = (newMode) => {
        mode = newMode;
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

        if (mode === 'verify') {
            verifyGroup.classList.remove('hidden');
            predictGroup.classList.add('hidden');
        } else {
            verifyGroup.classList.add('hidden');
            predictGroup.classList.remove('hidden');
        }

        resultArea.classList.remove('visible');
        mainPanel.className = 'glass-panel';
    };

    const resetToLanding = () => {
        setTimeout(() => {
            // Hide result area
            resultArea.classList.remove('visible');
            // Reset background
            mainPanel.className = 'glass-panel';
            // Hide messages
            document.getElementById('thank-you-msg').classList.add('hidden');
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            // Reset state
            isLogged = false;
        }, 3000); // 3-second delay
    };

    const getYear = (picker) => {
        return picker.selected.year;
    };

    let pendingRemainder = null; // Store result for confirmation
    let isCorrected = false; // Flag for special algorithm

    const calculateRhythm = () => {
        isLogged = false; // Reset logging flag for new calculation
        const dadYear = getYear(datePickers.dad);
        const momYear = getYear(datePickers.mom);

        // Conception Year
        let conceptionYear;
        if (mode === 'verify') {
            const childYear = getYear(datePickers.child);
            conceptionYear = childYear - 1;
        } else {
            const pYear = parseInt(predictYearInput.value);
            if (!pYear) {
                alert("임신 희망 연도를 입력해주세요.");
                return;
            }
            conceptionYear = pYear;
        }

        let dadAge = conceptionYear - dadYear;
        let momAge = conceptionYear - momYear;

        // --- NEW: Age Correction Logic (Verify Mode) ---
        isCorrected = false;
        if (mode === 'verify') {
            const childMonth = datePickers.child.selected.month;
            if (childMonth >= 10) {
                dadAge += 1;
                momAge += 1;
                isCorrected = true;
            }
        }
        // ----------------------------------------------

        // Confirmation Logic
        const confirmModal = document.getElementById('confirm-modal');
        const confirmText = document.getElementById('confirm-text');

        confirmText.innerHTML = `임신 당시<br>아빠 <span style="color:var(--accent-blue)">${dadAge}세</span>, 엄마 <span style="color:var(--accent-pink)">${momAge}세</span>였네요.`;
        confirmModal.classList.remove('hidden');

        // Store calculation for next step
        pendingRemainder = (dadAge + momAge + 2) % 3;
    };

    // Sound Effect: Ding-Dong
    const playDingDong = () => {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();

        const playTone = (freq, startTime, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.frequency.value = freq;
            osc.type = 'sine';

            gain.gain.setValueAtTime(0.1, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = ctx.currentTime;
        // Ding (High E)
        playTone(659.25, now, 1.5);
        // Dong (C)
        playTone(523.25, now + 0.4, 2.0);
    };

    // Create Sparkles
    const createSparkles = () => {
        const container = document.querySelector('.sparkle-container');
        container.innerHTML = ''; // clear
        for (let i = 0; i < 8; i++) {
            const el = document.createElement('div');
            el.className = 'sparkle';
            el.style.top = Math.random() * 100 + '%';
            el.style.left = Math.random() * 100 + '%';
            el.style.animationDelay = Math.random() * 1 + 's';
            container.appendChild(el);
        }
    };

    // Modal Events
    document.getElementById('confirm-yes').addEventListener('click', () => {
        document.getElementById('confirm-modal').classList.add('hidden');

        // Start Loading Animation
        const loadingArea = document.getElementById('loading-area');
        const resultArea = document.getElementById('result-area');

        // Reset states
        mainPanel.className = 'glass-panel';
        resultArea.classList.remove('visible');
        loadingArea.classList.remove('hidden');
        createSparkles();

        // Simulate Calculation Time (Starry Analysis)
        setTimeout(() => {
            loadingArea.classList.add('hidden');
            displayResult(pendingRemainder);
            playDingDong(); // Play sound

            if (mode === 'predict') {
                const pred = pendingRemainder === 0 ? '딸' : (pendingRemainder === 1 ? '아들' : '조화');
                saveAllToSheet('', pred); // In predict mode, actualSex is empty
                resetToLanding(); // Redirect in predict mode
            }
        }, 2500); // 2.5s delay
    });

    document.getElementById('confirm-no').addEventListener('click', () => {
        document.getElementById('confirm-modal').classList.add('hidden');
        // Just close modal, let user re-edit
    });

    const displayResult = (remainder) => {
        // Prepare main panel state
        mainPanel.classList.remove('state-0', 'state-1', 'state-2');

        // Slight delay to allow DOM to clear loading state visually if needed, 
        // essentially starting the result animation
        setTimeout(() => {
            mainPanel.classList.add(`state-${remainder}`);

            let title = '', desc = '';
            if (remainder === 0) {
                // Pink / Female
                title = `부드러운 숫자의 조화, <span class="highlight-princess">공주님</span>의 리듬입니다.<br><div class="result-emoji">👸</div>`;
                desc = "따뜻한 분홍빛과 보랏빛 파동이 퍼집니다. 사랑스럽고 섬세한 기운이 당신을 찾아왔습니다.";
            } else if (remainder === 1) {
                // Blue / Male
                title = `강인한 숫자의 에너지, <span class="highlight-prince">왕자님</span>의 리듬입니다.<br><div class="result-emoji">🤴</div>`;
                desc = "청량한 푸른빛과 에메랄드 파동이 퍼집니다. 활기차고 씩씩한 에너지가 느껴지시나요?";
            } else {
                // Gold / Balance (2)
                title = `<span class="highlight-mystic">신비의 중첩 구간</span><br><div class="result-emoji">✨</div>`;
                desc = "이 시기는 하늘의 기운이 절묘하게 균형을 이룬 신비의 구간입니다. 이 특별한 숫자의 조합에서 태어난 아이는 어떤 성별이었나요? 당신의 이야기가 이 지혜를 완성합니다.";
            }

            resultTitle.innerHTML = title;
            resultDesc.textContent = desc;

            // Trigger Fade-In Up
            resultArea.classList.add('visible');

            // --- Specialized Feedback for Verify Mode ---
            if (mode === 'verify') {
                const feedbackSection = document.getElementById('feedback-section');
                const harmonyFeedback = document.getElementById('harmony-feedback');

                if (pendingRemainder === 2) {
                    // Balance case: Ask for sex directly
                    feedbackSection.classList.add('hidden');
                    harmonyFeedback.classList.remove('hidden');
                } else {
                    // Normal case: Ask if correct
                    feedbackSection.classList.remove('hidden');
                    harmonyFeedback.classList.add('hidden');
                }
            } else {
                // Predict mode: hide all feedback
                document.getElementById('feedback-section').classList.add('hidden');
                document.getElementById('harmony-feedback').classList.add('hidden');
            }
            // --------------------------------------------
        }, 50);
    };

    // Centralized Google Sheets Save Function
    const saveAllToSheet = (actualSexVal, predictionVal) => {
        const dadDate = datePickers.dad.getDate();
        const momDate = datePickers.mom.getDate();
        let childDate = null;
        let conceptionYear = null;

        if (mode === 'verify') {
            childDate = datePickers.child.getDate();
        } else {
            conceptionYear = document.getElementById('predict-year').value;
        }

        const payload = {
            dadDate,
            momDate,
            childDate,
            conceptionYear,
            prediction: predictionVal,
            actualSex: actualSexVal,
            mode: mode === 'verify' ? '검증' : '예측'
        };

        console.log('[DEBUG] Final Save Payload:', payload);

        fetch('http://localhost:3000/api/record-harmony', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => console.log('Complete Save Success:', data))
            .catch(err => console.error('Complete Save Error:', err));
    };

    // Feedback Listeners
    document.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (isLogged) return; // Prevent multiple saves
            const isCorrect = e.currentTarget.dataset.correct === 'true';

            // Clear UI
            document.getElementById('feedback-section').classList.add('hidden');
            document.getElementById('harmony-feedback').classList.add('hidden');
            document.getElementById('thank-you-msg').classList.remove('hidden');

            const predictionStr = pendingRemainder === 0 ? '딸' : (pendingRemainder === 1 ? '아들' : '조화');
            let userChoice = '';

            if (isCorrect) {
                userChoice = predictionStr;
            } else {
                if (pendingRemainder === 0) userChoice = '아들';
                else if (pendingRemainder === 1) userChoice = '딸';
                else userChoice = '확인불가'; // Case for '조화' being incorrect
            }

            // Save once after feedback
            saveAllToSheet(userChoice, predictionStr);
            isLogged = true;
            resetToLanding(); // Auto-redirect after save
        });
    });

    // --- NEW: Harmony Choice Listeners ---
    document.querySelectorAll('.harmony-choice').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (isLogged) return;
            const chosenSex = e.currentTarget.dataset.sex;

            // Clear UI
            document.getElementById('harmony-feedback').classList.add('hidden');
            document.getElementById('thank-you-msg').classList.remove('hidden');

            // Save to sheet: actual is user's choice, prediction is '조화'
            saveAllToSheet(chosenSex, '조화');
            isLogged = true;

            resetToLanding(); // Auto-redirect after harmony save
        });
    });
    // -------------------------------------

    calcBtn.addEventListener('click', calculateRhythm);
    tabs.forEach(tab => tab.addEventListener('click', (e) => setMode(e.target.dataset.mode)));

    /* --- PWA Install Logic --- */
    let deferredPrompt;
    const installBanner = document.getElementById('install-banner');
    const installBtn = document.getElementById('install-btn');
    const installClose = document.getElementById('install-close');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent older browsers from showing the prompt automatically
        e.preventDefault();
        deferredPrompt = e;
        // Show our banner
        installBanner.classList.remove('hidden');
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;

            installBanner.classList.add('hidden');
            deferredPrompt.prompt();

            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
        });
    }

    if (installClose) {
        installClose.addEventListener('click', () => {
            installBanner.classList.add('hidden');
        });
    }
});
