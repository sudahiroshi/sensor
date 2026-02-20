// =============================================
// SensorScope — Welcome Page
// =============================================

export class WelcomePage {
  constructor(app) {
    this.app = app;
  }

  mount(container) {
    const isSecure = window.isSecureContext === true;
    const sm = this.app.sensorManager;

    container.innerHTML = `
      <div class="welcome page">
        <div class="welcome__logo">📡</div>
        <h1 class="welcome__title">SensorScope</h1>
        <p class="welcome__subtitle">
          スマートフォンのセンサーデータを<br>リアルタイムで可視化・記録
        </p>
        <div class="welcome__features">
          <div class="welcome__feature">
            <span class="welcome__feature-icon">📊</span>
            <span>加速度・ジャイロ・姿勢をリアルタイムグラフ表示</span>
          </div>
          <div class="welcome__feature">
            <span class="welcome__feature-icon">📍</span>
            <span>GPS位置情報の取得・記録</span>
          </div>
          <div class="welcome__feature">
            <span class="welcome__feature-icon">💾</span>
            <span>データの記録・CSV/JSONエクスポート</span>
          </div>
        </div>

        ${!isSecure && sm.needsPermission ? `
          <div id="welcome-https-warning" class="welcome__warning">
            <p style="font-size: 0.875rem; color: var(--accent-amber); margin-bottom: 8px;">
              ⚠️ HTTP接続を検出しました
            </p>
            <p style="font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.5;">
              iOS Safariでセンサー（加速度・ジャイロ）を使用するには<strong style="color: var(--text-primary)">HTTPS接続</strong>が必要です。<br>
              GPS機能のみ使用する場合は「スキップ」を押してください。
            </p>
          </div>
        ` : ''}

        <button id="welcome-start" class="btn btn--secondary">
          センサーを有効にする
        </button>

        ${!isSecure && sm.needsPermission ? `
          <button id="welcome-skip" class="btn btn--outline" style="margin-top: 8px;">
            スキップして続行（GPSのみ）
          </button>
        ` : ''}

        <p id="welcome-error" class="text-secondary mt-md" style="font-size: 0.8125rem; display: none;"></p>
      </div>
    `;

    const btn = container.querySelector('#welcome-start');
    const errorEl = container.querySelector('#welcome-error');
    const skipBtn = container.querySelector('#welcome-skip');

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '許可を確認中...';

      const result = await this.app.sensorManager.requestPermission();

      if (result.granted) {
        localStorage.setItem('sensorscope_welcomed', '1');
        this.app.navigate('#/');
      } else {
        btn.disabled = false;
        btn.textContent = 'もう一度試す';
        errorEl.style.display = 'block';

        switch (result.reason) {
          case 'insecure':
            errorEl.innerHTML = `
              <span style="color: var(--accent-amber)">⚠️ HTTPS接続が必要です</span><br>
              <span style="margin-top: 4px; display: inline-block;">
                サーバーをHTTPS対応にするか、下の「スキップ」ボタンでGPSのみ使用できます。<br>
                <code style="font-size: 0.75rem; background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">npx -y serve . --ssl -p 3000</code>
              </span>`;
            break;
          case 'denied':
            errorEl.textContent = 'センサーの許可が拒否されました。iOS設定 > Safari > モーションと画面の向きのアクセスを確認してください。';
            break;
          default:
            errorEl.textContent = `センサーの許可でエラーが発生しました: ${result.error || '不明なエラー'}`;
            break;
        }
      }
    });

    // Skip button — proceed without motion sensors
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        localStorage.setItem('sensorscope_welcomed', '1');
        this.app.navigate('#/');
      });
    }
  }

  unmount() {}
}
