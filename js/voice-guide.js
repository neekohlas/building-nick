/**
 * Building Nick - Voice-Guided Exercise Module
 * Provides text-to-speech and speech recognition for step-by-step exercise guidance
 */

const VoiceGuide = {
  // State
  currentActivity: null,
  currentStepIndex: 0,
  steps: [],
  isActive: false,
  isPaused: false,
  isListening: false,
  isSpeaking: false,

  // Speech APIs
  synthesis: window.speechSynthesis,
  recognition: null,
  utterance: null,

  // Settings
  speechRate: 0.9,
  speechPitch: 1,
  voicePreference: null, // Will use default

  // Voice command patterns
  commands: {
    next: ['next', 'continue', 'go', 'next step', 'okay', 'ok'],
    repeat: ['repeat', 'again', 'say that again', 'what'],
    back: ['back', 'previous', 'go back'],
    pause: ['pause', 'stop', 'wait', 'hold on', 'hold'],
    resume: ['resume', 'go ahead', 'start', 'play']
  },

  /**
   * Initialize the voice guide module
   */
  init() {
    // Check for speech synthesis support
    if (!('speechSynthesis' in window)) {
      console.warn('[VoiceGuide] Speech synthesis not supported');
    }

    // Initialize speech recognition if available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event) => this.handleSpeechResult(event);
      this.recognition.onerror = (event) => this.handleSpeechError(event);
      this.recognition.onend = () => this.handleRecognitionEnd();
    } else {
      console.warn('[VoiceGuide] Speech recognition not supported');
    }

    // Set up modal event listeners
    this.setupModalListeners();
  },

  /**
   * Check if voice guide is available for an activity
   */
  isAvailable(activity) {
    return activity && activity.steps && activity.steps.length > 0;
  },

  /**
   * Check if speech synthesis is supported
   */
  hasTTS() {
    return 'speechSynthesis' in window;
  },

  /**
   * Check if speech recognition is supported
   */
  hasRecognition() {
    return this.recognition !== null;
  },

  /**
   * Start a voice-guided exercise session
   */
  start(activity) {
    if (!this.isAvailable(activity)) {
      console.error('[VoiceGuide] Activity has no steps');
      return false;
    }

    this.currentActivity = activity;
    this.steps = activity.steps;
    this.currentStepIndex = 0;
    this.isActive = true;
    this.isPaused = false;

    // Show the voice guide modal
    this.showModal();

    // Start with the first step
    this.renderCurrentStep();
    this.speakCurrentStep();

    // Start listening for voice commands
    if (this.hasRecognition()) {
      this.startListening();
    }

    return true;
  },

  /**
   * Stop the voice guide session
   */
  stop() {
    this.isActive = false;
    this.isPaused = false;
    this.currentActivity = null;
    this.steps = [];
    this.currentStepIndex = 0;

    // Stop speech
    this.synthesis.cancel();
    this.isSpeaking = false;

    // Stop recognition
    this.stopListening();

    // Hide modal
    this.hideModal();
  },

  /**
   * Pause the current session
   */
  pause() {
    if (!this.isActive) return;

    this.isPaused = true;
    this.synthesis.cancel();
    this.isSpeaking = false;
    this.updateStatus('Paused - say "resume" or tap play');
  },

  /**
   * Resume a paused session
   */
  resume() {
    if (!this.isActive || !this.isPaused) return;

    this.isPaused = false;
    this.speakCurrentStep();
    this.updateStatus('Listening...');
  },

  /**
   * Go to the next step
   */
  nextStep() {
    if (!this.isActive || this.currentStepIndex >= this.steps.length - 1) {
      // At the last step - complete
      this.complete();
      return;
    }

    this.synthesis.cancel();
    this.currentStepIndex++;
    this.renderCurrentStep();
    this.speakCurrentStep();
  },

  /**
   * Go to the previous step
   */
  previousStep() {
    if (!this.isActive || this.currentStepIndex <= 0) return;

    this.synthesis.cancel();
    this.currentStepIndex--;
    this.renderCurrentStep();
    this.speakCurrentStep();
  },

  /**
   * Repeat the current step
   */
  repeatStep() {
    if (!this.isActive) return;

    this.synthesis.cancel();
    this.speakCurrentStep();
  },

  /**
   * Complete the exercise
   */
  complete() {
    this.synthesis.cancel();
    this.stopListening();

    // Show completion state
    const stepContent = document.getElementById('voiceGuideStepContent');
    const stepProgress = document.getElementById('voiceGuideProgress');

    if (stepContent) {
      stepContent.innerHTML = `
        <div class="voice-guide-complete">
          <div class="complete-icon">&#10003;</div>
          <h3>Exercise Complete!</h3>
          <p>Great work completing ${this.currentActivity.name}</p>
        </div>
      `;
    }

    if (stepProgress) {
      stepProgress.textContent = 'Complete';
    }

    this.updateStatus('');

    // Speak completion message
    this.speak('Exercise complete. Great work!', () => {
      // Activity can be marked complete via the button
    });
  },

  /**
   * Speak text using TTS
   */
  speak(text, onEnd = null) {
    if (!this.hasTTS()) {
      if (onEnd) onEnd();
      return;
    }

    this.synthesis.cancel();

    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.rate = this.speechRate;
    this.utterance.pitch = this.speechPitch;

    if (this.voicePreference) {
      this.utterance.voice = this.voicePreference;
    }

    this.utterance.onstart = () => {
      this.isSpeaking = true;
    };

    this.utterance.onend = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    this.utterance.onerror = (event) => {
      console.error('[VoiceGuide] Speech error:', event.error);
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    this.synthesis.speak(this.utterance);
  },

  /**
   * Speak the current step
   */
  speakCurrentStep() {
    if (this.isPaused) return;

    const stepNumber = this.currentStepIndex + 1;
    const stepText = this.steps[this.currentStepIndex];
    const fullText = `Step ${stepNumber}. ${stepText}`;

    this.speak(fullText);
  },

  /**
   * Start listening for voice commands
   */
  startListening() {
    if (!this.hasRecognition() || this.isListening) return;

    try {
      this.recognition.start();
      this.isListening = true;
      this.updateStatus('Listening...');
    } catch (error) {
      console.error('[VoiceGuide] Failed to start recognition:', error);
    }
  },

  /**
   * Stop listening for voice commands
   */
  stopListening() {
    if (!this.hasRecognition() || !this.isListening) return;

    try {
      this.recognition.stop();
      this.isListening = false;
    } catch (error) {
      console.error('[VoiceGuide] Failed to stop recognition:', error);
    }
  },

  /**
   * Handle speech recognition results
   */
  handleSpeechResult(event) {
    const last = event.results.length - 1;
    const transcript = event.results[last][0].transcript.toLowerCase().trim();

    console.log('[VoiceGuide] Heard:', transcript);

    // Match against command patterns
    if (this.matchCommand(transcript, 'next')) {
      this.nextStep();
    } else if (this.matchCommand(transcript, 'repeat')) {
      this.repeatStep();
    } else if (this.matchCommand(transcript, 'back')) {
      this.previousStep();
    } else if (this.matchCommand(transcript, 'pause')) {
      this.pause();
    } else if (this.matchCommand(transcript, 'resume')) {
      this.resume();
    }
  },

  /**
   * Match transcript against command patterns
   */
  matchCommand(transcript, commandType) {
    const patterns = this.commands[commandType];
    return patterns.some(pattern => transcript.includes(pattern));
  },

  /**
   * Handle speech recognition errors
   */
  handleSpeechError(event) {
    console.error('[VoiceGuide] Recognition error:', event.error);

    if (event.error === 'not-allowed') {
      this.updateStatus('Microphone access denied');
    } else if (event.error === 'no-speech') {
      // This is normal, just restart
    }
  },

  /**
   * Handle recognition ending (restart if still active)
   */
  handleRecognitionEnd() {
    this.isListening = false;

    // Restart if session is still active and not paused
    if (this.isActive && !this.isPaused) {
      setTimeout(() => {
        this.startListening();
      }, 100);
    }
  },

  /**
   * Show the voice guide modal
   */
  showModal() {
    const modal = document.getElementById('voiceGuideModal');
    if (modal) {
      modal.classList.add('visible');
    }
  },

  /**
   * Hide the voice guide modal
   */
  hideModal() {
    const modal = document.getElementById('voiceGuideModal');
    if (modal) {
      modal.classList.remove('visible');
    }
  },

  /**
   * Render the current step in the modal
   */
  renderCurrentStep() {
    const stepContent = document.getElementById('voiceGuideStepContent');
    const stepProgress = document.getElementById('voiceGuideProgress');
    const title = document.getElementById('voiceGuideTitle');

    if (title && this.currentActivity) {
      title.textContent = this.currentActivity.name;
    }

    if (stepProgress) {
      stepProgress.textContent = `Step ${this.currentStepIndex + 1} of ${this.steps.length}`;
    }

    if (stepContent) {
      stepContent.innerHTML = `
        <div class="voice-guide-step">
          <div class="step-number">${this.currentStepIndex + 1}</div>
          <p class="step-text">${this.steps[this.currentStepIndex]}</p>
        </div>
      `;
    }

    // Update button states
    this.updateButtonStates();
  },

  /**
   * Update control button states
   */
  updateButtonStates() {
    const prevBtn = document.getElementById('voiceGuidePrev');
    const nextBtn = document.getElementById('voiceGuideNext');

    if (prevBtn) {
      prevBtn.disabled = this.currentStepIndex <= 0;
    }

    if (nextBtn) {
      nextBtn.textContent = this.currentStepIndex >= this.steps.length - 1 ? 'Finish' : 'Next';
    }
  },

  /**
   * Update the status display
   */
  updateStatus(text) {
    const status = document.getElementById('voiceGuideStatus');
    if (status) {
      status.textContent = text;
    }
  },

  /**
   * Set up modal event listeners
   */
  setupModalListeners() {
    // Close button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'closeVoiceGuide' || e.target.closest('#closeVoiceGuide')) {
        this.stop();
      }
    });

    // Control buttons
    document.addEventListener('click', (e) => {
      if (e.target.id === 'voiceGuidePrev' || e.target.closest('#voiceGuidePrev')) {
        this.previousStep();
      }
      if (e.target.id === 'voiceGuideNext' || e.target.closest('#voiceGuideNext')) {
        this.nextStep();
      }
      if (e.target.id === 'voiceGuideRepeat' || e.target.closest('#voiceGuideRepeat')) {
        this.repeatStep();
      }
      if (e.target.id === 'voiceGuidePause' || e.target.closest('#voiceGuidePause')) {
        if (this.isPaused) {
          this.resume();
          e.target.textContent = 'Pause';
        } else {
          this.pause();
          e.target.textContent = 'Resume';
        }
      }
    });

    // Mark complete button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'voiceGuideComplete' || e.target.closest('#voiceGuideComplete')) {
        if (this.currentActivity) {
          // Trigger activity completion
          const activityId = this.currentActivity.id;
          this.stop();
          // Call the completion function from ui.js (available globally)
          if (window.completeActivity) {
            window.completeActivity(activityId);
          }
        }
      }
    });

    // Close on overlay click
    document.addEventListener('click', (e) => {
      if (e.target.id === 'voiceGuideModal') {
        this.stop();
      }
    });
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  VoiceGuide.init();
});

// Export for use in other modules
window.VoiceGuide = VoiceGuide;
