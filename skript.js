import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD-5CPzp5iwNHUxloFkDBf3J8gRlUpbGVc",
    authDomain: "ton-not.firebaseapp.com",
    databaseURL: "https://ton-not-default-rtdb.firebaseio.com",
    projectId: "ton-not",
    storageBucket: "ton-not.appspot.com",
    messagingSenderId: "729333286761",
    appId: "1:729333286761:web:741fdeb1572cc1908bdff8",
    measurementId: "G-JKCWNWTLBT"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

let gameState = {
    balance: 2500,
    energy: 1000,
    maxEnergy: 1000,
    upgradeLevel: 0,
    rechargeLevel: 0,
    tapLevel: 0,
    energyRechargeRate: 1,
    tapMultiplier: 1,
    baseCost: 500,
    lastUpdateTime: Date.now(),
    telegramUserId: null
};

const boostCosts = {
    energyLimit: level => gameState.baseCost + (level * 500),
    energyRechargeSpeed: level => 1000 + (level * 1000),
    multitap: level => gameState.baseCost + (level * 500)
};

// Функція для оновлення UI
function updateDisplay() {
    document.querySelector('.balance').innerText = gameState.balance.toLocaleString();
    document.querySelector('.energy').innerText = `⚡ ${gameState.energy} / ${gameState.maxEnergy}`;
    document.querySelector('.progress').style.width = `${(gameState.energy / gameState.maxEnergy) * 100}%`;

    updateBoostCost();
}

function updateBoostCost() {
    for (let boost in boostCosts) {
        const cost = boostCosts[boost](gameState[`${boost}Level`]);
        document.querySelector(`.boost-item[data-boost="${boost}"] .boost-cost`).innerText = cost.toLocaleString();
    }
}

// Оновлення енергії з урахуванням часу
function updateEnergyInBackground() {
    const currentTime = Date.now();
    const timeElapsed = (currentTime - gameState.lastUpdateTime) / 1000;
    const energyGained = Math.floor(timeElapsed * gameState.energyRechargeRate);

    if (gameState.energy < gameState.maxEnergy) {
        gameState.energy = Math.min(gameState.energy + energyGained, gameState.maxEnergy);
        updateDisplay();
    }
    gameState.lastUpdateTime = currentTime;
}

// Збереження даних у Firebase
function saveDataToFirebase() {
    if (gameState.telegramUserId) {
        const userRef = ref(db, `users/${gameState.telegramUserId}`);
        set(userRef, {
            ...gameState,
            lastUpdateTime: Date.now()
        });
    }
}

// Завантаження даних із Firebase
function loadDataFromFirebase() {
    if (gameState.telegramUserId) {
        const userRef = ref(db, `users/${gameState.telegramUserId}`);
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                Object.assign(gameState, snapshot.val());
                updateEnergyInBackground();
                updateDisplay();
            }
        });
    }
}

// Функція для отримання Telegram ID
function getTelegramUserId() {
    const tg = window.Telegram.WebApp;
    const user = tg.initDataUnsafe.user;
    if (user) {
        gameState.telegramUserId = user.id;
        document.getElementById('result').innerText = `Ваш Telegram ID: ${gameState.telegramUserId}`;
        loadDataFromFirebase();
    } else {
        document.getElementById('result').innerText = 'Не вдалося отримати ваш Telegram ID.';
    }
}

// Обробка покупки буста
function processPurchase(boost) {
    const boostType = boost.dataset.boost;
    const level = gameState[`${boostType}Level`] + 1;
    const cost = boostCosts[boostType](level - 1);

    if (gameState.balance >= cost) {
        gameState.balance -= cost;
        gameState[`${boostType}Level`] = level;
        
        switch (boostType) {
            case 'energyLimit':
                gameState.maxEnergy += 500;
                break;
            case 'energyRechargeSpeed':
                gameState.energyRechargeRate += 1;
                break;
            case 'multitap':
                gameState.tapMultiplier += 1;
                break;
        }

        updateBoostCost();
        updateDisplay();
        showMessage(`${boost.querySelector('.boost-name').innerText} (Level ${level}) активовано!`);
        saveDataToFirebase();
    } else {
        showInsufficientFundsModal();
    }
}

// Показ модального вікна підтвердження покупки
function showConfirmModal(boost) {
    selectedBoost = boost;
    const level = gameState[`${boost.dataset.boost}Level`] + 1;
    const cost = boostCosts[boost.dataset.boost](level - 1);
    document.getElementById('confirmText').innerText = `Ви впевнені, що хочете купити ${boost.querySelector('.boost-name').innerText} (Level ${level}) за ${cost.toLocaleString()} балів?`;
    document.getElementById('confirmModal').style.display = 'block';
}

document.getElementById('confirmYes').addEventListener('click', () => {
    if (selectedBoost) {
        processPurchase(selectedBoost);
        closeConfirmModal();
    }
});

document.getElementById('confirmNo').addEventListener('click', closeConfirmModal);

// Закриття модальних вікон
function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    selectedBoost = null;
}

function showInsufficientFundsModal() {
    document.getElementById('insufficientFundsModal').style.display = 'block';
}

document.getElementById('insufficientFundsOk').addEventListener('click', () => {
    document.getElementById('insufficientFundsModal').style.display = 'none';
});

// Відображення повідомлень користувачеві
function showMessage(message) {
    alert(message); // Можна замінити на більш складний механізм повідомлень
}

document.querySelectorAll('.boost-item').forEach((item) => {
    item.addEventListener('click', () => {
        if (!item.classList.contains('disabled')) {
            showConfirmModal(item);
        } else {
            showMessage('Цей буст вже на максимальному рівні.');
        }
    });
});

document.getElementById('coin').addEventListener('click', () => {
    if (gameState.energy >= gameState.tapMultiplier) {
        gameState.balance += gameState.tapMultiplier;
        gameState.energy -= gameState.tapMultiplier;
        updateDisplay();
        saveDataToFirebase();
    } else {
        showMessage('Немає достатньо енергії для цього кліку!');
    }
});

setInterval(() => {
    if (gameState.energy < gameState.maxEnergy) {
        gameState.energy = Math.min(gameState.energy + gameState.energyRechargeRate, gameState.maxEnergy);
        updateDisplay();
        saveDataToFirebase();
    }
}, 1000);

window.addEventListener('focus', updateEnergyInBackground);
window.addEventListener('blur', () => {
    gameState.lastUpdateTime = Date.now();
    saveDataToFirebase();
});

// Відкриття та закриття модального вікна Boosts
document.getElementById('boosts-btn').addEventListener('click', () => {
    document.getElementById('boostsModal').style.display = 'block';
});

document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('boostsModal').style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === document.getElementById('boostsModal')) {
        document.getElementById('boostsModal').style.display = 'none';
    }
});

document.getElementById('frens-btn').addEventListener('click', () => {
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('frens-screen').style.display = 'block';
});

document.querySelector('.back-btn').addEventListener('click', () => {
    document.getElementById('frens-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
});

document.getElementById('get-id-btn').addEventListener('click', getTelegramUserId);

window.onload = getTelegramUserId;