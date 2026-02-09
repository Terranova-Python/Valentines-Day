const scroller = document.getElementById('scroller');
const scenes = Array.from(document.querySelectorAll('.scene'));
const progress = document.getElementById('progress');
const soundToggle = document.getElementById('sound-toggle');
const playAgainBtn = document.getElementById('play-again');

let currentIndex = 0;

const dots = scenes.map((scene, index) => {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.className = 'progress-dot';
  dot.addEventListener('click', () => {
    if (index <= currentIndex) {
      goTo(index);
    }
  });
  progress.appendChild(dot);
  return dot;
});

const fallbackTones = {
  'scene-1': 220,
  'scene-2': 196,
  'scene-3': 246,
  'scene-4': 262,
  'scene-5': 174,
  'scene-6': 233,
  'scene-7': 207,
  'scene-8': 294,
  'scene-9': 262,
  'scene-10': 196,
  'scene-11': 220,
  'scene-12': 174,
};

const fallbackSfx = {
  'scene-1': 523,
  'scene-2': 587,
  'scene-3': 659,
  'scene-4': 740,
  'scene-5': 494,
  'scene-6': 784,
  'scene-7': 554,
  'scene-8': 698,
  'scene-9': 880,
  'scene-10': 622,
  'scene-11': 988,
};

let soundEnabled = true;
let soundUnlocked = false;
let audioContext = null;
let currentBg = null;
let currentBgScene = null;
let currentBgSrc = null;
let bgRequestId = 0;

const updateSoundToggle = () => {
  if (!soundToggle) {
    return;
  }
  soundToggle.textContent = soundEnabled ? 'Sound: On' : 'Sound: Off';
  soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  soundToggle.classList.toggle('off', !soundEnabled);
};

const ensureAudioContext = () => {
  if (!soundEnabled) {
    return null;
  }
  if (!audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return null;
    }
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
};

const playBeep = ({ frequency = 440, duration = 0.18, volume = 0.12, type = 'sine' } = {}) => {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.0001;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.05);
};

const createPad = (frequency = 220) => {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return null;
  }
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  gain.connect(ctx.destination);

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = 'sine';
  osc2.type = 'triangle';
  osc1.frequency.value = frequency;
  osc2.frequency.value = frequency * 1.5;
  osc1.connect(gain);
  osc2.connect(gain);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = 0.03;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);

  const now = ctx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.04, now + 0.8);

  osc1.start();
  osc2.start();
  lfo.start();

  return {
    stop: () => {
      const stopAt = ctx.currentTime + 0.5;
      gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
      osc1.stop(stopAt + 0.1);
      osc2.stop(stopAt + 0.1);
      lfo.stop(stopAt + 0.1);
    },
  };
};

const stopBg = () => {
  if (!currentBg) {
    return;
  }
  currentBg.stop();
  currentBg = null;
  currentBgScene = null;
  currentBgSrc = null;
};

const playBgForScene = (sceneId, { force = false } = {}) => {
  if (!soundEnabled || !soundUnlocked) {
    return;
  }
  const scene = document.getElementById(sceneId);
  if (!scene) {
    return;
  }
  if (!force && scene.dataset.bgAuto === 'false') {
    if (currentBgScene !== sceneId) {
      stopBg();
    }
    return;
  }
  if (currentBgScene === sceneId) {
    return;
  }
  const bgSrc = scene.dataset.bg;
  if (bgSrc && currentBgSrc === bgSrc && currentBg) {
    currentBgScene = sceneId;
    return;
  }
  stopBg();
  const requestId = ++bgRequestId;
  currentBgScene = sceneId;
  currentBgSrc = bgSrc || null;
  if (bgSrc) {
    const audio = new Audio(bgSrc);
    audio.loop = true;
    audio.volume = 0.25;
    currentBg = {
      stop: () => {
        audio.pause();
        audio.currentTime = 0;
      },
    };
    audio.play()
      .then(() => {
        if (requestId !== bgRequestId) {
          audio.pause();
          audio.currentTime = 0;
        }
      })
      .catch(() => {
        if (requestId !== bgRequestId) {
          return;
        }
        const pad = createPad(fallbackTones[sceneId] || 220);
        currentBg = pad || null;
      });
  } else {
    const pad = createPad(fallbackTones[sceneId] || 220);
    currentBg = pad || null;
  }
};

const playSfxForScene = (sceneId) => {
  if (!soundEnabled || !soundUnlocked) {
    return;
  }
  const scene = document.getElementById(sceneId);
  const sfxSrc = scene?.dataset.sfx;
  if (sfxSrc) {
    const audio = new Audio(sfxSrc);
    audio.volume = 0.6;
    audio.play().catch(() => {
      playBeep({ frequency: fallbackSfx[sceneId] || 660, type: 'triangle' });
    });
  } else {
    playBeep({ frequency: fallbackSfx[sceneId] || 660, type: 'triangle' });
  }
};

const playChomp = () => {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  const bufferSize = 0.12 * ctx.sampleRate;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;

  const gain = ctx.createGain();
  gain.gain.value = 0.0001;

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  noise.start(now);
  noise.stop(now + 0.2);
};

const unlockSound = () => {
  if (!soundEnabled || soundUnlocked) {
    return;
  }
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  soundUnlocked = true;
  updateSoundToggle();
  playBgForScene(scenes[currentIndex].id);
};

if (soundToggle) {
  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    updateSoundToggle();
    if (!soundEnabled) {
      stopBg();
      return;
    }
    unlockSound();
    playBgForScene(scenes[currentIndex].id);
  });
}

window.addEventListener('pointerdown', unlockSound, { once: true });
window.addEventListener('keydown', unlockSound, { once: true });

updateSoundToggle();

if (playAgainBtn) {
  playAgainBtn.addEventListener('click', () => {
    window.location.reload();
  });
}

function updateProgress() {
  dots.forEach((dot, index) => {
    const scene = scenes[index];
    dot.classList.toggle('active', index === currentIndex);
    dot.classList.toggle('complete', scene.dataset.complete === 'true');
  });
}

function goTo(index) {
  currentIndex = Math.max(0, Math.min(index, scenes.length - 1));
  const target = scenes[currentIndex];
  const offset = target ? target.offsetTop : window.innerHeight * currentIndex;
  scroller.style.transform = `translateY(-${offset}px)`;
  scenes.forEach((scene, i) => scene.classList.toggle('active', i === currentIndex));
  if (soundEnabled && soundUnlocked) {
    playBgForScene(scenes[currentIndex].id);
  } else {
    stopBg();
  }
  updateProgress();
}

function completeScene(sceneId, options = {}) {
  const scene = document.getElementById(sceneId);
  if (!scene || scene.dataset.complete === 'true') {
    return;
  }
  scene.dataset.complete = 'true';
  scene.classList.add('complete');
  playSfxForScene(sceneId);
  const status = scene.querySelector('.task-status');
  if (status) {
    status.textContent = 'Completed. Moving on...';
  }
  updateProgress();
  const index = scenes.indexOf(scene);
  const delay = Number(options.delay ?? 1100);
  if (index >= 0 && index < scenes.length - 1 && scenes[currentIndex] === scene) {
    setTimeout(() => goTo(index + 1), delay);
  }
}

window.addEventListener('resize', () => goTo(currentIndex));

goTo(0);

// Scene 1: band play
(() => {
  const scene = document.getElementById('scene-1');
  const playBtn = scene.querySelector('.play-btn');
  const status = scene.querySelector('.task-status');
  let timer = null;
  let seconds = 0;
  const duration = 8;

  playBtn.addEventListener('click', () => {
    if (scene.dataset.complete === 'true') {
      return;
    }
    unlockSound();
    playBgForScene('scene-1', { force: true });
    playBtn.disabled = true;
    scene.classList.add('playing');
    status.textContent = `Listening... ${duration}s`;
    seconds = duration;
    timer = setInterval(() => {
      seconds -= 1;
      status.textContent = `Listening... ${seconds}s`;
      if (seconds <= 0) {
        clearInterval(timer);
        scene.classList.remove('playing');
        completeScene('scene-1');
      }
    }, 1000);
  });
})();

// Scene 2: lift barbell
(() => {
  const scene = document.getElementById('scene-2');
  const liftBtn = scene.querySelector('.lift-btn');
  const media = scene.querySelector('.gym-media');
  const frame = scene.querySelector('.gym-frame');
  const status = scene.querySelector('.task-status');
  const stillSrc = media?.dataset.still;
  const gifSrc = media?.dataset.gif;
  let playing = false;

  if (frame && stillSrc) {
    frame.addEventListener('error', () => {
      if (gifSrc) {
        frame.src = gifSrc;
      }
    });
    frame.src = stillSrc;
  } else if (frame && gifSrc) {
    frame.src = gifSrc;
  }

  liftBtn.addEventListener('click', () => {
    if (scene.dataset.complete === 'true' || playing) {
      return;
    }
    unlockSound();
    liftBtn.disabled = true;
    playing = true;
    status.textContent = 'Lifting...';
    if (frame && gifSrc) {
      const cacheBust = `${gifSrc}?v=${Date.now()}`;
      frame.src = cacheBust;
    }
    setTimeout(() => {
      status.textContent = 'PR unlocked!';
      completeScene('scene-2');
      playing = false;
    }, 8000);
  });
})();

// Scene 3: climb mountain
(() => {
  const scene = document.getElementById('scene-3');
  const climbBtn = scene.querySelector('.climb-btn');
  const status = scene.querySelector('.task-status');
  const climber = scene.querySelector('.hiker');
  const sun = scene.querySelector('.sun');
  let progress = 0;

  const step = (amount) => {
    if (scene.dataset.complete === 'true') {
      return;
    }
    progress = Math.min(100, progress + amount);
    const left = 8 + progress * 0.4;
    const bottom = 8 + progress * 0.52;
    climber.style.left = `${left}%`;
    climber.style.bottom = `${bottom}%`;
    sun.style.opacity = (progress / 100).toString();
    sun.style.transform = `translateY(${20 - progress * 0.15}px)`;
    status.textContent = progress >= 100 ? 'Summit reached!' : 'Keep climbing.';
    if (progress >= 100) {
      completeScene('scene-3');
    }
  };

  climbBtn.addEventListener('click', () => step(12));
  document.addEventListener('keydown', (event) => {
    if (currentIndex === 2 && event.key === 'ArrowUp') {
      step(6);
    }
  });
})();

// Scene 4: dance
(() => {
  const scene = document.getElementById('scene-4');
  const dancer = scene.querySelector('.dancer');
  const status = scene.querySelector('.task-status');
  const leftBtn = scene.querySelector('.dance-left');
  const rightBtn = scene.querySelector('.dance-right');
  let moves = 0;
  let left = true;
  const base = 50;
  const offset = 4;

  const applyPose = (isLeft) => {
    const rotation = isLeft ? -6 : 6;
    const tilt = isLeft ? -2 : 2;
    dancer.style.left = `${isLeft ? base - offset : base + offset}%`;
    dancer.style.transform = `translate(-50%, ${tilt}px) rotate(${rotation}deg)`;
  };

  const move = (dir) => {
    if (scene.dataset.complete === 'true') {
      return;
    }
    moves += 1;
    left = dir === 'left' ? true : false;
    applyPose(left);
    const remaining = Math.max(0, 8 - moves);
    status.textContent = remaining === 0 ? 'Perfect rhythm.' : `${remaining} moves left.`;
    if (moves >= 8) {
      completeScene('scene-4');
    }
  };

  applyPose(left);

  leftBtn.addEventListener('click', () => move('left'));
  rightBtn.addEventListener('click', () => move('right'));

  document.addEventListener('keydown', (event) => {
    if (currentIndex !== 3) {
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      move('left');
    }
    if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      move('right');
    }
  });
})();

// Scene 5: pets
(() => {
  const scene = document.getElementById('scene-5');
  const buttons = Array.from(scene.querySelectorAll('.feed-btn'));
  const kibbleLayer = scene.querySelector('.kibble-layer');
  const status = scene.querySelector('.task-status');
  const createKibble = () => {
    if (!kibbleLayer) {
      return;
    }
    for (let i = 0; i < 6; i += 1) {
      const piece = document.createElement('span');
      piece.className = 'kibble-piece';
      piece.style.left = `${20 + Math.random() * 60}%`;
      piece.style.top = `${10 + Math.random() * 20}%`;
      piece.style.animationDelay = `${Math.random() * 0.2}s`;
      kibbleLayer.appendChild(piece);
      piece.addEventListener('animationend', () => {
        piece.remove();
      });
    }
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.classList.contains('fed')) {
        return;
      }
      unlockSound();
      playChomp();
      button.classList.add('fed');
      createKibble();
      const fedCount = buttons.filter((item) => item.classList.contains('fed')).length;
      status.textContent = fedCount === buttons.length ? 'Everyone is fed!' : 'Keep feeding.';
      if (fedCount === buttons.length) {
        completeScene('scene-5');
      }
    });
  });
})();

// Scene 6: kiss in Iceland
(() => {
  const scene = document.getElementById('scene-6');
  const slider = scene.querySelector('.kiss-slider');
  const leftPerson = scene.querySelector('.person-left');
  const rightPerson = scene.querySelector('.person-right');
  const heart = scene.querySelector('.kiss-heart');

  slider.addEventListener('input', () => {
    const value = Number(slider.value);
    leftPerson.style.transform = `translate(${value * 0.5}px, 0px)`;
    rightPerson.style.transform = `translate(${value * -0.5}px, 12px)`;
    heart.style.opacity = (value / 100).toString();
    if (value >= 100) {
      completeScene('scene-6');
    }
  });

  const parallax = scene.querySelector('#parallax-iceland');
  const layers = Array.from(parallax.querySelectorAll('[data-depth]'));
  parallax.addEventListener('mousemove', (event) => {
    const rect = parallax.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    layers.forEach((layer) => {
      const depth = Number(layer.dataset.depth);
      const moveX = x * depth * 30;
      const moveY = y * depth * 20;
      layer.style.transform = `translate(${moveX}px, ${moveY}px)`;
    });
  });

  parallax.addEventListener('mouseleave', () => {
    layers.forEach((layer) => {
      layer.style.transform = 'translate(0px, 0px)';
    });
  });
})();

// Scene 7: winter walk
(() => {
  const scene = document.getElementById('scene-7');
  const walkBtn = scene.querySelector('.walk-btn');
  const walker = scene.querySelector('.walker');
  const status = scene.querySelector('.task-status');
  let walking = false;
  let progress = 0;
  let timer = null;

  const updateWalk = () => {
    progress = Math.min(100, progress + 1.5);
    const left = 10 + progress * 0.7;
    walker.style.left = `${left}%`;
    status.textContent = progress >= 100 ? 'You made it through.' : 'Keep going...';
    if (progress >= 100) {
      stopWalk();
      completeScene('scene-7');
    }
  };

  const startWalk = () => {
    if (walking) {
      return;
    }
    walking = true;
    timer = setInterval(updateWalk, 40);
  };

  const stopWalk = () => {
    walking = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  walkBtn.addEventListener('mousedown', startWalk);
  walkBtn.addEventListener('touchstart', (event) => {
    event.preventDefault();
    startWalk();
  });
  window.addEventListener('mouseup', stopWalk);
  window.addEventListener('touchend', stopWalk);

  document.addEventListener('keydown', (event) => {
    if (currentIndex === 6 && event.code === 'Space') {
      startWalk();
    }
  });
  document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
      stopWalk();
    }
  });
})();

// Scene 8: tennis
(() => {
  const canvas = document.getElementById('tennis-canvas');
  const scoreEl = document.getElementById('tennis-score');
  const playerScoreEl = document.getElementById('tennis-player-score');
  const opponentScoreEl = document.getElementById('tennis-opponent-score');
  const rallyEl = document.getElementById('tennis-rally');
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext('2d');
  const paddleWidth = 150;
  const paddleBottom = { x: canvas.width / 2 - paddleWidth / 2, y: 0, w: paddleWidth, h: 24 };
  const paddleTop = { x: canvas.width / 2 - paddleWidth / 2, y: 12, w: paddleWidth, h: 24 };
  const ball = { x: canvas.width / 2, y: canvas.height / 2, vx: 2.4, vy: 3.4, r: 7 };
  const scoreTerms = ['Love', '15', '30', '40', 'Game'];
  let playerPoints = 0;
  let opponentPoints = 0;
  let rallyCount = 0;
  let running = true;
  let aiTimer = 0;
  let aiOffset = 0;
  let activeLastFrame = false;
  let started = false;

  const herImg = new Image();
  herImg.src = 'assets/audio/pictures/tennis_her.png';
  const himImg = new Image();
  himImg.src = 'assets/audio/pictures/tennis_him.png';

  const updatePaddleSize = () => {
    if (herImg.complete && herImg.naturalWidth) {
      const ratio = herImg.naturalHeight / herImg.naturalWidth;
      paddleBottom.w = paddleWidth;
      paddleBottom.h = Math.max(18, paddleWidth * ratio);
    }
    if (himImg.complete && himImg.naturalWidth) {
      const ratio = himImg.naturalHeight / himImg.naturalWidth;
      paddleTop.w = paddleWidth;
      paddleTop.h = Math.max(18, paddleWidth * ratio);
    }
    paddleBottom.y = canvas.height - paddleBottom.h - 12;
    paddleTop.y = 12;
  };

  updatePaddleSize();
  herImg.addEventListener('load', updatePaddleSize);
  himImg.addEventListener('load', updatePaddleSize);

  const holdBall = () => {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.vx = 0;
    ball.vy = 0;
    rallyCount = 0;
    if (rallyEl) {
      rallyEl.textContent = String(rallyCount);
    }
  };

  const serveBall = () => {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.vx = 2.2 * (Math.random() > 0.5 ? 1 : -1);
    ball.vy = Math.random() > 0.5 ? 3.2 : -3.2;
    rallyCount = 0;
    if (rallyEl) {
      rallyEl.textContent = String(rallyCount);
    }
  };

  const updateScoreboard = () => {
    if (scoreEl) {
      scoreEl.textContent = String(playerPoints);
    }
    if (playerScoreEl) {
      playerScoreEl.textContent = scoreTerms[playerPoints] || 'Game';
    }
    if (opponentScoreEl) {
      opponentScoreEl.textContent = scoreTerms[opponentPoints] || 'Game';
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255, 160, 190, 0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (herImg.complete && herImg.naturalWidth) {
      ctx.drawImage(herImg, paddleBottom.x, paddleBottom.y, paddleBottom.w, paddleBottom.h);
    } else {
      ctx.fillStyle = '#ff6b9a';
      ctx.fillRect(paddleBottom.x, paddleBottom.y, paddleBottom.w, paddleBottom.h);
    }

    if (himImg.complete && himImg.naturalWidth) {
      ctx.drawImage(himImg, paddleTop.x, paddleTop.y, paddleTop.w, paddleTop.h);
    } else {
      ctx.fillStyle = '#ff9dbb';
      ctx.fillRect(paddleTop.x, paddleTop.y, paddleTop.w, paddleTop.h);
    }

    ctx.beginPath();
    ctx.fillStyle = '#ff7aa8';
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  };

  const updateAI = () => {
    aiTimer -= 1;
    if (aiTimer <= 0) {
      aiOffset = (Math.random() - 0.5) * 120;
      aiTimer = 20 + Math.random() * 40;
    }
    const targetBase = ball.vy < 0 ? ball.x : canvas.width / 2;
    const targetX = targetBase + aiOffset - paddleTop.w / 2;
    const dx = targetX - paddleTop.x;
    const speed = 2.6;
    paddleTop.x += Math.max(-speed, Math.min(speed, dx));
    paddleTop.x = Math.max(0, Math.min(canvas.width - paddleTop.w, paddleTop.x));
  };

  const bounceOffPaddle = (paddle, direction) => {
    const hitPoint = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
    const isPlayer = paddle === paddleBottom;
    const powerShot = isPlayer && Math.random() < 0.25;
    const boost = powerShot ? 1.5 : 1;
    const maxSpeed = powerShot ? 7 : 5.5;
    ball.vx += hitPoint * (powerShot ? 2.2 : 1.4);
    ball.vx = Math.max(-maxSpeed, Math.min(maxSpeed, ball.vx * boost));
    const baseVy = Math.min(maxSpeed, Math.max(2.6, Math.abs(ball.vy) * boost + (powerShot ? 0.6 : 0)));
    ball.vy = direction === 'up' ? -baseVy : baseVy;
    rallyCount += 1;
    if (rallyEl) {
      rallyEl.textContent = String(rallyCount);
    }
  };

  const update = () => {
    if (!running) {
      return;
    }
    const active = scenes[currentIndex]?.id === 'scene-8';
    if (!active) {
      activeLastFrame = false;
      started = false;
      requestAnimationFrame(update);
      return;
    }
    if (!activeLastFrame) {
      holdBall();
      updateScoreboard();
      activeLastFrame = true;
    }
    if (!started) {
      draw();
      requestAnimationFrame(update);
      return;
    }
    updateAI();
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x <= ball.r || ball.x >= canvas.width - ball.r) {
      ball.vx *= -1;
    }

    if (
      ball.y + ball.r >= paddleBottom.y &&
      ball.x >= paddleBottom.x &&
      ball.x <= paddleBottom.x + paddleBottom.w &&
      ball.vy > 0
    ) {
      ball.y = paddleBottom.y - ball.r - 1;
      bounceOffPaddle(paddleBottom, 'up');
    }

    if (
      ball.y - ball.r <= paddleTop.y + paddleTop.h &&
      ball.x >= paddleTop.x + paddleTop.w * 0.25 &&
      ball.x <= paddleTop.x + paddleTop.w * 0.75 &&
      ball.vy < 0
    ) {
      ball.y = paddleTop.y + paddleTop.h + ball.r + 1;
      bounceOffPaddle(paddleTop, 'down');
    }

    if (ball.y <= -20) {
      playerPoints += 1;
      updateScoreboard();
      if (playerPoints >= 3) {
        running = false;
        completeScene('scene-8');
      } else {
        serveBall();
      }
    }

    if (ball.y > canvas.height + 30) {
      serveBall();
    }

    draw();
    requestAnimationFrame(update);
  };

  const handleMove = (clientX) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (clientX - rect.left) * scaleX;
    paddleBottom.x = Math.max(0, Math.min(canvas.width - paddleBottom.w, x - paddleBottom.w / 2));
  };

  const court = canvas.closest('.tennis-court');
  const startMatch = () => {
    if (started) {
      return;
    }
    started = true;
    serveBall();
  };
  if (court) {
    court.addEventListener('mousemove', (event) => handleMove(event.clientX));
    court.addEventListener('touchmove', (event) => {
      if (event.touches[0]) {
        handleMove(event.touches[0].clientX);
      }
    });
    court.addEventListener('pointermove', (event) => handleMove(event.clientX));
    court.addEventListener('mouseenter', startMatch);
    court.addEventListener('pointerenter', startMatch);
    court.addEventListener('touchstart', startMatch, { passive: true });
  } else {
    canvas.addEventListener('mousemove', (event) => handleMove(event.clientX));
    canvas.addEventListener('touchmove', (event) => {
      if (event.touches[0]) {
        handleMove(event.touches[0].clientX);
      }
    });
    canvas.addEventListener('mouseenter', startMatch);
    canvas.addEventListener('pointerenter', startMatch);
    canvas.addEventListener('touchstart', startMatch, { passive: true });
  }

  updateScoreboard();
  draw();
  update();
})();

// Scene 9: wedding kiss
(() => {
  const scene = document.getElementById('scene-9');
  const kissBtn = scene.querySelector('.kiss-btn');
  const confetti = scene.querySelector('.confetti');
  let created = false;

  const buildConfetti = () => {
    if (created) {
      return;
    }
    created = true;
    for (let i = 0; i < 32; i += 1) {
      const piece = document.createElement('span');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay = `${Math.random() * 0.6}s`;
      piece.style.background = i % 2 === 0 ? '#ff6b9a' : '#ffc2d6';
      confetti.appendChild(piece);
    }
  };

  kissBtn.addEventListener('click', () => {
    if (scene.dataset.complete === 'true') {
      return;
    }
    buildConfetti();
    confetti.querySelectorAll('span').forEach((piece) => {
      piece.style.opacity = '1';
      piece.style.animation = 'confetti 2s ease-in-out forwards';
    });
    completeScene('scene-9', { delay: 3500 });
  });
})();

// Scene 10: trees
(() => {
  const scene = document.getElementById('scene-10');
  const trees = Array.from(scene.querySelectorAll('.tree'));
  const status = scene.querySelector('.task-status');
  let cleared = 0;

  const spawnWood = (tree) => {
    for (let i = 0; i < 6; i += 1) {
      const chip = document.createElement('span');
      chip.className = 'wood-chip';
      chip.style.left = `${40 + Math.random() * 20}%`;
      chip.style.top = `${30 + Math.random() * 20}%`;
      chip.style.setProperty('--drift', (Math.random() - 0.5).toFixed(2));
      chip.style.animationDelay = `${Math.random() * 0.05}s`;
      tree.appendChild(chip);
      chip.addEventListener('animationend', () => chip.remove());
    }
  };

  trees.forEach((tree) => {
    tree.addEventListener('click', () => {
      if (tree.classList.contains('cut')) {
        return;
      }
      spawnWood(tree);
      tree.classList.add('cut');
      cleared += 1;
      status.textContent = cleared === trees.length ? 'Property cleared.' : 'Keep clearing.';
      if (cleared === trees.length) {
        completeScene('scene-10');
      }
    });
  });
})();

// Scene 11: valentine
(() => {
  const scene = document.getElementById('scene-11');
  const yesBtn = scene.querySelector('.yes-btn');
  const noBtn = scene.querySelector('.no-btn');
  const container = scene.querySelector('.valentine-buttons');
  let escapes = 0;

  const moveNo = () => {
    const maxX = container.clientWidth - noBtn.offsetWidth;
    const maxY = container.clientHeight - noBtn.offsetHeight;
    const x = Math.random() * maxX * 2 - maxX / 2;
    const y = Math.random() * maxY * 2 - maxY / 2;
    noBtn.style.transform = `translate(${x}px, ${y}px)`;
    escapes += 1;
    if (escapes >= 5) {
      noBtn.style.opacity = '0';
      noBtn.style.pointerEvents = 'none';
    }
  };

  noBtn.addEventListener('mouseenter', moveNo);
  noBtn.addEventListener('click', (event) => {
    event.preventDefault();
    moveNo();
  });

  yesBtn.addEventListener('click', () => {
    completeScene('scene-11');
  });
})();
