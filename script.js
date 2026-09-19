document.getElementById('date-display').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    let allQuestions = [];
    let dailyQuestions = [];
    let currentQ = 0;
    let quizScore = 0;
    let shotsMade = 0;
    let resultsHistory = [];

    // Hoop state
    let hoopPos = 15;
    let currentHoopSpeed = 100;
    let hoopDirection = 1;
    let animFrame = null;
    let lastHoopTime = 0;
    let isShooting = false;

    // Ball state
    let ballBottom = 20;
    let ballAnimFrame = null;
    let lastBallTime = 0;

    // Timer Variables
    let currentTimerDuration = 5;
    let timeLeft = currentTimerDuration;
    let timerAnimFrame = null;
    let lastTimerTime = 0;
    let onTimeoutHandler = null;


function getSeedForDate(dateString) {
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    hash = (hash << 5) - hash + dateString.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getIndicesForDate(dateString, poolLength, excludedIndices = new Set()) {
  const seed = getSeedForDate(dateString);
  const selectedIndices = [];
  const usedIndices = new Set(excludedIndices);
  let currentSeed = seed;

  while (selectedIndices.length < 5 && usedIndices.size < poolLength) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const index = Math.floor((currentSeed / 233280) * poolLength);

    if (!usedIndices.has(index)) {
      usedIndices.add(index);
      selectedIndices.push(index);
    }
  }
  return selectedIndices;
}

function getDailyQuestions(pool) {
  if (!pool || pool.length === 0) return [];

  // 1. Get yesterday's YYYY-MM-DD string
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  // 2. Determine yesterday's indices using yesterday's seed
  const yesterdayIndices = new Set(getIndicesForDate(yesterdayStr, pool.length));

  // 3. Get today's YYYY-MM-DD string
  const todayStr = new Date().toISOString().split('T')[0];

  // 4. Select today's 5 indices while excluding yesterday's questions
  const todayIndices = getIndicesForDate(todayStr, pool.length, yesterdayIndices);

  return todayIndices.map(index => pool[index]);
}
    async function initGame() {
      try {
        const res = await fetch('questions.json');
        allQuestions = await res.json();
        dailyQuestions = getDailyQuestions(allQuestions);
        
        const startBtn = document.getElementById('start-btn');
        startBtn.disabled = false;
        startBtn.innerText = "Start Game";
      } catch (err) {
        console.error("Failed to load questions.json", err);
        document.getElementById('start-btn').innerText = "Error Loading Daily Game";
      }
    }

    initGame();

    function startTimer(duration, onTimeoutCallback) {
      cancelAnimationFrame(timerAnimFrame);
      currentTimerDuration = duration;
      timeLeft = duration;
      onTimeoutHandler = onTimeoutCallback;
      document.getElementById('timer-wrapper').classList.remove('hidden');
      updateTimerBar();

      lastTimerTime = performance.now();
      timerAnimFrame = requestAnimationFrame(updateTimerLoop);
    }

    function updateTimerLoop(timestamp) {
      const delta = (timestamp - lastTimerTime) / 1000;
      lastTimerTime = timestamp;

      timeLeft -= delta;
      updateTimerBar();

      if (timeLeft <= 0) {
        timeLeft = 0;
        updateTimerBar();
        stopTimer();
        if (onTimeoutHandler) onTimeoutHandler();
      } else {
        timerAnimFrame = requestAnimationFrame(updateTimerLoop);
      }
    }

    function stopTimer() {
      cancelAnimationFrame(timerAnimFrame);
      document.getElementById('timer-wrapper').classList.hidden = true;
      document.getElementById('timer-wrapper').classList.add('hidden');
    }

    function updateTimerBar() {
      const percentage = (timeLeft / currentTimerDuration) * 100;
      document.getElementById('timer-bar').style.width = Math.max(0, percentage) + '%';
    }

    /* GAME START & PREP PHASE */
    function startGame() {
      if (!dailyQuestions.length) return;
      document.getElementById('start-screen').classList.add('hidden');
      document.getElementById('quiz-screen').classList.remove('hidden');

      const qText = document.getElementById('question-text');
      qText.style.color = '#ff9f43';
      qText.innerText = 'Get ready...Questions will appear here';

      // Keep screen layout locked using dummy transparent buttons
      const btnContainer = document.getElementById('answer-buttons');
      btnContainer.innerHTML = `
        <button class="btn dummy-btn">&nbsp;</button>
        <button class="btn dummy-btn">&nbsp;</button>
        <button class="btn dummy-btn">&nbsp;</button>
        <button class="btn dummy-btn">&nbsp;</button>
      `;

      startTimer(3, () => {
        loadQuestion();
      });
    }

    function loadQuestion() {
      document.getElementById('quiz-screen').classList.remove('hidden');
      const q = dailyQuestions[currentQ];
      
      const qText = document.getElementById('question-text');
      qText.style.color = '#fff';
      qText.innerText = `Q${currentQ + 1}: ${q.q}`;
      
      const btnContainer = document.getElementById('answer-buttons');
      btnContainer.innerHTML = '';

      q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.innerText = opt;
        btn.onclick = () => handleAnswer(idx);
        btnContainer.appendChild(btn);
      });

      startTimer(5, () => handleAnswer(-1));
    }

    function handleAnswer(selectedIndex) {
      stopTimer();
      const q = dailyQuestions[currentQ];
      const correct = selectedIndex !== -1 && q.a === selectedIndex;
      
      const buttons = document.querySelectorAll('#answer-buttons .btn');
      buttons.forEach((btn, idx) => {
        btn.disabled = true;
        if (idx === q.a) {
          btn.classList.add('correct');
        } else if (idx === selectedIndex) {
          btn.classList.add('incorrect');
        }
      });

      if (correct) {
        quizScore++;
        resultsHistory.push('🟩');
      } else {
        resultsHistory.push(selectedIndex === -1 ? '⏰' : '🟥');
      }

      setTimeout(() => {
        document.getElementById('quiz-screen').classList.add('hidden');
        startBasketballPhase();
      }, 800);
    }

    function startBasketballPhase() {
      document.getElementById('hoop-screen').classList.remove('hidden');
      document.getElementById('shot-feedback').innerText = '';
      document.getElementById('shoot-btn').disabled = false;
      
      const ball = document.getElementById('ball');
      ball.style.bottom = '20px';
      ball.style.left = '50%';
      ball.classList.remove('flying');
      document.getElementById('hoop').classList.remove('swished');
      isShooting = false;

      currentHoopSpeed = 110 + (currentQ * 35);
      
      const speedBadge = document.getElementById('speed-badge');
      speedBadge.innerText = `Speed: Level ${currentQ + 1}` + (currentQ === 4 ? " (MAX)" : "");

      hoopPos = 15;
      hoopDirection = 1;

      lastHoopTime = performance.now();
      animFrame = requestAnimationFrame(animateHoop);

      startTimer(5, () => {
        if (!isShooting) {
          shootBall(true);
        }
      });
    }

    function animateHoop(timestamp) {
      if (!timestamp) timestamp = performance.now();
      const delta = (timestamp - lastHoopTime) / 1000;
      lastHoopTime = timestamp;

      hoopPos += currentHoopSpeed * hoopDirection * delta;

      if (hoopPos >= 85) {
        hoopPos = 85;
        hoopDirection = -1;
      } else if (hoopPos <= 15) {
        hoopPos = 15;
        hoopDirection = 1;
      }

      document.getElementById('hoop').style.left = hoopPos + '%';

      if (!isShooting) {
        animFrame = requestAnimationFrame(animateHoop);
      }
    }

    function shootBall(isTimedOut = false) {
      if (isShooting) return;
      isShooting = true;
      stopTimer();

      document.getElementById('shoot-btn').disabled = true;
      cancelAnimationFrame(animFrame);

      const ball = document.getElementById('ball');
      ball.classList.add('flying');
      ballBottom = 20;

      lastBallTime = performance.now();
      ballAnimFrame = requestAnimationFrame((t) => animateBall(t, isTimedOut));
    }

    function animateBall(timestamp, isTimedOut) {
      const delta = (timestamp - lastBallTime) / 1000;
      lastBallTime = timestamp;

      ballBottom += 700 * delta; 
      const ball = document.getElementById('ball');
      ball.style.bottom = ballBottom + 'px';

      if (ballBottom >= 220) {
        cancelAnimationFrame(ballAnimFrame);
        ball.classList.remove('flying');
        checkShotHit(isTimedOut);
      } else {
        ballAnimFrame = requestAnimationFrame((t) => animateBall(t, isTimedOut));
      }
    }

    function checkShotHit(isTimedOut) {
      const hitMargin = 4;
      const feedback = document.getElementById('shot-feedback');

      if (!isTimedOut && Math.abs(hoopPos - 50) <= hitMargin) {
        shotsMade++;
        resultsHistory.push('🏀');
        feedback.innerText = "SWISH! +1 Point";
        feedback.style.color = "#2ed573";
        document.getElementById('hoop').classList.add('swished');
      } else {
        resultsHistory.push(isTimedOut ? '⏰' : '❌');
        feedback.innerText = isTimedOut ? "TIME EXPIRED!" : "AIRBALL!";
        feedback.style.color = "#ff4757";
      }

      setTimeout(() => {
        currentQ++;
        document.getElementById('hoop-screen').classList.add('hidden');

        if (currentQ < dailyQuestions.length) {
          loadQuestion();
        } else {
          showEndScreen();
        }
      }, 1000);
    }

    function showEndScreen() {
      stopTimer();
      document.getElementById('end-screen').classList.remove('hidden');
      const totalScore = quizScore + shotsMade;
      document.getElementById('final-score').innerText = `Total Score: ${totalScore} / 10`;

      let grid = "";
      for(let i=0; i < resultsHistory.length; i+=2) {
        grid += `R${(i/2)+1}: Trivia ${resultsHistory[i]} | Shot ${resultsHistory[i+1]}\n`;
      }

      const shareTemplate = 
`ThinkFast ⚡
Score: ${totalScore}/10

${grid}
Think fast and play!`;

      document.getElementById('share-text').innerText = shareTemplate;
    }

    function copyResults() {
      const textToCopy = document.getElementById('share-text').innerText;
      navigator.clipboard.writeText(textToCopy).then(() => {
        alert("Results copied to clipboard! Share with your friends.");
      });
    }