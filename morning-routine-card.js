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
                    <div class="children-container ${this._config.layout}">
                        ${this._children.map(child => this._renderChild(child))}
                    </div>
                </div>
            </ha-card>
            ${this._renderCameraModal()}
            ${this._renderAudioRecorderModal()}
            ${this._renderPhotoModal()}
            ${this._renderRewardModal()}
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

                <div class="button-container">
                    ${hasPhoto ? html`
                        <div class="photo-thumbnail" @click=${() => this._showPhotoModal(child)}>
                            <img src="/local/morning_routine_photos/${this._getFilename(child.photo_path)}" alt="Foto de ${child.name}">
                            <div class="photo-overlay">
                                <ha-icon icon="mdi:magnify-plus"></ha-icon>
                            </div>
                        </div>
                    ` : ''}
                    ${allComplete ? html`
                        <mwc-button
                            class="reward-button"
                            raised
                            @click=${() => this._showRewardModal(child)}>
                            <ha-icon icon="mdi:trophy" slot="icon"></ha-icon>
                            Ver Recompensa
                        </mwc-button>
                    ` : ''}
                    ${hasAudio ? html`
                        <mwc-button
                            class="audio-button"
                            raised
                            @click=${() => this._playAudio(child)}>
                            <ha-icon icon="mdi:play-circle" slot="icon"></ha-icon>
                            Ouvir Pequeno-Almoço
                        </mwc-button>
                    ` : ''}
                    <mwc-button
                        @click=${() => this._resetChild(child)}
                        dense>
                        <ha-icon icon="mdi:restart" slot="icon"></ha-icon>
                        Reiniciar Dia
                    </mwc-button>
                </div>
            </div>
        `;
    }

    _renderHeader(child) {
        return html`
            <div class="child-header">
                <h2>${child.name}</h2>
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

        return html`
            <div
                class="activity-item ${isCompleted ? 'completed' : 'pending'}"
                @click=${() => this._handleActivityClick(child, activity)}
                data-activity-id="${activity.id}"
                data-completed="${isCompleted}"
            >
                <div class="activity-icon">
                    <ha-icon icon="${activity.icon || 'mdi:check-circle-outline'}"></ha-icon>
                </div>
                <div class="activity-name">${activity.name}</div>
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

        // Toggle: if already completed, uncheck it
        if (activity.completed) {
            await this._completeActivity(childName, activity.id, false);
            return;
        }

        // Check if activity requires special interaction
        if (activity.id === 'breakfast' && !activity.completed) {
            // Show audio recorder for breakfast
            this._currentChild = childName;
            this._currentActivity = activity.id;
            this._showAudioRecorder = true;
            this.requestUpdate();
        } else if (activity.camera_required && !activity.completed) {
            // Show camera for dressed
            this._currentChild = childName;
            this._currentActivity = activity.id;
            this._showCamera = true;
            this.requestUpdate();
            await this.updateComplete;
            this._startCamera();
        } else {
            // Direct completion
            await this._completeActivity(childName, activity.id, true);
        }
    }

    _renderCameraModal() {
        if (!this._showCamera) return html``;

        return html`
            <div class="modal-overlay" @click=${this._closeCamera}>
                <div class="camera-modal" @click=${(e) => e.stopPropagation()}>
                    <div class="camera-header">
                        <h2>📸 Tira uma Foto!</h2>
                        <mwc-icon-button @click=${this._closeCamera}>
                            <ha-icon icon="mdi:close"></ha-icon>
                        </mwc-icon-button>
                    </div>
                    <div class="camera-container">
                        <video id="camera-preview" autoplay playsinline></video>
                        <canvas id="camera-canvas" style="display:none"></canvas>
                    </div>
                    <div class="camera-controls">
                        <mwc-button raised @click=${this._capturePhoto}>
                            <ha-icon icon="mdi:camera" slot="icon"></ha-icon>
                            Capturar
                        </mwc-button>
                        <mwc-button @click=${this._closeCamera}>
                            Cancelar
                        </mwc-button>
                    </div>
                </div>
            </div>
        `;
    }

    async _startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: 640, height: 480 }
            });
            const video = this.shadowRoot.getElementById("camera-preview");
            if (video) {
                video.srcObject = stream;
            }
        } catch (err) {
            console.error("Erro de acesso à câmara:", err);
            alert("Não foi possível aceder à câmara. Por favor certifica-te que o HTTPS está ativado e que as permissões da câmara foram concedidas.");
            this._closeCamera();
        }
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
                        <div class="recording-indicator ${this._isRecording ? 'recording' : ''}">
                            <ha-icon icon="mdi:microphone"></ha-icon>
                            ${this._isRecording ? html`<span class="recording-time">${this._formatTime(this._recordingTime)}</span>` : ''}
                        </div>
                        <p class="audio-hint">
                            ${this._isRecording ? 'A gravar... Conta o que comeste!' : 'Carrega no botão para começar a gravar'}
                        </p>
                    </div>
                    <div class="camera-controls">
                        ${!this._isRecording ? html`
                            <mwc-button raised @click=${this._startRecording}>
                                <ha-icon icon="mdi:record" slot="icon"></ha-icon>
                                Começar a Gravar
                            </mwc-button>
                        ` : html`
                            <mwc-button raised @click=${this._stopRecording}>
                                <ha-icon icon="mdi:stop" slot="icon"></ha-icon>
                                Parar e Guardar
                            </mwc-button>
                        `}
                        <mwc-button @click=${this._closeAudioRecorder}>
                            Cancelar
                        </mwc-button>
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

    _playAudio(child) {
        if (!child.audio_recording) return;

        const audio = new Audio(`/local/morning_routine_photos/${this._getFilename(child.audio_recording)}`);
        audio.play().catch(err => {
            console.error("Erro ao reproduzir áudio:", err);
            alert("Erro ao reproduzir áudio.");
        });
    }

    async _capturePhoto() {
        const video = this.shadowRoot.getElementById("camera-preview");
        const canvas = this.shadowRoot.getElementById("camera-canvas");

        if (!video || !canvas) return;

        const context = canvas.getContext("2d");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        // Convert to base64 (remove data:image/jpeg;base64, prefix)
        const photoData = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];

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

    async _resetChild(child) {
        const childName = child.state.attributes.child;
        try {
            await this._hass.callService("morning_routine", "reset_routine", {
                child: childName,
            });
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
                        <img src="/local/morning_routine_photos/${this._getFilename(this._photoChild.photo_path)}"
                             alt="Foto de ${this._photoChild.name}" />
                    </div>
                </div>
            </div>
        `;
    }

    _renderRewardModal() {
        if (!this._showReward || !this._rewardChild) return html``;

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
                        ${hasAIImage ? html`
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

    static styles = css`
        :host {
            --mdc-theme-primary: var(--primary-text-color);
        }

        .card-content {
            padding: 16px;
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
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 12px;
        }

        .activities-grid.compact {
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 8px;
        }

        .activity-item {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 16px 8px;
            border-radius: 8px;
            background: var(--card-background-color);
            border: 2px solid #e0e0e0;
            cursor: pointer;
            transition: all 0.3s ease;
            min-height: 100px;
        }

        .activity-item:hover:not(.completed) {
            transform: scale(1.05);
            border-color: var(--child-color);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .activity-item.pending {
            background: #fff;
        }

        .activity-item.completed {
            background: #c8e6c9;
            border-color: #4CAF50;
            cursor: default;
        }

        .activity-icon {
            font-size: 48px;
            margin-bottom: 8px;
            color: var(--primary-text-color);
        }

        .activity-icon ha-icon {
            width: 48px;
            height: 48px;
        }

        .activity-item.completed .activity-icon {
            color: #2e7d32;
        }

        .activity-name {
            font-size: 13px;
            text-align: center;
            line-height: 1.2;
        }

        .check-mark {
            position: absolute;
            top: 4px;
            right: 4px;
            color: #2e7d32;
            font-size: 24px;
        }

        .button-container {
            margin-top: 16px;
            padding: 12px;
            text-align: center;
            border-top: 1px solid var(--divider-color);
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .button-container mwc-button {
            width: 100%;
        }

        .reward-button {
            --mdc-theme-primary: #FF9800;
            --mdc-theme-on-primary: white;
            background: linear-gradient(135deg, #FFD54F 0%, #FF9800 100%);
            animation: pulse 2s infinite;
        }

        .audio-button {
            --mdc-theme-primary: #4CAF50;
            --mdc-theme-on-primary: white;
            background: linear-gradient(135deg, #81C784 0%, #4CAF50 100%);
        }

        .button-container ha-icon {
            width: 28px;
            height: 28px;
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

        .camera-modal, .reward-modal {
            background: var(--card-background-color);
            border-radius: 12px;
            max-width: 600px;
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
        }

        #camera-preview {
            width: 100%;
            border-radius: 8px;
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
    `%c MORNING-ROUTINE-CARD %c 1.5.0 - Race Condition Fix `,
    "color: white; font-weight: bold; background: #4CAF50",
    "color: white; font-weight: bold; background: #2196F3"
);
