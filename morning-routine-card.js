import { LitElement, html, css } from "https://cdn.jsdelivr.net/gh/lit/dist@2/all/lit-all.min.js";

class MorningRoutineCard extends LitElement {
    static properties = {
        _hass: { state: true },
        _config: { state: true },
        _children: { type: Array, state: true },
        _showCamera: { type: Boolean, state: true },
        _showAudioRecorder: { type: Boolean, state: true },
        _showPhoto: { type: Boolean, state: true },
        _currentChild: { type: String, state: true },
        _currentActivity: { type: String, state: true },
        _showReward: { type: Boolean, state: true },
        _rewardChild: { type: Object, state: true },
        _currentRewardQuote: { type: String, state: true },
        _isRecording: { type: Boolean, state: true },
        _recordingTime: { type: Number, state: true },
        _photoChild: { type: Object, state: true },
        _currentTime: { type: Number, state: true },
        _playingAudioChild: { type: String, state: true },
        _showConfirmReset: { type: Boolean, state: true },
        _confirmResetChild: { type: Object, state: true },
        _availableCameras: { type: Array, state: true },
        _selectedCameraId: { type: String, state: true },
        _countdown: { type: Number, state: true },
        _countdownInterval: { type: Object, state: true },
    };

    constructor() {
        super();
        this._children = [];
        this._showCamera = false;
        this._showAudioRecorder = false;
        this._showPhoto = false;
        this._currentChild = null;
        this._currentActivity = null;
        this._showReward = false;
        this._rewardChild = null;
        this._photoChild = null;
        this._currentRewardQuote = null;
        this._isRecording = false;
        this._recordingTime = 0;
        this._mediaRecorder = null;
        this._audioChunks = [];
        this._recordingInterval = null;
        this._currentTime = Date.now();
        this._playingAudioChild = null;
        this._showConfirmReset = false;
        this._confirmResetChild = null;
        this._availableCameras = [];
        this._selectedCameraId = null;
        this._countdown = 0;
        this._countdownInterval = null;

        // Update timer every second
        this._timerInterval = setInterval(() => {
            this._currentTime = Date.now();
        }, 1000);

        // Fun quotes for rewards (Portuguese from Portugal)
        this._rewardQuotes = [
            "🌟 És uma estrela da manhã! Brilhante trabalho! 🌟",
            "🎉 Uau! Completaste tudo! És incrível! 🎉",
            "🏆 Campeão da rotina matinal! Parabéns! 🏆",
            "⭐ Fantástico! Estás a arrasar! ⭐",
            "🎊 Que orgulho! És um exemplo! 🎊",
            "🌈 Brilhante! A tua manhã foi perfeita! 🌈",
            "🚀 És um super-herói matinal! 🚀",
            "💪 Que força! Completaste tudo! 💪",
            "🎯 Acertaste em cheio! Excelente trabalho! 🎯",
            "✨ Mágico! Tudo feito! És espetacular! ✨",
            "🦸 Super trabalho! És o máximo! 🦸",
            "🌟 Que estrela! A manhã foi tua! 🌟",
            "🎨 Obra de arte! Perfeito! 🎨",
            "🏅 Medalha de ouro para ti! 🏅",
            "🎪 Espetacular! És o rei/rainha da manhã! 🎪"
        ];
    }

    setConfig(config) {
        if (!config.children || config.children.length === 0) {
            throw new Error("You must define at least one child in the configuration");
        }
        this._config = { ...config };
        this._config.layout = config.layout || "horizontal";
        this._config.show_progress = config.show_progress !== false;
        this._config.compact = config.compact || false;

        console.log("Morning Routine Card configured for entities:", config.children.map(c => c.entity));
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
        }
    }

    _getTimeUntilSchool() {
        const now = new Date();
        const targetTime = new Date();
        targetTime.setHours(8, 50, 0, 0);

        // If it's past school time, return 0
        if (now >= targetTime) {
            return { minutes: 0, seconds: 0, total: 0 };
        }

        const diff = targetTime - now;
        const totalSeconds = Math.floor(diff / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return { minutes, seconds, total: totalSeconds };
    }

    _getTimerColor(totalSeconds) {
        // Green: more than 30 minutes (1800s)
        // Yellow: 15-30 minutes (900-1800s)
        // Red: less than 15 minutes (900s)
        if (totalSeconds > 1800) return '#4CAF50'; // Green
        if (totalSeconds > 900) return '#FFC107'; // Yellow
        return '#F44336'; // Red
    }

    shouldUpdate(changedProps) {
        // Always update - we need to catch all state changes
        return true;
    }

    set hass(hass) {
        const oldHass = this._hass;
        this._hass = hass;

        // Check if any of our entities have actually changed
        if (oldHass && this._config) {
            let hasChanges = false;
            for (const childConfig of this._config.children) {
                const oldEntity = oldHass.states[childConfig.entity];
                const newEntity = hass.states[childConfig.entity];

                if (!oldEntity || !newEntity) {
                    hasChanges = true;
                    break;
                }

                // Check if last_updated changed (indicates state update)
                if (oldEntity.last_updated !== newEntity.last_updated) {
                    console.log(`[State Change] ${childConfig.entity} updated at ${newEntity.last_updated}`);
                    console.log(`[State Change] Activities:`, JSON.stringify(newEntity.attributes?.activities || []));
                    hasChanges = true;
                    break;
                }
            }

            if (!hasChanges) {
                // No relevant changes, skip update
                return;
            }
        }

        // Update children data with latest state
        this._updateChildrenData();

        // Force a complete re-render
        this.requestUpdate();
    }

    _updateChildrenData() {
        if (!this._hass || !this._config) return;

        this._children = this._config.children.map(childConfig => {
            const entity = this._hass.states[childConfig.entity];
            if (!entity) {
                return {
                    ...childConfig,
                    state: null,
                    activities: [],
                    progress: 0,
                    reward_image: null,
                    error: true,
                };
            }

            return {
                ...childConfig,
                entity: childConfig.entity,
                state: entity,
                activities: entity.attributes.activities || [],
                progress: entity.attributes.progress || 0,
                photo_path: entity.attributes.photo_path,
                audio_recording: entity.attributes.audio_recording,
                reward_image: entity.attributes.reward_image,
                reward_video_id: entity.attributes.reward_video_id,
                all_complete: entity.attributes.all_complete || false,
                error: false,
            };
        });
    }

    render() {
        if (!this._hass || !this._config) {
            return html`<ha-card>Loading...</ha-card>`;
        }

        return html`
            <ha-card>
                <div class="card-content">
                    ${this._renderTimer()}
                    <div class="children-container ${this._config.layout}">
                        ${this._children.map(child => this._renderChild(child))}
                    </div>
                </div>
            </ha-card>
            ${this._renderCameraModal()}
            ${this._renderAudioRecorderModal()}
            ${this._renderPhotoModal()}
            ${this._renderRewardModal()}
            ${this._renderConfirmResetModal()}
        `;
    }

    _renderTimer() {
        const timeData = this._getTimeUntilSchool();
        const timerColor = this._getTimerColor(timeData.total);

        return html`
            <div class="global-timer" style="background-color: ${timerColor}">
                ${timeData.total > 0 ? html`
                    <ha-icon icon="mdi:clock-outline"></ha-icon>
                    <span class="global-timer-text">Tempo até à escola: ${timeData.minutes}:${timeData.seconds.toString().padStart(2, '0')}</span>
                ` : html`
                    <ha-icon icon="mdi:school"></ha-icon>
                    <span class="global-timer-text">Hora da escola!</span>
                `}
            </div>
        `;
    }

    _renderChild(child) {
        if (child.error) {
            return html`
                <div class="child-section error">
                    <p>Erro: Entidade ${child.entity} não encontrada</p>
                </div>
            `;
        }

        const allComplete = child.progress === 100;
        const hasPhoto = child.photo_path;
        const hasAudio = child.audio_recording;

        // Build style without photo background
        let sectionStyle = `--child-color: ${child.color || '#4CAF50'};`;

        return html`
            <div class="child-section" style="${sectionStyle}">
                ${this._config.show_progress ? this._renderHeader(child) : ''}

                <div class="activities-grid ${this._config.compact ? 'compact' : ''}">
                    ${child.activities.map(activity => this._renderActivity(child, activity))}
                </div>

                ${allComplete ? html`
                    <div class="button-container">
                        <mwc-button
                            class="reward-button"
                            raised
                            @click=${() => this._showRewardModal(child)}>
                            <ha-icon icon="mdi:trophy" slot="icon"></ha-icon>
                            Ver Recompensa
                        </mwc-button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    _renderHeader(child) {
        return html`
            <div class="child-header">
                <h2>${child.name}</h2>
                <div class="header-right">
                    <mwc-icon-button
                        class="reset-button"
                        @click=${() => this._showResetConfirmation(child)}>
                        <ha-icon icon="mdi:restart"></ha-icon>
                    </mwc-icon-button>
                    <div class="progress-container">
                        <svg class="progress-ring" width="60" height="60">
                            <circle
                                class="progress-ring-bg"
                                stroke="#e0e0e0"
                                stroke-width="4"
                                fill="transparent"
                                r="26"
                                cx="30"
                                cy="30"
                            ></circle>
                            <circle
                                class="progress-ring-circle"
                                stroke="${child.color || '#4CAF50'}"
                                stroke-width="4"
                                fill="transparent"
                                r="26"
                                cx="30"
                                cy="30"
                                style="stroke-dasharray: ${2 * Math.PI * 26};
                                       stroke-dashoffset: ${2 * Math.PI * 26 * (1 - child.progress / 100)}"
                            ></circle>
                        </svg>
                        <span class="progress-text">${child.progress}%</span>
                    </div>
                </div>
            </div>
        `;
    }

    _renderActivity(child, activity) {
        // ALWAYS read fresh state directly from hass, never use cached child data
        const entityId = child.entity;
        const entity = this._hass?.states?.[entityId];

        if (!entity) {
            console.warn("Entity not found:", entityId);
            return html`<div class="activity-item error">Entity not found</div>`;
        }

        // Get fresh activities from entity attributes
        const freshActivities = entity.attributes?.activities || [];
        const freshActivity = freshActivities.find(a => a.id === activity.id);
        const isCompleted = freshActivity ? freshActivity.completed : false;

        // Log ALL activities during render to track state
        console.log(`[Render ${new Date().toISOString()}] ${child.name}/${activity.id}: completed=${isCompleted}, last_modified=${freshActivity?.last_modified || 'N/A'}`);

        // Check if activity has media
        const hasPhoto = activity.id === 'dressed' && child.photo_path;
        const hasAudio = activity.id === 'breakfast' && child.audio_recording;

        return html`
            <div
                class="activity-item ${isCompleted ? 'completed' : 'pending'} ${hasPhoto || hasAudio ? 'has-media' : ''}"
                @click=${() => this._handleActivityClick(child, activity)}
                data-activity-id="${activity.id}"
                data-completed="${isCompleted}"
            >
                <div class="activity-icon">
                    <ha-icon icon="${activity.icon || 'mdi:check-circle-outline'}"></ha-icon>
                </div>
                <div class="activity-name">${activity.name}</div>

                ${hasPhoto ? html`
                    <div class="activity-media-preview" @click=${(e) => e.stopPropagation()}>
                        <img
                            src="/local/morning_routine_photos/${this._getFilename(child.photo_path)}"
                            alt="Preview"
                            @click=${() => this._handleActivityClick(child, activity)} />
                    </div>
                ` : ''}

                ${hasAudio ? html`
                    <div class="activity-media-preview audio" @click=${(e) => e.stopPropagation()}>
                        <audio
                            id="activity-audio-${child.state.attributes.child}"
                            style="display: none;"
                            @play=${() => this._onAudioPlay(child.state.attributes.child)}
                            @pause=${() => this._onAudioPause(child.state.attributes.child)}
                            @ended=${() => this._onAudioPause(child.state.attributes.child)}>
                            <source src="/local/morning_routine_photos/${this._getFilename(child.audio_recording)}" type="audio/webm">
                        </audio>
                        <button
                            class="audio-play-button"
                            @click=${(e) => {
                                e.stopPropagation();
                                this._toggleAudio(child.state.attributes.child);
                            }}>
                            <ha-icon icon="${this._playingAudioChild === child.state.attributes.child ? 'mdi:pause' : 'mdi:play'}"></ha-icon>
                        </button>
                    </div>
                ` : ''}

                ${isCompleted ? html`
                    <div class="check-mark">
                        <ha-icon icon="mdi:check-circle"></ha-icon>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async _handleActivityClick(child, activity) {
        const childName = child.state.attributes.child;

        // Check if activity requires special interaction (photo or audio)
        if (activity.id === 'breakfast') {
            // Always show audio recorder, never preview
            this._currentChild = childName;
            this._currentActivity = activity.id;
            this._showAudioRecorder = true;
            this.requestUpdate();
        } else if (activity.camera_required) {
            // Always show photo preview/camera, don't toggle
            this._currentChild = childName;
            this._currentActivity = activity.id;

            if (child.photo_path) {
                // Show preview
                this._showPhoto = true;
                this._photoChild = child;
                this.requestUpdate();
            } else {
                // Show camera
                this._showCamera = true;
                this.requestUpdate();
                await this.updateComplete;
                await this._loadCameras();
                this._startCamera();
            }
        } else {
            // Direct completion/toggle for other activities
            if (activity.completed) {
                await this._completeActivity(childName, activity.id, false);
            } else {
                await this._completeActivity(childName, activity.id, true);
            }
        }
    }

    _renderCameraModal() {
        if (!this._showCamera) return html``;

        return html`
            <div class="modal-overlay" @click=${this._closeCamera}>
                <div class="camera-modal" @click=${(e) => e.stopPropagation()}>
                    <div class="camera-header">
                        <h2>📸 Carrega no preview para tirar foto!</h2>
                        <mwc-icon-button @click=${this._closeCamera}>
                            <ha-icon icon="mdi:close"></ha-icon>
                        </mwc-icon-button>
                    </div>
                    ${this._availableCameras.length > 1 ? html`
                        <div class="camera-selector">
                            <label>Câmera:</label>
                            <select @change=${this._onCameraChange}>
                                ${this._availableCameras.map(camera => html`
                                    <option value="${camera.deviceId}" ?selected=${camera.deviceId === this._selectedCameraId}>
                                        ${camera.label || `Câmera ${this._availableCameras.indexOf(camera) + 1}`}
                                    </option>
                                `)}
                            </select>
                        </div>
                    ` : ''}
                    <div class="camera-container" @click=${() => !this._countdown && this._startCountdown()}>
                        <video id="camera-preview" autoplay playsinline></video>
                        <canvas id="camera-canvas" style="display:none"></canvas>
                        ${this._countdown > 0 ? html`
                            <div class="countdown-overlay">
                                <div class="countdown-number">${this._countdown}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    async _loadCameras() {
        try {
            // First, request permission to get device labels
            await navigator.mediaDevices.getUserMedia({ video: true });

            const devices = await navigator.mediaDevices.enumerateDevices();
            this._availableCameras = devices.filter(device => device.kind === 'videoinput');

            if (this._availableCameras.length > 0 && !this._selectedCameraId) {
                // Prefer back camera on mobile
                const backCamera = this._availableCameras.find(cam =>
                    cam.label.toLowerCase().includes('back') ||
                    cam.label.toLowerCase().includes('traseira') ||
                    cam.label.toLowerCase().includes('rear')
                );
                this._selectedCameraId = backCamera ? backCamera.deviceId : this._availableCameras[0].deviceId;
            }

            this.requestUpdate();
        } catch (err) {
            console.error("Erro ao enumerar câmeras:", err);
        }
    }

    async _onCameraChange(e) {
        this._selectedCameraId = e.target.value;
        await this._startCamera();
    }

    async _startCamera() {
        try {
            // Stop existing stream
            const video = this.shadowRoot.getElementById("camera-preview");
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
            }

            console.log("[Camera] Starting camera with deviceId:", this._selectedCameraId);

            // Simplified constraints for better Android compatibility
            const constraints = {
                video: this._selectedCameraId
                    ? {
                        deviceId: { exact: this._selectedCameraId },
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 }
                    }
                    : {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 }
                    }
            };

            console.log("[Camera] Requesting with constraints:", constraints);

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log("[Camera] Stream obtained:", stream.getVideoTracks());

            if (video) {
                video.srcObject = stream;

                // Wait for video to be ready (important for Android)
                await new Promise((resolve) => {
                    video.onloadedmetadata = () => {
                        console.log("[Camera] Video ready:", video.videoWidth, "x", video.videoHeight);
                        video.play().then(() => {
                            console.log("[Camera] Video playing");
                            resolve();
                        }).catch(console.error);
                    };
                });
            }
        } catch (err) {
            console.error("Erro de acesso à câmara:", err);
            alert("Não foi possível aceder à câmara. Por favor certifica-te que o HTTPS está ativado e que as permissões da câmara foram concedidas.");
            this._closeCamera();
        }
    }

    _startCountdown() {
        if (this._countdownInterval) {
            clearInterval(this._countdownInterval);
        }

        this._countdown = 3;
        this.requestUpdate();

        this._countdownInterval = setInterval(() => {
            this._countdown--;
            this.requestUpdate();

            if (this._countdown === 0) {
                clearInterval(this._countdownInterval);
                this._countdownInterval = null;
                this._capturePhoto();
            }
        }, 1000);
    }

    _closeCamera() {
        // Stop camera stream
        const video = this.shadowRoot.getElementById("camera-preview");
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
        this._showCamera = false;
    }

    _renderAudioRecorderModal() {
        if (!this._showAudioRecorder) return html``;

        return html`
            <div class="modal-overlay" @click=${this._closeAudioRecorder}>
                <div class="camera-modal" @click=${(e) => e.stopPropagation()}>
                    <div class="camera-header">
                        <h2>🎤 O que comeste hoje?</h2>
                        <mwc-icon-button @click=${this._closeAudioRecorder}>
                            <ha-icon icon="mdi:close"></ha-icon>
                        </mwc-icon-button>
                    </div>
                    <div class="audio-recorder-container">
                        <div
                            class="recording-indicator ${this._isRecording ? 'recording' : ''}"
                            @click=${() => this._isRecording ? this._stopRecording() : this._startRecording()}>
                            <ha-icon icon="${this._isRecording ? 'mdi:stop' : 'mdi:microphone'}"></ha-icon>
                            ${this._isRecording ? html`<span class="recording-time">${this._formatTime(this._recordingTime)}</span>` : ''}
                        </div>
                        <p class="audio-hint">
                            ${this._isRecording ? 'Carrega para parar e guardar' : 'Carrega no microfone para gravar'}
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    _closeAudioRecorder() {
        if (this._isRecording) {
            this._stopRecordingOnly();
        }
        this._showAudioRecorder = false;
    }

    async _startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this._mediaRecorder = new MediaRecorder(stream);
            this._audioChunks = [];

            this._mediaRecorder.ondataavailable = (event) => {
                this._audioChunks.push(event.data);
            };

            this._mediaRecorder.start();
            this._isRecording = true;
            this._recordingTime = 0;

            // Start timer
            this._recordingInterval = setInterval(() => {
                this._recordingTime++;
                this.requestUpdate();
            }, 1000);

        } catch (err) {
            console.error("Erro ao aceder ao microfone:", err);
            alert("Não foi possível aceder ao microfone. Por favor certifica-te que as permissões do microfone foram concedidas.");
        }
    }

    _stopRecordingOnly() {
        if (this._mediaRecorder && this._isRecording) {
            this._mediaRecorder.stop();
            this._mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this._isRecording = false;
            if (this._recordingInterval) {
                clearInterval(this._recordingInterval);
                this._recordingInterval = null;
            }
        }
    }

    async _stopRecording() {
        if (!this._mediaRecorder || !this._isRecording) return;

        return new Promise((resolve) => {
            this._mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this._audioChunks, { type: 'audio/webm' });

                // Convert to base64
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64Audio = reader.result.split(',')[1];

                    // Save audio
                    try {
                        await this._hass.callService("morning_routine", "save_audio", {
                            child: this._currentChild,
                            audio_data: base64Audio,
                        });

                        // Complete activity
                        await this._completeActivity(this._currentChild, this._currentActivity, true);

                        this._showAudioRecorder = false;
                    } catch (err) {
                        console.error("Erro ao guardar áudio:", err);
                        alert("Falha ao guardar áudio. Por favor tenta novamente.");
                    }
                };
                reader.readAsDataURL(audioBlob);

                // Stop tracks
                this._mediaRecorder.stream.getTracks().forEach(track => track.stop());
                this._isRecording = false;
                if (this._recordingInterval) {
                    clearInterval(this._recordingInterval);
                    this._recordingInterval = null;
                }

                resolve();
            };

            this._mediaRecorder.stop();
        });
    }

    _formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    _toggleAudio(childName) {
        const audio = this.shadowRoot.getElementById(`activity-audio-${childName}`);
        if (!audio) return;

        if (this._playingAudioChild === childName) {
            // Pause current audio
            audio.pause();
            this._playingAudioChild = null;
        } else {
            // Stop any other playing audio
            if (this._playingAudioChild) {
                const currentAudio = this.shadowRoot.getElementById(`activity-audio-${this._playingAudioChild}`);
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                }
            }
            // Play this audio
            audio.play();
            this._playingAudioChild = childName;
        }
        this.requestUpdate();
    }

    _onAudioPlay(childName) {
        // If another audio is playing, stop it
        if (this._playingAudioChild && this._playingAudioChild !== childName) {
            const currentAudio = this.shadowRoot.getElementById(`audio-player-${this._playingAudioChild}`);
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
        }
        this._playingAudioChild = childName;
    }

    _onAudioPause(childName) {
        if (this._playingAudioChild === childName) {
            this._playingAudioChild = null;
        }
    }

    async _capturePhoto() {
        const video = this.shadowRoot.getElementById("camera-preview");
        const canvas = this.shadowRoot.getElementById("camera-canvas");

        if (!video || !canvas) return;

        // Ensure video is ready
        if (video.readyState !== video.HAVE_ENOUGH_DATA) {
            console.warn("Video not ready, waiting...");
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const context = canvas.getContext("2d");

        // Use actual video dimensions
        const width = video.videoWidth || video.clientWidth;
        const height = video.videoHeight || video.clientHeight;

        canvas.width = width;
        canvas.height = height;

        // Clear canvas first
        context.clearRect(0, 0, width, height);

        // Draw video frame
        context.drawImage(video, 0, 0, width, height);

        // Convert to base64 with higher quality (remove data:image/jpeg;base64, prefix)
        const photoData = canvas.toDataURL("image/jpeg", 0.95).split(",")[1];

        // Stop camera
        video.srcObject.getTracks().forEach(track => track.stop());
        this._showCamera = false;

        // Save photo
        try {
            await this._hass.callService("morning_routine", "save_photo", {
                child: this._currentChild,
                photo_data: photoData,
            });

            // Complete activity
            await this._completeActivity(this._currentChild, this._currentActivity);
        } catch (err) {
            console.error("Erro ao guardar foto:", err);
            alert("Falha ao guardar foto. Por favor tenta novamente.");
        }
    }

    async _completeActivity(child, activity, completed = true) {
        try {
            await this._hass.callService("morning_routine", "complete_activity", {
                child: child,
                activity: activity,
                completed: completed,
            });
        } catch (err) {
            console.error("Erro ao atualizar atividade:", err);
            alert("Falha ao atualizar atividade. Por favor tente novamente.");
        }
    }

    _showResetConfirmation(child) {
        this._confirmResetChild = child;
        this._showConfirmReset = true;
    }

    _closeResetConfirmation() {
        this._showConfirmReset = false;
        this._confirmResetChild = null;
    }

    async _confirmReset() {
        if (!this._confirmResetChild) return;

        const childName = this._confirmResetChild.state.attributes.child;
        try {
            await this._hass.callService("morning_routine", "reset_routine", {
                child: childName,
            });
            this._closeResetConfirmation();
        } catch (err) {
            console.error("Erro ao reiniciar:", err);
            alert("Falha ao reiniciar. Por favor tente novamente.");
        }
    }

    _getFilename(path) {
        if (!path) return "";
        return path.split("/").pop();
    }

    _showRewardModal(child) {
        this._rewardChild = child;
        // Pick a random quote
        this._currentRewardQuote = this._rewardQuotes[Math.floor(Math.random() * this._rewardQuotes.length)];
        this._showReward = true;
    }

    _closeRewardModal() {
        this._showReward = false;
        this._rewardChild = null;
        this._currentRewardQuote = null;
    }

    _showPhotoModal(child) {
        this._photoChild = child;
        this._showPhoto = true;
    }

    _closePhotoModal() {
        this._showPhoto = false;
        this._photoChild = null;
    }

    _renderPhotoModal() {
        if (!this._showPhoto || !this._photoChild) return html``;

        const hasContent = this._photoChild.photo_path;

        return html`
            <div class="modal-overlay" @click=${this._closePhotoModal}>
                <div class="photo-modal" @click=${(e) => e.stopPropagation()}>
                    <div class="photo-modal-header">
                        <h2>📸 Foto - ${this._photoChild.name}</h2>
                        <mwc-icon-button @click=${this._closePhotoModal}>
                            <ha-icon icon="mdi:close"></ha-icon>
                        </mwc-icon-button>
                    </div>
                    <div class="photo-modal-content">
                        ${hasContent ? html`
                            <img src="/local/morning_routine_photos/${this._getFilename(this._photoChild.photo_path)}"
                                 alt="Foto de ${this._photoChild.name}" />
                        ` : ''}
                    </div>
                    <div class="photo-modal-actions">
                        <mwc-button
                            raised
                            class="retake-button"
                            @click=${this._retakeMedia}>
                            <ha-icon icon="mdi:camera" slot="icon"></ha-icon>
                            Tirar Outra Foto
                        </mwc-button>
                    </div>
                </div>
            </div>
        `;
    }

    _retakeMedia() {
        // Close preview modal
        this._showPhoto = false;

        // Open camera modal
        this._showCamera = true;
        this.updateComplete.then(async () => {
            await this._loadCameras();
            this._startCamera();
        });
    }

    _renderRewardModal() {
        if (!this._showReward || !this._rewardChild) return html``;

        const hasVideo = this._rewardChild.reward_video_id;
        const hasAIImage = this._rewardChild.reward_image;

        return html`
            <div class="modal-overlay" @click=${this._closeRewardModal}>
                <div class="reward-modal" @click=${(e) => e.stopPropagation()}>
                    <div class="reward-modal-header">
                        <h2>🎉 Recompensa do ${this._rewardChild.name}! 🎉</h2>
                        <mwc-icon-button @click=${this._closeRewardModal}>
                            <ha-icon icon="mdi:close"></ha-icon>
                        </mwc-icon-button>
                    </div>
                    <div class="reward-modal-content">
                        ${hasVideo ? html`
                            <div class="video-reward-container">
                                <iframe
                                    src="https://www.youtube.com/embed/${this._rewardChild.reward_video_id}?autoplay=1"
                                    frameborder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowfullscreen
                                ></iframe>
                            </div>
                        ` : hasAIImage ? html`
                            <img src="/local/morning_routine_photos/${this._getFilename(this._rewardChild.reward_image)}"
                                 alt="Imagem de Recompensa" />
                        ` : html`
                            <div class="reward-quote-container">
                                <ha-icon icon="mdi:trophy-award" class="reward-trophy"></ha-icon>
                                <p class="reward-quote">${this._currentRewardQuote}</p>
                            </div>
                        `}
                        <p class="reward-message">
                            Completaste a rotina matinal! Parabéns! 🎊
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    _renderConfirmResetModal() {
        if (!this._showConfirmReset || !this._confirmResetChild) return html``;

        return html`
            <div class="modal-overlay" @click=${this._closeResetConfirmation}>
                <div class="confirm-modal" @click=${(e) => e.stopPropagation()}>
                    <div class="confirm-modal-header">
                        <h2>⚠️ Confirmar Reinicialização</h2>
                    </div>
                    <div class="confirm-modal-content">
                        <p>Tens a certeza que queres reiniciar o dia do <strong>${this._confirmResetChild.name}</strong>?</p>
                        <p class="confirm-warning">Todas as atividades concluídas serão marcadas como pendentes.</p>
                    </div>
                    <div class="confirm-modal-actions">
                        <mwc-button
                            raised
                            class="confirm-button"
                            @click=${this._confirmReset}>
                            <ha-icon icon="mdi:check" slot="icon"></ha-icon>
                            Sim, Reiniciar
                        </mwc-button>
                        <mwc-button
                            class="cancel-button"
                            @click=${this._closeResetConfirmation}>
                            <ha-icon icon="mdi:close" slot="icon"></ha-icon>
                            Cancelar
                        </mwc-button>
                    </div>
                </div>
            </div>
        `;
    }

    static styles = css`
        :host {
            --mdc-theme-primary: var(--primary-text-color);
        }

        .card-content {
            padding: 16px;
        }

        .global-timer {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 16px;
            border-radius: 12px;
            margin-bottom: 16px;
            color: white;
            font-size: 24px;
            font-weight: bold;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .global-timer ha-icon {
            width: 32px;
            height: 32px;
        }

        .global-timer-text {
            font-family: monospace;
        }

        .children-container {
            display: grid;
            gap: 16px;
        }

        .children-container.horizontal {
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        }

        .children-container.vertical {
            grid-template-columns: 1fr;
        }

        .child-section {
            border: 2px solid var(--child-color, #4CAF50);
            border-radius: 12px;
            padding: 16px;
            background: var(--card-background-color);
        }

        .child-section.error {
            border-color: #f44336;
            color: #f44336;
            text-align: center;
        }

        .child-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }

        .child-header h2 {
            margin: 0;
            font-size: 24px;
            color: var(--child-color);
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .reset-button {
            --mdc-icon-button-size: 48px;
            --mdc-icon-size: 24px;
            border: 2px solid #F44336 !important;
            border-radius: 50% !important;
            background: rgba(244, 67, 54, 0.05) !important;
            transition: all 0.3s ease;
        }

        .reset-button:hover {
            background: rgba(244, 67, 54, 0.15) !important;
            transform: scale(1.05);
        }

        .reset-button ha-icon {
            color: #F44336;
        }

        .progress-container {
            position: relative;
            width: 60px;
            height: 60px;
        }

        .progress-ring {
            transform: rotate(-90deg);
        }

        .progress-ring-circle {
            transition: stroke-dashoffset 0.5s ease;
        }

        .progress-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-weight: bold;
            font-size: 14px;
        }

        .activities-grid {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 8px;
            width: 100%;
        }

        .activities-grid.compact {
            gap: 6px;
        }

        /* Responsive layout for mobile */
        @media (max-width: 768px) {
            .activities-grid {
                gap: 6px;
            }

            .activity-item {
                flex: 1 1 calc(50% - 6px);
                min-width: calc(50% - 6px);
                max-width: calc(50% - 6px);
            }
        }

        @media (max-width: 480px) {
            .activities-grid {
                gap: 4px;
            }

            .activity-item {
                flex: 1 1 calc(50% - 4px);
                min-width: calc(50% - 4px);
                max-width: calc(50% - 4px);
                height: 160px;
            }

            .activity-icon {
                font-size: 42px;
                margin-bottom: 4px;
                --mdc-icon-size: 42px;
            }

            .activity-icon ha-icon {
                width: 42px;
                height: 42px;
            }

            .activity-item.has-media .activity-icon {
                font-size: 34px;
                --mdc-icon-size: 34px;
            }

            .activity-item.has-media .activity-icon ha-icon {
                width: 34px;
                height: 34px;
            }

            .activity-name {
                font-size: 12px;
            }

            .activity-item.has-media .activity-name {
                font-size: 11px;
            }
        }

        .activity-item {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding: 12px 8px;
            border-radius: 12px;
            background: var(--card-background-color);
            border: 3px solid #e0e0e0;
            cursor: pointer;
            transition: all 0.3s ease;
            height: 180px;
            flex: 1;
            min-width: 0;
        }

        .activity-item:hover:not(.completed) {
            transform: scale(1.05);
            border-color: var(--child-color);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .activity-item.pending {
            background: linear-gradient(135deg, #FFCDD2 0%, #EF9A9A 100%);
            border-color: #F44336;
        }

        .activity-item.completed {
            background: #c8e6c9;
            border-color: #4CAF50;
            cursor: default;
        }

        .activity-icon {
            font-size: 56px;
            margin-bottom: 8px;
            color: var(--primary-text-color);
            --mdc-icon-size: 56px;
        }

        .activity-icon ha-icon {
            width: 56px;
            height: 56px;
        }

        .activity-item.has-media .activity-icon {
            font-size: 44px;
            margin-bottom: 6px;
            --mdc-icon-size: 44px;
        }

        .activity-item.has-media .activity-icon ha-icon {
            width: 44px;
            height: 44px;
        }

        .activity-item.completed .activity-icon {
            color: #2e7d32;
        }

        .activity-name {
            font-size: 14px;
            font-weight: 600;
            text-align: center;
            line-height: 1.2;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
            margin-bottom: 6px;
        }

        .activity-item.has-media .activity-name {
            font-size: 12px;
            margin-bottom: 4px;
        }

        .check-mark {
            position: absolute;
            top: 8px;
            right: 8px;
            color: #2e7d32;
        }

        .check-mark ha-icon {
            width: 32px;
            height: 32px;
        }

        /* Media Preview in Activity Tiles */
        .activity-media-preview {
            margin-top: auto;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .activity-media-preview img {
            width: 80px;
            height: 50px;
            object-fit: cover;
            border-radius: 6px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            cursor: pointer;
            transition: transform 0.2s;
        }

        .activity-media-preview img:hover {
            transform: scale(1.05);
        }

        .activity-media-preview.audio {
            padding: 0;
        }

        .audio-play-button {
            width: 80px;
            height: 50px;
            border-radius: 6px;
            background: #4CAF50;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .audio-play-button:hover {
            background: #45a049;
            transform: scale(1.05);
        }

        .audio-play-button:active {
            transform: scale(0.95);
        }

        .audio-play-button ha-icon {
            width: 28px;
            height: 28px;
        }

        .button-container {
            margin-top: 16px;
            padding: 20px;
            text-align: center;
            background: linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 193, 7, 0.1) 100%);
            border: 2px solid #FFB74D;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(255, 152, 0, 0.2);
            display: flex;
            flex-direction: column;
            gap: 8px;
            animation: slideIn 0.5s ease-out;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .button-container mwc-button {
            width: 100%;
            --mdc-shape-small: 4px;
            --mdc-button-horizontal-padding: 16px;
        }

        .button-container mwc-button ha-icon {
            --mdc-icon-size: 24px;
            width: 24px;
            height: 24px;
            margin-right: 8px;
        }

        .reward-button {
            --mdc-theme-primary: #FF9800;
            --mdc-theme-on-primary: white;
            animation: pulse 2s infinite;
            border: 3px solid #FFB74D !important;
            box-shadow: 0 4px 12px rgba(255, 152, 0, 0.4) !important;
            font-weight: bold !important;
        }

        .reward-button:hover {
            box-shadow: 0 6px 16px rgba(255, 152, 0, 0.6) !important;
        }

        .audio-button {
            --mdc-theme-primary: #4CAF50;
            --mdc-theme-on-primary: white;
        }

        .audio-player-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 12px;
            background: var(--card-background-color);
            border: 2px solid #4CAF50;
            border-radius: 8px;
            margin-bottom: 8px;
        }

        .audio-player-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            color: #4CAF50;
        }

        .audio-player-label ha-icon {
            --mdc-icon-size: 20px;
        }

        .audio-player-container audio {
            width: 100%;
            height: 40px;
            border-radius: 4px;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.02); }
        }

        .reward-preview {
            margin-top: 16px;
            text-align: center;
            cursor: pointer;
            padding: 12px;
            border-radius: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .reward-preview img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin-bottom: 8px;
        }

        .celebration {
            font-size: 18px;
            font-weight: bold;
            color: white;
            animation: bounce 1s infinite;
        }

        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }

        /* Modal Styles */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .camera-modal {
            background: var(--card-background-color);
            border-radius: 12px;
            max-width: 600px;
            width: 90%;
            max-height: 90vh;
            overflow: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .reward-modal {
            background: var(--card-background-color);
            border-radius: 12px;
            max-width: 900px;
            width: 90%;
            max-height: 90vh;
            overflow: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .camera-header, .reward-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            border-bottom: 1px solid var(--divider-color);
        }

        .camera-header h2, .reward-modal-header h2 {
            margin: 0;
        }

        .camera-container {
            padding: 16px;
            position: relative;
            cursor: pointer;
        }

        .camera-container:hover {
            opacity: 0.95;
        }

        #camera-preview {
            width: 100%;
            border-radius: 8px;
        }

        .camera-selector {
            padding: 16px;
            border-bottom: 1px solid var(--divider-color);
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .camera-selector label {
            font-weight: 600;
        }

        .camera-selector select {
            flex: 1;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid var(--divider-color);
            background: var(--card-background-color);
            color: var(--primary-text-color);
            font-size: 14px;
        }

        .countdown-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 8px;
        }

        .countdown-number {
            font-size: 120px;
            font-weight: bold;
            color: white;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
            animation: countdown-pulse 1s ease-out;
        }

        @keyframes countdown-pulse {
            0% { transform: scale(0.5); opacity: 0; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }

        .audio-recorder-container {
            padding: 32px;
            text-align: center;
        }

        .recording-indicator {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 120px;
            height: 120px;
            margin: 0 auto 24px;
            border-radius: 50%;
            background: #f5f5f5;
            border: 4px solid #e0e0e0;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .recording-indicator:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .recording-indicator:active {
            transform: scale(0.95);
        }

        .recording-indicator ha-icon {
            width: 60px;
            height: 60px;
            color: #757575;
        }

        .recording-indicator.recording {
            background: #ff5252;
            border-color: #ff1744;
            animation: pulse-record 1.5s infinite;
        }

        .recording-indicator.recording ha-icon {
            color: white;
        }

        @keyframes pulse-record {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }

        .recording-time {
            color: white;
            font-weight: bold;
            font-size: 16px;
            margin-top: 8px;
        }

        .audio-hint {
            font-size: 16px;
            color: var(--secondary-text-color);
            margin: 0;
        }

        .camera-controls {
            display: flex;
            justify-content: center;
            gap: 12px;
            padding: 16px;
            border-top: 1px solid var(--divider-color);
        }

        .camera-controls mwc-button {
            --mdc-shape-small: 4px;
            --mdc-button-horizontal-padding: 24px;
            min-width: 100px;
        }

        .camera-controls mwc-button ha-icon {
            --mdc-icon-size: 24px;
            width: 24px;
            height: 24px;
            margin-right: 8px;
        }

        .capture-button {
            --mdc-theme-primary: #2196F3;
            --mdc-theme-on-primary: white;
        }

        .record-button {
            --mdc-theme-primary: #F44336;
            --mdc-theme-on-primary: white;
        }

        .cancel-button {
            --mdc-theme-primary: var(--secondary-text-color);
        }

        .reward-modal-content {
            padding: 16px;
            text-align: center;
        }

        .reward-modal-content img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin-bottom: 16px;
        }

        .video-reward-container {
            width: 100%;
            height: 500px;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 16px;
            background: #000;
        }

        .video-reward-container iframe {
            width: 100%;
            height: 100%;
            border: none;
        }

        .reward-quote-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px;
            background: linear-gradient(135deg, #FFD54F 0%, #FF9800 50%, #F57C00 100%);
            border-radius: 12px;
            margin-bottom: 16px;
            min-height: 250px;
        }

        .reward-trophy {
            font-size: 80px;
            color: #FFF;
            margin-bottom: 24px;
            animation: bounce 1s infinite;
        }

        .reward-quote {
            font-size: 24px;
            font-weight: bold;
            color: #FFF;
            text-align: center;
            margin: 0;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
            line-height: 1.4;
        }

        .reward-message {
            font-size: 18px;
            font-weight: bold;
            color: var(--primary-text-color);
            margin: 0;
            text-align: center;
        }

        /* Photo Thumbnail */
        .photo-thumbnail {
            position: relative;
            width: 120px;
            height: 120px;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            transition: transform 0.2s, box-shadow 0.2s;
            margin-bottom: 12px;
        }

        .photo-thumbnail:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .photo-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .photo-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .photo-thumbnail:hover .photo-overlay {
            opacity: 1;
        }

        .photo-overlay ha-icon {
            color: white;
            --mdc-icon-size: 40px;
        }

        /* Photo Modal */
        .photo-modal {
            background: var(--card-background-color);
            border-radius: 8px;
            max-width: 90vw;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }


        .photo-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            border-bottom: 1px solid var(--divider-color);
        }

        .photo-modal-header h2 {
            margin: 0;
            font-size: 20px;
        }

        .photo-modal-content {
            padding: 16px;
            overflow: auto;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .photo-modal-content img {
            max-width: 100%;
            max-height: 70vh;
            border-radius: 8px;
        }

        .photo-modal-actions {
            display: flex;
            justify-content: center;
            gap: 12px;
            padding: 16px;
            border-top: 1px solid var(--divider-color);
        }

        .retake-button {
            --mdc-theme-primary: #FF9800;
            --mdc-theme-on-primary: white;
        }

        /* Confirm Reset Modal */
        .confirm-modal {
            background: var(--card-background-color);
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .confirm-modal-header {
            padding: 16px;
            border-bottom: 1px solid var(--divider-color);
        }

        .confirm-modal-header h2 {
            margin: 0;
            font-size: 20px;
            color: #F44336;
        }

        .confirm-modal-content {
            padding: 24px;
        }

        .confirm-modal-content p {
            margin: 0 0 12px 0;
            font-size: 16px;
        }

        .confirm-warning {
            color: #F44336;
            font-weight: 600;
        }

        .confirm-modal-actions {
            display: flex;
            justify-content: center;
            gap: 12px;
            padding: 16px;
            border-top: 1px solid var(--divider-color);
        }

        .confirm-button {
            --mdc-theme-primary: #F44336;
            --mdc-theme-on-primary: white;
        }
    `;

    static getConfigElement() {
        return document.createElement("morning-routine-card-editor");
    }

    static getStubConfig() {
        return {
            children: [
                {
                    entity: "sensor.duarte_morning_status",
                    name: "Duarte",
                    color: "#4CAF50"
                },
                {
                    entity: "sensor.leonor_morning_status",
                    name: "Leonor",
                    color: "#2196F3"
                }
            ],
            layout: "horizontal",
            show_progress: true,
            compact: false
        };
    }
}

customElements.define("morning-routine-card", MorningRoutineCard);

// Register card
window.customCards = window.customCards || [];
window.customCards.push({
    type: "morning-routine-card",
    name: "Morning Routine Card",
    description: "A gamified morning routine tracker for children",
    preview: true,
});

console.info(
    `%c MORNING-ROUTINE-CARD %c 2.6.4 - Enhanced reset button and reward area styling `,
    "color: white; font-weight: bold; background: #4CAF50",
    "color: white; font-weight: bold; background: #2196F3"
);
