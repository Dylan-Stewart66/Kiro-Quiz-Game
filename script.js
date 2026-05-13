(function () {
  'use strict';

  // === State ===
  const TOTAL_QUESTIONS = 30;
  const TOTAL_TIME = 300; // 5 minutes in seconds

  let state = {
    playerName: '',
    questions: [],
    currentIndex: 0,
    score: 0,
    timeRemaining: TOTAL_TIME,
    timerInterval: null,
    answered: false,
    quizActive: false
  };

  // === DOM References ===
  const screens = {
    landing: document.getElementById('screen-landing'),
    quiz: document.getElementById('screen-quiz'),
    results: document.getElementById('screen-results')
  };

  const els = {
    nameInput: document.getElementById('player-name'),
    startBtn: document.getElementById('btn-start'),
    questionCounter: document.getElementById('question-counter'),
    timerDisplay: document.getElementById('timer-display'),
    timerBar: document.getElementById('timer-bar'),
    progressBar: document.getElementById('progress-bar'),
    questionText: document.getElementById('question-text'),
    optionsList: document.getElementById('options-list'),
    explanation: document.getElementById('explanation'),
    explanationText: document.getElementById('explanation-text'),
    nextBtn: document.getElementById('btn-next'),
    scoreTracker: document.getElementById('score-tracker'),
    scoreNumber: document.getElementById('score-number'),
    scoreTotal: document.getElementById('score-total'),
    scoreMessage: document.getElementById('score-message'),
    scorePercentage: document.getElementById('score-percentage'),
    leaderboardList: document.getElementById('leaderboard-list'),
    shareBtn: document.getElementById('btn-share'),
    restartBtn: document.getElementById('btn-restart'),
    toast: document.getElementById('toast')
  };

  // === Utilities ===
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), 2500);
  }

  // === Leaderboard ===
  function getLeaderboard() {
    try {
      return JSON.parse(localStorage.getItem('jezero-quiz-leaderboard')) || [];
    } catch {
      return [];
    }
  }

  function saveToLeaderboard(name, score, total) {
    const board = getLeaderboard();
    board.push({
      name,
      score,
      total,
      percentage: Math.round((score / total) * 100),
      date: new Date().toISOString()
    });
    board.sort((a, b) => b.percentage - a.percentage || new Date(b.date) - new Date(a.date));
    const top10 = board.slice(0, 10);
    localStorage.setItem('jezero-quiz-leaderboard', JSON.stringify(top10));
    return top10;
  }

  function renderLeaderboard(currentName, currentScore) {
    const board = getLeaderboard();
    if (board.length === 0) {
      els.leaderboardList.innerHTML = '<li class="leaderboard-item"><span class="leaderboard-name">No scores yet</span></li>';
      return;
    }

    els.leaderboardList.innerHTML = board.map((entry, i) => {
      const isCurrent = entry.name === currentName && entry.score === currentScore;
      return `
        <li class="leaderboard-item${isCurrent ? ' current' : ''}">
          <span class="leaderboard-rank">${i + 1}</span>
          <span class="leaderboard-name">${escapeHtml(entry.name)}</span>
          <span class="leaderboard-score">${entry.score}/${entry.total} (${entry.percentage}%)</span>
        </li>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // === Quiz Logic ===
  async function loadQuestions() {
    try {
      const response = await fetch('questions.json');
      const allQuestions = await response.json();
      state.questions = shuffle(allQuestions).slice(0, TOTAL_QUESTIONS);
    } catch (err) {
      console.error('Failed to load questions:', err);
      showToast('Failed to load questions. Please refresh.');
    }
  }

  function startQuiz() {
    state.currentIndex = 0;
    state.score = 0;
    state.timeRemaining = TOTAL_TIME;
    state.quizActive = true;
    state.answered = false;

    showScreen('quiz');
    renderQuestion();
    startTimer();
    els.scoreTracker.textContent = 'Score: 0';
  }

  function startTimer() {
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
      state.timeRemaining--;
      updateTimerDisplay();

      if (state.timeRemaining <= 0) {
        endQuiz();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    els.timerDisplay.textContent = formatTime(state.timeRemaining);
    const percentage = (state.timeRemaining / TOTAL_TIME) * 100;
    els.timerBar.style.width = percentage + '%';

    if (state.timeRemaining <= 60) {
      els.timerBar.classList.add('warning');
      els.timerDisplay.parentElement.classList.add('warning');
    } else {
      els.timerBar.classList.remove('warning');
      els.timerDisplay.parentElement.classList.remove('warning');
    }
  }

  function renderQuestion() {
    const q = state.questions[state.currentIndex];
    state.answered = false;

    els.questionCounter.textContent = `Question ${state.currentIndex + 1} of ${state.questions.length}`;
    els.progressBar.style.width = ((state.currentIndex) / state.questions.length * 100) + '%';
    els.questionText.textContent = q.question;
    els.explanation.hidden = true;
    els.nextBtn.hidden = true;

    els.optionsList.innerHTML = q.options.map((opt, i) => `
      <li>
        <button class="option-btn" data-index="${i}" aria-label="Option ${i + 1}: ${opt}">
          ${escapeHtml(opt)}
        </button>
      </li>
    `).join('');

    // Focus the question for screen readers
    els.questionText.focus();
  }

  function handleAnswer(selectedIndex) {
    if (state.answered || !state.quizActive) return;
    state.answered = true;

    const q = state.questions[state.currentIndex];
    const buttons = els.optionsList.querySelectorAll('.option-btn');
    const isCorrect = selectedIndex === q.correct;

    if (isCorrect) state.score++;

    // Update live score tracker
    els.scoreTracker.textContent = `Score: ${state.score}`;

    buttons.forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correct) {
        btn.classList.add('correct');
      } else if (i === selectedIndex && !isCorrect) {
        btn.classList.add('incorrect');
      } else {
        btn.classList.add('dimmed');
      }
    });

    // Show explanation
    els.explanationText.textContent = q.explanation;
    els.explanation.hidden = false;

    // Show next button or finish
    if (state.currentIndex < state.questions.length - 1) {
      els.nextBtn.textContent = 'Next Question';
    } else {
      els.nextBtn.textContent = 'See Results';
    }
    els.nextBtn.hidden = false;
    els.nextBtn.focus();
  }

  function nextQuestion() {
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex++;
      renderQuestion();
    } else {
      endQuiz();
    }
  }

  function endQuiz() {
    state.quizActive = false;
    clearInterval(state.timerInterval);

    const total = Math.min(state.currentIndex + (state.answered ? 1 : 0), state.questions.length);
    const answeredCount = state.answered ? state.currentIndex + 1 : state.currentIndex;

    els.scoreNumber.textContent = state.score;
    els.scoreTotal.textContent = `/ ${answeredCount}`;

    const percentage = answeredCount > 0 ? Math.round((state.score / answeredCount) * 100) : 0;
    els.scorePercentage.textContent = `${percentage}% correct`;
    els.scoreMessage.textContent = getScoreMessage(percentage, state.playerName);

    // Update progress bar to full
    els.progressBar.style.width = '100%';

    // Save and render leaderboard
    saveToLeaderboard(state.playerName, state.score, answeredCount);
    renderLeaderboard(state.playerName, state.score);

    showScreen('results');
  }

  function getScoreMessage(percentage, name) {
    if (percentage >= 90) return `Outstanding, ${name}. You clearly know your AI and cloud.`;
    if (percentage >= 70) return `Strong result, ${name}. Solid knowledge across the board.`;
    if (percentage >= 50) return `Good effort, ${name}. A few areas to brush up on.`;
    if (percentage >= 30) return `Not bad, ${name}. There's plenty to learn — and that's the point.`;
    return `Early days, ${name}. Every expert started somewhere.`;
  }

  function shareScore() {
    const answeredCount = state.answered ? state.currentIndex + 1 : state.currentIndex;
    const percentage = answeredCount > 0 ? Math.round((state.score / answeredCount) * 100) : 0;
    const text = `I scored ${state.score}/${answeredCount} (${percentage}%) on the Jezero AI Quiz — testing knowledge on AI, cloud, and data. Think you can beat it?`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Score copied to clipboard');
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('Score copied to clipboard');
    } catch {
      showToast('Could not copy to clipboard');
    }
    document.body.removeChild(textarea);
  }

  async function restart() {
    await loadQuestions();
    showScreen('landing');
    els.nameInput.value = state.playerName;
    els.nameInput.focus();
  }

  // === Event Listeners ===
  els.nameInput.addEventListener('input', () => {
    els.startBtn.disabled = els.nameInput.value.trim().length === 0;
  });

  els.nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && els.nameInput.value.trim().length > 0) {
      els.startBtn.click();
    }
  });

  els.startBtn.addEventListener('click', async () => {
    state.playerName = els.nameInput.value.trim();
    if (!state.playerName) return;

    els.startBtn.disabled = true;
    els.startBtn.textContent = 'Loading...';

    await loadQuestions();

    if (state.questions.length === 0) {
      els.startBtn.disabled = false;
      els.startBtn.textContent = 'Start Quiz';
      return;
    }

    els.startBtn.textContent = 'Start Quiz';
    startQuiz();
  });

  els.optionsList.addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    handleAnswer(parseInt(btn.dataset.index, 10));
  });

  els.nextBtn.addEventListener('click', nextQuestion);

  els.shareBtn.addEventListener('click', shareScore);

  els.restartBtn.addEventListener('click', restart);

  // Keyboard navigation for options
  els.optionsList.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const btn = e.target.closest('.option-btn');
      if (btn && !btn.disabled) {
        e.preventDefault();
        handleAnswer(parseInt(btn.dataset.index, 10));
      }
    }
  });

  // === Init ===
  showScreen('landing');
  els.startBtn.disabled = true;
})();
