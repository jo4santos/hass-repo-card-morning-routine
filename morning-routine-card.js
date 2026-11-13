import { LitElement, html, css } from "https://cdn.jsdelivr.net/gh/lit/dist@2/all/lit-all.min.js";

// Morning Routine Card v2.11.0 - Reward image generated from the photo, "medalha do dia" fallback and streak
// (needs the Morning Routine integration v2.13.0+ for the new reward type and the streak; older versions keep working)

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
        _rewardZoom: { type: Boolean, state: true },
        _rewardImageFailedUrl: { type: String, state: true },
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
        _showHistory: { type: Boolean, state: true },
        _historyChild: { type: Object, state: true },
        _historyData: { type: Array, state: true },
        _historyIndex: { type: Number, state: true },
        _transcriptions: { type: Object, state: true },
        _maxTemperature: { type: Number, state: true },
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
        this._rewardZoom = false;
        this._rewardImageFailedUrl = null;
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
        this._showHistory = false;
        this._historyChild = null;
        this._historyData = [];
        this._historyIndex = 0;
        this._transcriptions = {};  // Store transcriptions by date
        this._maxTemperature = null;
        this._lastWeatherFetchTime = null;

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

    updated(changedProperties) {
        super.updated?.(changedProperties);
        const modalFlags = ['_showCamera', '_showAudioRecorder', '_showPhoto', '_showReward', '_showConfirmReset', '_showHistory'];
        if (!modalFlags.some(f => changedProperties.has(f))) return;
        const isModalOpen = modalFlags.some(f => this[f]);
        const dialog = this.shadowRoot?.getElementById('mr-dialog');
        if (!dialog) return;
        if (isModalOpen && !dialog.open) dialog.showModal();
        else if (!isModalOpen && dialog.open) dialog.close();
    }

    _closeCurrentModal() {
        if (this._showCamera) this._closeCamera();
        else if (this._showAudioRecorder) this._closeAudioRecorder();
        else if (this._showPhoto) this._closePhotoModal();
        else if (this._showReward) this._closeRewardModal();
        else if (this._showConfirmReset) this._closeResetConfirmation();
        else if (this._showHistory) this._closeHistoryModal();
    }

    _handleDialogBackdropClick(e) {
        if (e.target === e.currentTarget) this._closeCurrentModal();
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
        if (totalSeconds > 1800) return '#a6da95'; // Green
        if (totalSeconds > 900) return '#eed49f'; // Yellow
        return '#ed8796'; // Red
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

        // Fetch daily forecast max temperature if weather entity is configured (refresh every 30min)
        if (this._config?.weather_entity) {
            const weatherEntity = this._config.weather_entity;
            const weatherState = hass.states[weatherEntity];
            const now = Date.now();
            const shouldFetch = weatherState && (
                !this._lastWeatherFetchTime ||
                now - this._lastWeatherFetchTime > 30 * 60 * 1000
            );
            if (shouldFetch) {
                this._lastWeatherFetchTime = now;
                this._fetchMaxTemperature(weatherEntity);
            }
        }

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
                // Integration v2.13.0+ (undefined with older versions: the card then behaves as before)
                reward_type: entity.attributes.reward_type,
                reward_image_status: entity.attributes.reward_image_status,
                daily_phrase: entity.attributes.daily_phrase,
                streak: entity.attributes.streak,
                best_streak: entity.attributes.best_streak,
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
            <dialog id="mr-dialog" @click=${this._handleDialogBackdropClick}>
                ${this._renderCameraModal()}
                ${this._renderAudioRecorderModal()}
                ${this._renderPhotoModal()}
                ${this._renderRewardModal()}
                ${this._renderConfirmResetModal()}
                ${this._renderHistoryModal()}
            </dialog>
        `;
    }

    _renderTimer() {
        const timeData = this._getTimeUntilSchool();
        const timerColor = this._getTimerColor(timeData.total);

        return html`
            <div class="timer-section">
                <div class="timer-weather-row">
                    <div class="global-timer" style="background-color: ${timerColor}">
                        ${timeData.total > 0 ? html`
                            <ha-icon icon="mdi:clock-outline"></ha-icon>
                            <span class="global-timer-text">Tempo até à escola: ${timeData.minutes}:${timeData.seconds.toString().padStart(2, '0')}</span>
                        ` : html`
                            <ha-icon icon="mdi:school"></ha-icon>
                            <span class="global-timer-text">Hora da escola!</span>
                        `}
                    </div>
                    ${this._renderWeather()}
                </div>
                <div class="announcement-buttons">
                    <button class="announcement-button" @click=${this._announceTimeRemaining} title="Anunciar tempo restante">
                        <ha-icon icon="mdi:clock-alert"></ha-icon>
                        <span>Tempo</span>
                    </button>
                    <button class="announcement-button" @click=${this._announceTimeWithWeather} title="Anunciar tempo + meteorologia">
                        <ha-icon icon="mdi:weather-partly-cloudy"></ha-icon>
                        <span>Tempo + Meteo</span>
                    </button>
                    <button class="announcement-button" @click=${this._announceTimeWithActivities} title="Anunciar tempo + meteorologia + atividades">
                        <ha-icon icon="mdi:calendar-star"></ha-icon>
                        <span>Completo</span>
                    </button>
                </div>
            </div>
        `;
    }

    async _fetchMaxTemperature(weatherEntity) {
        for (const forecastType of ['daily', 'hourly']) {
            try {
                const response = await this._hass.callWS({
                    type: 'call_service',
                    domain: 'weather',
                    service: 'get_forecasts',
                    service_data: { entity_id: weatherEntity, type: forecastType },
                    return_response: true,
                });
                const forecastList = response?.response?.[weatherEntity]?.forecast || [];
                if (forecastList.length > 0) {
                    const maxTemp = forecastList[0].temperature;
                    if (maxTemp != null) {
                        this._maxTemperature = maxTemp;
                        this.requestUpdate();
                        return;
                    }
                }
            } catch (e) {
                // Try next forecast type
            }
        }
    }

    _renderWeather() {
        if (!this._hass || !this._config.weather_entity) {
            return '';
        }

        const weatherEntity = this._hass.states[this._config.weather_entity];
        if (!weatherEntity) {
            return '';
        }

        const currentTemperature = weatherEntity.attributes.temperature;
        const temperature = this._maxTemperature ?? currentTemperature;
        const condition = weatherEntity.state;

        // Get temperature description for Esmoriz, Portugal climate
        const getTempDescription = (temp) => {
            if (temp < 10) return 'está frio';
            if (temp < 15) return 'está fresco';
            if (temp < 20) return 'está ameno';
            if (temp < 25) return 'está agradável';
            return 'está quente';
        };

        // Get weather icon based on condition
        const getWeatherIcon = (condition) => {
            const icons = {
                'clear-night': 'mdi:weather-night',
                'cloudy': 'mdi:weather-cloudy',
                'fog': 'mdi:weather-fog',
                'hail': 'mdi:weather-hail',
                'lightning': 'mdi:weather-lightning',
                'lightning-rainy': 'mdi:weather-lightning-rainy',
                'partlycloudy': 'mdi:weather-partly-cloudy',
                'pouring': 'mdi:weather-pouring',
                'rainy': 'mdi:weather-rainy',
                'snowy': 'mdi:weather-snowy',
                'snowy-rainy': 'mdi:weather-snowy-rainy',
                'sunny': 'mdi:weather-sunny',
                'windy': 'mdi:weather-windy',
                'windy-variant': 'mdi:weather-windy-variant',
            };
            return icons[condition] || 'mdi:weather-cloudy';
        };


        const tempDescription = getTempDescription(temperature);
        const weatherIcon = getWeatherIcon(condition);

        // Translate condition
        const conditionTranslations = {
            'clear-night': 'céu limpo',
            'cloudy': 'nublado',
            'fog': 'nevoeiro',
            'hail': 'granizo',
            'lightning': 'trovoada',
            'lightning-rainy': 'trovoada com chuva',
            'partlycloudy': 'parcialmente nublado',
            'pouring': 'chuva forte',
            'rainy': 'chuvoso',
            'snowy': 'neve',
            'snowy-rainy': 'chuva com neve',
            'sunny': 'sol',
            'windy': 'ventoso',
            'windy-variant': 'ventoso',
            'exceptional': 'excecional',
        };
        const conditionText = conditionTranslations[condition] || condition;

        return html`
            <div class="weather-section">
                <ha-icon icon="${weatherIcon}"></ha-icon>
                <div class="weather-text">
                    <div class="weather-temp">${this._maxTemperature != null ? `máx. ${temperature}°C` : `${temperature}°C`} · ${conditionText}</div>
                    <div class="weather-description">${tempDescription}</div>
                </div>
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
        let sectionStyle = `--child-color: ${child.color || '#8aadf4'};`;

        return html`
            <div class="child-section" style="${sectionStyle}">
                ${this._config.show_progress ? this._renderHeader(child) : ''}

                <div class="activities-grid ${this._config.compact ? 'compact' : ''}">
                    ${child.activities.map(activity => this._renderActivity(child, activity))}
                </div>

                ${allComplete ? html`
                    <div class="button-container">
                        <button class="reward-button" @click=${() => this._showRewardModal(child)}>
                            <ha-icon icon="mdi:trophy"></ha-icon>
                            <span>Ver Recompensa</span>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    _renderHeader(child) {
        return html`
            <div class="child-header">
                <div class="header-left">
                    <h2>${child.name}</h2>
                    <mwc-icon-button
                        class="history-button"
                        @click=${() => this._showHistoryModal(child)}>
                        <ha-icon icon="mdi:history"></ha-icon>
                    </mwc-icon-button>
                    ${this._renderStreakChip(child)}
                </div>
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
                                stroke="var(--card-background-color, #e0e0e0)"
                                stroke-width="4"
                                fill="transparent"
                                r="26"
                                cx="30"
                                cy="30"
                            ></circle>
                            <circle
                                class="progress-ring-circle"
                                stroke="${child.color || '#8aadf4'}"
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

    _getStreak(child) {
        const streak = Number(child?.streak);
        return Number.isFinite(streak) && streak > 0 ? Math.floor(streak) : 0;
    }

    _getBestStreak(child) {
        const best = Number(child?.best_streak);
        return Math.max(Number.isFinite(best) && best > 0 ? Math.floor(best) : 0, this._getStreak(child));
    }

    _formatStreak(days) {
        return days === 1 ? '1 dia seguido' : `${days} dias seguidos`;
    }

    _renderStreakChip(child) {
        // Discreet: only from the second consecutive day on
        const streak = this._getStreak(child);
        if (streak < 2) return '';
        const label = `${this._formatStreak(streak)} com a rotina completa`;
        return html`
            <span class="streak-chip" title="${label}" aria-label="${label}" role="img">
                <ha-icon icon="mdi:fire"></ha-icon>
                <span>${streak}</span>
            </span>
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
                            src="/local/morning_routine_photos/${this._getFilename(child.audio_recording)}?v=${this._getFilename(child.audio_recording)}"
                            @play=${() => this._onAudioPlay(child.state.attributes.child)}
                            @pause=${() => this._onAudioPause(child.state.attributes.child)}
                            @ended=${() => this._onAudioPause(child.state.attributes.child)}>
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
            <div class="camera-modal">
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

            // console.log("[Camera] Starting camera with deviceId:", this._selectedCameraId);

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

            // console.log("[Camera] Requesting with constraints:", constraints);

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            // console.log("[Camera] Stream obtained:", stream.getVideoTracks());

            if (video) {
                video.srcObject = stream;

                // Wait for video to be ready (important for Android)
                await new Promise((resolve) => {
                    video.onloadedmetadata = () => {
                        // console.log("[Camera] Video ready:", video.videoWidth, "x", video.videoHeight);
                        video.play().then(() => {
                            // console.log("[Camera] Video playing");
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
            <div class="camera-modal">
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
            console.log(`📸 Saving photo for ${this._currentChild}, activity: ${this._currentActivity}`);
            await this._hass.callService("morning_routine", "save_photo", {
                child: this._currentChild,
                photo_data: photoData,
            });
            console.log(`✅ Photo saved successfully for ${this._currentChild}`);

            // Note: Activity completion is now handled automatically by the integration
            // But we still call it here for redundancy/backwards compatibility
            console.log(`✓ Completing activity ${this._currentActivity} for ${this._currentChild}`);
            await this._completeActivity(this._currentChild, this._currentActivity);
            console.log(`✅ Activity ${this._currentActivity} completed for ${this._currentChild}`);
        } catch (err) {
            console.error("Erro ao guardar foto:", err);
            alert("Falha ao guardar foto. Por favor tenta novamente.");
        }
    }

    async _completeActivity(child, activity, completed = true) {
        try {
            console.log(`🔄 Calling complete_activity service: child=${child}, activity=${activity}, completed=${completed}`);
            await this._hass.callService("morning_routine", "complete_activity", {
                child: child,
                activity: activity,
                completed: completed,
            });
            console.log(`✅ complete_activity service call successful for ${child}/${activity}`);
        } catch (err) {
            console.error(`❌ Error calling complete_activity for ${child}/${activity}:`, err);
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
        this._rewardZoom = false;
        this._rewardImageFailedUrl = null;
        this._showReward = true;
    }

    _closeRewardModal() {
        this._showReward = false;
        this._rewardChild = null;
        this._currentRewardQuote = null;
        this._rewardZoom = false;
        this._rewardImageFailedUrl = null;
    }

    _toggleRewardZoom(e) {
        e?.stopPropagation?.();
        this._rewardZoom = !this._rewardZoom;
    }

    _onRewardImageError(url) {
        // The file is gone or cannot be loaded: fall back to the "medalha do dia"
        this._rewardImageFailedUrl = url;
        this._rewardZoom = false;
    }

    _getLiveChild(child) {
        // The modal keeps the child it was opened for; always render its latest state,
        // so the reward updates by itself when the sensor changes (generating -> ready)
        if (!child) return null;
        return this._children.find(c => c.entity === child.entity && !c.error) || child;
    }

    _getRewardImageUrl(child) {
        const image = child?.reward_image;
        if (!image || typeof image !== 'string') return null;
        // v2.13.0+ gives a ready /local URL (with a cache-busting query); older values are file paths
        if (image.startsWith('/local/morning_routine_photos/')) return image;
        return `/local/morning_routine_photos/${this._getFilename(image)}`;
    }

    _getRewardView(child) {
        // Which reward to show. Only the reward type "image generated from the photo"
        // (integration v2.13.0+) uses the new views; everything else is unchanged.
        if (child?.reward_type !== 'ai_image_from_photo') return 'legacy';
        const url = this._getRewardImageUrl(child);
        if (child.reward_image_status === 'ready' && url && url !== this._rewardImageFailedUrl) return 'image';
        if (child.reward_image_status === 'generating') return 'waiting';
        return 'medal';  // failed, no photo, no image, or image file missing
    }

    _getTodayLabel() {
        try {
            return new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
        } catch (e) {
            return '';
        }
    }

    _getChildArticle(childName) {
        // Return correct article based on child's gender
        const childConfig = {
            'Duarte': { article: 'O', gender: 'male' },
            'Leonor': { article: 'A', gender: 'female' }
        };
        const config = childConfig[childName] || { article: 'A', gender: 'female' };
        return config.article;
    }

    async _announceTimeRemaining() {
        try {
            await this._hass.callService('morning_routine', 'announce_time_remaining', {});
        } catch (error) {
            console.error('Failed to announce time remaining:', error);
        }
    }

    async _announceTimeWithWeather() {
        try {
            await this._hass.callService('morning_routine', 'announce_time_with_weather', {});
        } catch (error) {
            console.error('Failed to announce time with weather:', error);
        }
    }

    async _announceTimeWithActivities() {
        try {
            await this._hass.callService('morning_routine', 'announce_time_with_activities', {});
        } catch (error) {
            console.error('Failed to announce time with activities:', error);
        }
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
            <div class="photo-modal">
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

        const child = this._getLiveChild(this._rewardChild);
        const view = this._getRewardView(child);
        if (view !== 'legacy') return this._renderPhotoRewardModal(child, view);

        const hasVideo = child.reward_video_id;
        const hasAIImage = child.reward_image;

        return html`
            <div class="reward-modal">
                <div class="reward-modal-header">
                        <h2>🎉 Recompensa d${this._getChildArticle(child.name).toLowerCase()} ${child.name}! 🎉</h2>
                        <mwc-icon-button @click=${this._closeRewardModal}>
                            <ha-icon icon="mdi:close"></ha-icon>
                        </mwc-icon-button>
                    </div>
                    <div class="reward-modal-content">
                        ${hasVideo ? html`
                            <div class="video-reward-container">
                                <iframe
                                    src="https://www.youtube.com/embed/${child.reward_video_id}?autoplay=1"
                                    frameborder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowfullscreen
                                ></iframe>
                            </div>
                        ` : hasAIImage ? html`
                            <img src="/local/morning_routine_photos/${this._getFilename(child.reward_image)}"
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
        `;
    }

    // Reward type "image generated from the photo": generated image, waiting state or "medalha do dia"
    _renderPhotoRewardModal(child, view) {
        const article = this._getChildArticle(child.name).toLowerCase();

        return html`
            <div class="reward-modal photo-reward" style="--child-color: ${child.color || '#8aadf4'};">
                <div class="reward-modal-header">
                    <h2>Recompensa d${article} ${child.name}</h2>
                    <mwc-icon-button @click=${this._closeRewardModal} aria-label="Fechar">
                        <ha-icon icon="mdi:close"></ha-icon>
                    </mwc-icon-button>
                </div>
                <div class="reward-modal-content photo-reward-content" aria-live="polite">
                    ${view === 'image' ? this._renderRewardImage(child)
                        : view === 'waiting' ? this._renderRewardWaiting(child)
                        : this._renderRewardMedal(child)}
                </div>
            </div>
            ${view === 'image' && this._rewardZoom ? this._renderRewardZoom(child) : ''}
        `;
    }

    _renderRewardImage(child) {
        const url = this._getRewardImageUrl(child);
        const article = this._getChildArticle(child.name).toLowerCase();
        const alt = `Imagem de recompensa d${article} ${child.name}, desenhada a partir da fotografia de hoje`;
        const streak = this._getStreak(child);

        return html`
            <button class="reward-image-button" @click=${this._toggleRewardZoom}
                    aria-label="Ver a imagem em ecrã inteiro">
                <img class="reward-image" src="${url}" alt="${alt}"
                     @error=${() => this._onRewardImageError(url)} />
                <span class="reward-image-zoom-hint" aria-hidden="true">
                    <ha-icon icon="mdi:fullscreen"></ha-icon>
                </span>
            </button>
            <div class="reward-caption">
                <span class="reward-caption-name">${child.name}</span>
                <span class="reward-caption-date">${this._getTodayLabel()}</span>
                ${streak > 0 ? html`
                    <span class="reward-caption-streak">
                        <ha-icon icon="mdi:fire"></ha-icon>
                        <span>${this._formatStreak(streak)}</span>
                    </span>
                ` : ''}
            </div>
        `;
    }

    _renderRewardZoom(child) {
        const url = this._getRewardImageUrl(child);
        return html`
            <div class="reward-zoom" role="button" tabindex="0" aria-label="Fechar o ecrã inteiro"
                 @click=${this._toggleRewardZoom}
                 @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') this._toggleRewardZoom(e); }}>
                <img src="${url}" alt="Imagem de recompensa de ${child.name} em ecrã inteiro" />
                <span class="reward-zoom-close" aria-hidden="true">
                    <ha-icon icon="mdi:close"></ha-icon>
                </span>
            </div>
        `;
    }

    _renderRewardWaiting(child) {
        return html`
            <div class="reward-waiting">
                <div class="reward-waiting-art" aria-hidden="true">
                    <span class="reward-waiting-ring"></span>
                    <ha-icon icon="mdi:palette"></ha-icon>
                </div>
                <p class="reward-waiting-title">A tua imagem está quase pronta…</p>
                <p class="reward-waiting-text">
                    Está a ser desenhada a partir da tua fotografia. Aparece aqui sozinha, não precisas de fazer nada.
                </p>
            </div>
        `;
    }

    _renderRewardMedal(child) {
        const streak = this._getStreak(child);
        const best = this._getBestStreak(child);
        const phrase = (child.daily_phrase || '').toString().trim();
        const isRecord = streak >= 2 && streak >= best;
        // Fixed pseudo-random confetti (no layout shift between renders)
        const confetti = [6, 14, 23, 31, 38, 47, 55, 62, 70, 78, 86, 94];

        return html`
            <div class="reward-medal-card">
                <div class="reward-confetti" aria-hidden="true">
                    ${confetti.map((left, i) => html`
                        <span class="confetti-piece c${i % 4}"
                              style="left: ${left}%; animation-delay: ${(i * 0.37) % 2.6}s; animation-duration: ${3.2 + (i % 5) * 0.45}s;"></span>
                    `)}
                </div>
                <p class="reward-medal-kicker">Medalha do dia</p>
                <div class="reward-medal" role="img"
                     aria-label="${streak > 0 ? `Medalha: ${this._formatStreak(streak)}` : 'Medalha de rotina completa'}">
                    <span class="reward-medal-ribbon left"></span>
                    <span class="reward-medal-ribbon right"></span>
                    <span class="reward-medal-disc">
                        ${streak > 0 ? html`
                            <span class="reward-medal-number">${streak}</span>
                        ` : html`
                            <ha-icon icon="mdi:trophy"></ha-icon>
                        `}
                    </span>
                </div>
                <p class="reward-medal-streak">
                    ${streak > 0 ? this._formatStreak(streak) : 'Rotina completa!'}
                </p>
                ${phrase ? html`
                    <p class="reward-medal-phrase">${phrase}</p>
                ` : html`
                    <p class="reward-medal-phrase">Completaste tudo, ${child.name}. Parabéns!</p>
                `}
                ${best > 0 ? html`
                    <p class="reward-medal-best">
                        <ha-icon icon="mdi:trophy-outline"></ha-icon>
                        <span>${isRecord ? `Novo recorde: ${this._formatStreak(best)}` : `Melhor série: ${this._formatStreak(best)}`}</span>
                    </p>
                ` : ''}
            </div>
        `;
    }

    _renderConfirmResetModal() {
        if (!this._showConfirmReset || !this._confirmResetChild) return html``;

        return html`
            <div class="confirm-modal">
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
        `;
    }

    async _showHistoryModal(child) {
        this._historyChild = child;
        this._historyIndex = 0;
        this._transcriptions = {};

        // Fetch history from integration
        try {
            const response = await this._hass.callWS({
                type: 'call_service',
                domain: 'morning_routine',
                service: 'get_history',
                service_data: { child: child.state.attributes.child },
                return_response: true
            });

            this._historyData = response.response.history || [];
            this._showHistory = true;
            this.requestUpdate();

            // Load transcription for first day
            await this.updateComplete;
            this._loadTranscriptionForCurrentDay();
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }

    _closeHistoryModal() {
        this._showHistory = false;
        this._historyChild = null;
        this._historyData = [];
        this._historyIndex = 0;
        this._transcriptions = {};
        this.requestUpdate();
    }

    _previousHistoryDay() {
        if (this._historyIndex < this._historyData.length - 1) {
            this._historyIndex++;
            this.requestUpdate();
            // Load transcription for new day
            this._loadTranscriptionForCurrentDay();
        }
    }

    _nextHistoryDay() {
        if (this._historyIndex > 0) {
            this._historyIndex--;
            this.requestUpdate();
            // Load transcription for new day
            this._loadTranscriptionForCurrentDay();
        }
    }

    _loadTranscriptionForCurrentDay() {
        const currentEntry = this._historyData[this._historyIndex];
        if (!currentEntry || !currentEntry.transcription) {
            return;
        }

        const dateKey = currentEntry.date;

        // Check if already loaded
        if (this._transcriptions[dateKey]) {
            return;
        }

        // Fetch transcription
        fetch(currentEntry.transcription)
            .then(response => {
                if (response.ok) {
                    return response.text();
                }
                throw new Error('Transcription not found');
            })
            .then(text => {
                this._transcriptions[dateKey] = text;
                this.requestUpdate();
            })
            .catch(() => {
                // Transcription not ready yet, mark as pending
                this._transcriptions[dateKey] = null;
            });
    }

    _formatHistoryDate(dateStr) {
        // Format YYYYMMDD to DD/MM/YYYY
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${day}/${month}/${year}`;
    }

    _renderHistoryModal() {
        if (!this._showHistory || !this._historyChild || this._historyData.length === 0) {
            return html``;
        }

        const currentEntry = this._historyData[this._historyIndex];
        const hasPhoto = currentEntry.photo;
        const hasAudio = currentEntry.audio;
        const dateKey = currentEntry.date;

        // Load transcription if not already loaded
        if (currentEntry.transcription && !(dateKey in this._transcriptions)) {
            this._loadTranscriptionForCurrentDay();
        }

        const transcriptionText = this._transcriptions[dateKey];

        return html`
            <div class="history-modal">
                <div class="history-modal-header">
                    <h2>📅 Histórico - ${this._historyChild.name}</h2>
                    <mwc-icon-button @click=${this._closeHistoryModal}>
                        <ha-icon icon="mdi:close"></ha-icon>
                    </mwc-icon-button>
                </div>
                <div class="history-content">
                    <div class="history-navigation">
                        <mwc-icon-button
                            ?disabled=${this._historyIndex >= this._historyData.length - 1}
                            @click=${this._previousHistoryDay}>
                            <ha-icon icon="mdi:chevron-left"></ha-icon>
                        </mwc-icon-button>
                        <span class="history-date">${this._formatHistoryDate(currentEntry.date)}</span>
                        <mwc-icon-button
                            ?disabled=${this._historyIndex <= 0}
                            @click=${this._nextHistoryDay}>
                            <ha-icon icon="mdi:chevron-right"></ha-icon>
                        </mwc-icon-button>
                    </div>
                    <div class="history-media" data-date="${dateKey}">
                        ${hasAudio ? html`
                            <div class="history-audio-container">
                                <h3>🎤 Áudio do Pequeno-Almoço</h3>
                                <audio controls autoplay preload="metadata" src="${currentEntry.audio}?date=${dateKey}">
                                    O teu navegador não suporta áudio.
                                </audio>
                                ${transcriptionText ? html`
                                    <div class="transcription-box">
                                        <h4>📝 Transcrição:</h4>
                                        <p>${transcriptionText}</p>
                                    </div>
                                ` : currentEntry.transcription ? html`
                                    <p class="transcription-loading">⏳ A carregar transcrição...</p>
                                ` : html`
                                    <p class="transcription-loading">⏳ A transcrever áudio...</p>
                                `}
                            </div>
                        ` : html`<p class="no-media">Sem áudio disponível</p>`}
                        ${hasPhoto ? html`
                            <div class="history-photo-container">
                                <h3>📸 Foto do Dia</h3>
                                <img src="${currentEntry.photo}" alt="Foto do ${this._formatHistoryDate(currentEntry.date)}" />
                            </div>
                        ` : html`<p class="no-media">Sem foto disponível</p>`}
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

        .timer-section {
            margin-bottom: 16px;
        }

        .timer-weather-row {
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
            align-items: stretch;
        }

        .global-timer {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 16px;
            border-radius: 12px;
            color: white;
            font-size: 24px;
            font-weight: bold;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            flex: 1;
            min-width: 0;
        }

        .global-timer ha-icon {
            width: 32px;
            height: 32px;
        }

        .global-timer-text {
            font-family: monospace;
        }

        .weather-section {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            flex-shrink: 0;
        }

        .weather-section ha-icon {
            width: 36px;
            height: 36px;
            flex-shrink: 0;
            filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
        }

        .weather-text {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
        }

        .weather-temp {
            font-size: 15px;
            font-weight: bold;
            line-height: 1.3;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .weather-description {
            font-size: 13px;
            font-weight: 600;
            opacity: 0.9;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .announcement-buttons {
            display: flex;
            gap: 8px;
            justify-content: center;
        }

        .announcement-button {
            flex: 1;
            padding: 10px 14px;
            background-color: var(--bubble-button-background-color, rgba(var(--rgb-primary-text-color, 0,0,0), 0.05));
            border: 1px solid var(--ha-card-border-color, var(--divider-color, rgba(128,128,128,0.2)));
            border-radius: var(--bubble-border-radius, 32px);
            color: var(--primary-text-color);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: filter 0.1s ease;
            position: relative;
            overflow: hidden;
            font-family: inherit;
        }

        .announcement-button::after {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background-color: rgb(184, 192, 224);
            opacity: 0;
            transition: opacity 0.15s ease;
            pointer-events: none;
        }

        .announcement-button:hover::after { opacity: 0.08; }
        .announcement-button:active { filter: brightness(0.9); }

        .announcement-button ha-icon {
            width: 20px;
            height: 20px;
            --mdc-icon-size: 20px;
            flex-shrink: 0;
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
            border: 1px solid var(--ha-card-border-color, var(--divider-color, rgba(128,128,128,0.2)));
            border-radius: var(--bubble-border-radius, 32px);
            padding: 16px;
            background: var(--bubble-main-background-color, var(--ha-card-background, var(--card-background-color, white)));
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

        .header-left {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .history-button {
            --mdc-icon-button-size: 40px;
            --mdc-icon-size: 20px;
            border: 2px solid var(--child-color) !important;
            border-radius: 50% !important;
            background: rgba(var(--child-color-rgb), 0.05) !important;
            transition: all 0.3s ease;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }

        .history-button:hover {
            background: rgba(var(--child-color-rgb), 0.15) !important;
            transform: scale(1.05);
        }

        .history-button ha-icon {
            color: var(--child-color);
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .reset-button {
            --mdc-icon-button-size: 48px;
            --mdc-icon-size: 24px;
            border: 2px solid #F44336 !important;
            border-radius: 50% !important;
            background: rgba(244, 67, 54, 0.05) !important;
            transition: all 0.3s ease;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }

        .reset-button:hover {
            background: rgba(244, 67, 54, 0.15) !important;
            transform: scale(1.05);
        }

        .reset-button ha-icon {
            color: #F44336;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
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

        .activity-item {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 12px 8px;
            border-radius: var(--bubble-border-radius, 32px);
            background-color: var(--bubble-button-background-color, rgba(var(--rgb-primary-text-color, 0,0,0), 0.05));
            border: 1px solid var(--ha-card-border-color, var(--divider-color, rgba(128,128,128,0.2)));
            color: var(--primary-text-color);
            cursor: pointer;
            transition: filter 0.1s ease;
            overflow: hidden;
            flex: 1;
            min-width: 80px;
            min-height: 140px;
        }

        .activity-item::after {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background-color: rgb(184, 192, 224);
            opacity: 0;
            transition: opacity 0.15s ease;
            pointer-events: none;
        }

        .activity-item:hover::after { opacity: 0.08; }
        .activity-item:active { filter: brightness(0.9); }

        .activity-item.pending { color: var(--error-color, #f44336); }
        .activity-item.completed { color: var(--success-color, #4caf50); cursor: default; }

        .activity-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            --mdc-icon-size: 40px;
            margin-bottom: 6px;
        }

        .activity-icon ha-icon {
            width: 40px;
            height: 40px;
        }

        .activity-name {
            font-size: 13px;
            font-weight: 600;
            text-align: center;
            line-height: 1.2;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
        }

        .check-mark {
            position: absolute;
            top: 6px;
            right: 6px;
        }

        .check-mark ha-icon {
            width: 20px;
            height: 20px;
            --mdc-icon-size: 20px;
        }

        /* Media Preview in Activity Tiles */
        .activity-media-preview {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 8px;
        }

        .activity-media-preview img {
            width: 52px;
            height: 46px;
            object-fit: cover;
            object-position: top;
            border-radius: 8px;
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
            width: 52px;
            height: 46px;
            border-radius: 8px;
            background: var(--success-color, #4caf50);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            transition: filter 0.2s;
        }

        .audio-play-button:hover { filter: brightness(1.1); }
        .audio-play-button:active { filter: brightness(0.9); }

        .audio-play-button ha-icon {
            width: 24px;
            height: 24px;
            --mdc-icon-size: 24px;
        }

        .button-container {
            margin-top: 16px;
            display: flex;
            justify-content: center;
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

        .reward-button {
            padding: 10px 20px;
            background-color: var(--bubble-button-background-color, rgba(var(--rgb-primary-text-color, 0,0,0), 0.05));
            border: 1px solid var(--ha-card-border-color, var(--divider-color, rgba(128,128,128,0.2)));
            border-radius: var(--bubble-border-radius, 32px);
            color: #FF9800;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            position: relative;
            overflow: hidden;
            transition: filter 0.1s ease;
            font-family: inherit;
        }

        .reward-button::after {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background-color: rgb(184, 192, 224);
            opacity: 0;
            transition: opacity 0.15s ease;
            pointer-events: none;
        }

        .reward-button:hover::after { opacity: 0.08; }
        .reward-button:active { filter: brightness(0.9); }

        .reward-button ha-icon {
            width: 24px;
            height: 24px;
            --mdc-icon-size: 24px;
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
        #mr-dialog {
            padding: 0;
            border: none;
            background: transparent;
            overflow: visible;
            max-width: none;
            max-height: none;
        }

        #mr-dialog::backdrop {
            background: rgba(0, 0, 0, 0.7);
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

        .camera-header mwc-icon-button,
        .reward-modal-header mwc-icon-button,
        .photo-modal-header mwc-icon-button {
            --mdc-icon-size: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .camera-header mwc-icon-button ha-icon,
        .reward-modal-header mwc-icon-button ha-icon,
        .photo-modal-header mwc-icon-button ha-icon {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
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
            --mdc-icon-size: 60px;
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

        /* History Modal */
        .history-modal {
            position: relative;
            background: var(--card-background-color);
            border-radius: 12px;
            width: 90%;
            max-width: 600px;
            max-height: 85vh;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
        }

        .history-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            border-bottom: 1px solid var(--divider-color);
            flex-shrink: 0;
        }

        .history-modal-header h2 {
            margin: 0;
            font-size: 20px;
        }

        .history-modal-header mwc-icon-button {
            --mdc-icon-size: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .history-modal-header mwc-icon-button ha-icon {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .history-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }

        .history-navigation {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 12px;
            background: var(--primary-background-color);
            border-radius: 8px;
        }

        .history-navigation mwc-icon-button {
            --mdc-icon-button-size: 48px;
            --mdc-icon-size: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .history-navigation mwc-icon-button ha-icon {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .history-navigation mwc-icon-button[disabled] {
            opacity: 0.3;
        }

        .history-date {
            font-size: 20px;
            font-weight: bold;
            color: var(--primary-text-color);
        }

        .history-media {
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .history-photo-container,
        .history-audio-container {
            background: var(--card-background-color);
            border-radius: 12px;
            padding: 16px;
            border: 2px solid var(--divider-color);
        }

        .history-photo-container h3,
        .history-audio-container h3 {
            margin: 0 0 12px 0;
            font-size: 16px;
            color: var(--primary-text-color);
        }

        .history-photo-container img {
            width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .history-audio-container audio {
            width: 100%;
        }

        .no-media {
            text-align: center;
            color: var(--secondary-text-color);
            font-style: italic;
            padding: 20px;
        }

        .transcription-box {
            margin-top: 16px;
            padding: 12px;
            background: var(--primary-background-color);
            border-radius: 8px;
            border-left: 4px solid var(--primary-color);
        }

        .transcription-box h4 {
            margin: 0 0 8px 0;
            font-size: 14px;
            color: var(--primary-text-color);
        }

        .transcription-box p {
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
            color: var(--primary-text-color);
            font-style: italic;
        }

        .transcription-loading {
            margin-top: 12px;
            text-align: center;
            color: var(--secondary-text-color);
            font-size: 13px;
            font-style: italic;
        }

        /* ------------------------------------------------------------------
           Unified style (v2.10.0): one sober palette, flat surfaces.
           green #a6da95 = done · yellow #eed49f = attention · red #ed8796 = late / destructive
           Everything else follows the active Home Assistant theme.
           ------------------------------------------------------------------ */
        .global-timer { box-shadow: none; border-radius: 12px; color: #181926; font-size: 24px; font-weight: 600; }
        .weather-section { background-color: var(--secondary-background-color); color: var(--primary-text-color); box-shadow: none; border-radius: 12px; }
        .weather-section ha-icon { filter: none; }
        .weather-temp, .weather-description { text-shadow: none; }
        .weather-description { font-weight: 500; opacity: 1; color: var(--secondary-text-color); }
        .announcement-button, .reward-button { border: 0; border-radius: 999px; background-color: var(--secondary-background-color); min-height: 44px; font-weight: 500; }
        .reward-button { color: #181926; background-color: #eed49f; font-weight: 600; }
        .child-section { border: 0; border-radius: 16px; background: var(--secondary-background-color); padding: 14px; }
        .child-section.error { border: 0; color: #ed8796; }
        .child-header h2 { font-size: 18px; font-weight: 600; color: var(--primary-text-color); }
        .history-button, .reset-button { border: 0 !important; background: var(--card-background-color) !important; }
        .history-button ha-icon { color: var(--secondary-text-color); }
        .reset-button ha-icon { color: #ed8796; }
        .activity-item { border: 0; border-radius: 12px; background-color: var(--card-background-color); }
        .activity-item.pending { color: var(--primary-text-color); }
        .activity-item.pending .activity-icon { color: var(--secondary-text-color); }
        .activity-item.completed { background-color: #a6da95; color: #181926; }
        .activity-name { font-size: 14px; font-weight: 500; }
        .activity-media-preview img { box-shadow: none; border-radius: 8px; }
        .audio-play-button { background: var(--primary-color); color: #181926; }
        .activity-item.completed .audio-play-button { background: #181926; color: #a6da95; }
        .audio-player-container { border: 0; border-radius: 12px; background: var(--card-background-color); }
        .audio-player-label { color: var(--primary-text-color); }
        .reward-preview { background: var(--card-background-color); border-radius: 12px; }
        .celebration { color: var(--primary-text-color); animation: none; }
        .camera-modal, .reward-modal, .photo-modal, .confirm-modal, .history-modal { box-shadow: none; border-radius: 16px; }
        .recording-indicator { background: var(--secondary-background-color); border-color: var(--divider-color); }
        .recording-indicator:hover { box-shadow: none; }
        .recording-indicator ha-icon { color: var(--secondary-text-color); }
        .recording-indicator.recording { background: #ed8796; border-color: #ed8796; }
        .recording-indicator.recording ha-icon { color: #181926; }
        .reward-quote-container { background: #eed49f; border-radius: 16px; }
        .reward-trophy, .reward-quote { color: #181926; text-shadow: none; }
        .reward-trophy { animation: none; }
        .photo-thumbnail, .photo-thumbnail:hover, .history-photo-container img { box-shadow: none; }
        .confirm-modal-header h2, .confirm-warning { color: #ed8796; }
        .history-photo-container, .history-audio-container { border: 0; background: var(--secondary-background-color); border-radius: 12px; }
        .history-navigation { background: var(--secondary-background-color); border-radius: 12px; }
        .transcription-box { border-left: 0; border-radius: 12px; background: var(--secondary-background-color); }

        /* Stable dialog sizes (v2.10.1): the <dialog> shrink-wraps its content, so percentage widths
           collapsed until the camera stream or the photo had loaded and then jumped. Size against the
           viewport instead and reserve the media area up front. */
        .camera-modal, .history-modal { width: min(600px, 92vw); max-width: none; }
        .confirm-modal { width: min(500px, 92vw); max-width: none; }
        .reward-modal, .photo-modal { width: min(900px, 92vw); max-width: none; }
        #camera-preview { display: block; aspect-ratio: 4 / 3; object-fit: cover; background: #000; }
        .audio-recorder-container { min-height: 280px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .photo-modal-content { min-height: min(60vh, 480px); box-sizing: border-box; display: flex; align-items: center; justify-content: center; }

        /* ------------------------------------------------------------------
           Reward from the photo (v2.11.0): generated image, waiting state, "medalha do dia", streak.
           Same sober palette as the unified style; all motion stops with prefers-reduced-motion.
           ------------------------------------------------------------------ */
        .streak-chip { display: inline-flex; align-items: center; gap: 2px; height: 28px; padding: 0 9px 0 6px; border-radius: 999px; background: var(--card-background-color); color: var(--primary-text-color); font-size: 14px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .streak-chip ha-icon { --mdc-icon-size: 16px; width: 16px; height: 16px; display: flex; color: #f5a97f; }

                .photo-reward { color: var(--primary-text-color); }
        .photo-reward .reward-modal-header h2 { font-size: 20px; font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
        .photo-reward-content { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: min(62vh, 460px); box-sizing: border-box; overflow: auto; }

        .reward-image-button { position: relative; display: inline-flex; align-items: center; justify-content: center; max-width: 100%; padding: 0; margin: 0; border: 0; background: none; cursor: zoom-in; border-radius: 12px; font: inherit; color: inherit; }
        .reward-image-button:focus-visible { outline: 3px solid var(--primary-color, #8aadf4); outline-offset: 3px; }
        .reward-modal-content .reward-image { display: block; max-width: 100%; max-height: calc(90vh - 190px); width: auto; height: auto; object-fit: contain; border-radius: 12px; margin: 0; background: var(--secondary-background-color); }
        .reward-image-zoom-hint { position: absolute; right: 8px; bottom: 8px; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: rgba(24, 25, 38, 0.6); color: #fff; --mdc-icon-size: 24px; pointer-events: none; }
        .reward-caption { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 4px 12px; color: var(--primary-text-color); }
        .reward-caption-name { font-size: 18px; font-weight: 600; }
        .reward-caption-date { font-size: 15px; color: var(--secondary-text-color); }
        .reward-caption-streak { display: inline-flex; align-items: center; gap: 4px; font-size: 15px; font-weight: 500; align-self: center; }
        .reward-caption-streak ha-icon { --mdc-icon-size: 18px; width: 18px; height: 18px; display: flex; color: #f5a97f; }

        .reward-zoom { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.94); cursor: zoom-out; touch-action: pinch-zoom; }
        .reward-zoom img { max-width: 100vw; max-height: 100vh; width: auto; height: auto; object-fit: contain; }
        .reward-zoom:focus-visible { outline: 3px solid #fff; outline-offset: -3px; }
        .reward-zoom-close { position: absolute; top: 12px; right: 12px; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: rgba(255, 255, 255, 0.16); color: #fff; --mdc-icon-size: 24px; }

        .reward-waiting { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px 8px; max-width: 460px; }
        .reward-waiting-art { position: relative; display: flex; align-items: center; justify-content: center; width: 112px; height: 112px; margin-bottom: 8px; color: var(--child-color, #8aadf4); --mdc-icon-size: 48px; }
        .reward-waiting-art ha-icon { width: 48px; height: 48px; display: flex; }
        .reward-waiting-ring { position: absolute; inset: 0; border-radius: 50%; border: 6px solid var(--secondary-background-color); border-top-color: var(--child-color, #8aadf4); animation: mr-spin 1.2s linear infinite; }
        .reward-waiting-title { margin: 0; font-size: 24px; font-weight: 600; line-height: 1.25; color: var(--primary-text-color); }
        .reward-waiting-text { margin: 0; font-size: 16px; line-height: 1.45; color: var(--secondary-text-color); }
        @keyframes mr-spin { to { transform: rotate(360deg); } }

        .reward-medal-card { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; box-sizing: border-box; padding: 28px 20px 24px; border-radius: 16px; background: var(--secondary-background-color); color: var(--primary-text-color); }
        .reward-medal-kicker { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--secondary-text-color); }
        .reward-medal { position: relative; width: 150px; height: 176px; margin: 4px 0; flex: none; }
        .reward-medal-ribbon { position: absolute; top: 0; width: 34px; height: 84px; background: var(--child-color, #8aadf4); border-radius: 4px; }
        .reward-medal-ribbon.left { left: 40px; transform: rotate(-20deg); transform-origin: bottom center; }
        .reward-medal-ribbon.right { right: 40px; transform: rotate(20deg); transform-origin: bottom center; filter: brightness(0.85); }
        .reward-medal-disc { position: absolute; left: 50%; bottom: 0; width: 124px; height: 124px; margin-left: -62px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #eed49f; border: 8px solid #e5c07b; color: #181926; --mdc-icon-size: 56px; animation: mr-medal-in 0.7s cubic-bezier(0.2, 0.9, 0.3, 1.3) both; }
        .reward-medal-disc ha-icon { width: 56px; height: 56px; display: flex; }
        .reward-medal-number { font-size: 60px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
        .reward-medal-streak { margin: 4px 0 0; font-size: 22px; font-weight: 600; }
        .reward-medal-phrase { margin: 6px 0 0; max-width: 28ch; font-size: clamp(22px, 4.2vw, 30px); font-weight: 600; line-height: 1.25; text-wrap: balance; overflow-wrap: anywhere; }
        .reward-medal-best { display: inline-flex; align-items: center; gap: 6px; margin: 10px 0 0; font-size: 15px; color: var(--secondary-text-color); }
        .reward-medal-best ha-icon { --mdc-icon-size: 18px; width: 18px; height: 18px; display: flex; }
        .reward-medal-card > p, .reward-medal { position: relative; z-index: 1; }
        @keyframes mr-medal-in { from { transform: scale(0.6) rotate(-12deg); opacity: 0; } to { transform: none; opacity: 1; } }

        .reward-confetti { position: absolute; inset: 0; pointer-events: none; }
        .confetti-piece { position: absolute; top: -16px; width: 9px; height: 15px; border-radius: 2px; opacity: 0.9; animation: mr-confetti 3.6s linear infinite; }
        .confetti-piece.c0 { background: #a6da95; }
        .confetti-piece.c1 { background: #eed49f; }
        .confetti-piece.c2 { background: #ed8796; width: 10px; height: 10px; border-radius: 50%; }
        .confetti-piece.c3 { background: #8aadf4; }
        @keyframes mr-confetti {
            0% { transform: translateY(0) rotate(0deg); }
            100% { transform: translateY(560px) rotate(540deg); }
        }

        @media (max-width: 480px) {
            .photo-reward .reward-modal-header h2 { font-size: 18px; }
            .reward-modal-content .reward-image { max-height: calc(90vh - 210px); }
            .reward-medal-card { padding: 22px 14px 20px; }
        }

        @media (prefers-reduced-motion: reduce) {
            .reward-waiting-ring { animation: none; border-color: var(--child-color, #8aadf4); opacity: 0.35; }
            .reward-medal-disc { animation: none; }
            /* Confetti stays as a still decoration along the top edge */
            .confetti-piece { animation: none; top: 10px; }
            .confetti-piece:nth-child(odd) { top: 26px; transform: rotate(35deg); }
            .confetti-piece:nth-child(3n) { transform: rotate(-25deg); }
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
    `%c MORNING-ROUTINE-CARD %c 2.11.0 - Reward image from the photo, medalha do dia and streak `,
    "color: white; font-weight: bold; background: #4CAF50",
    "color: white; font-weight: bold; background: #2196F3"
);
