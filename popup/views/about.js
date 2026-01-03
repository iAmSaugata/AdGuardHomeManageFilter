/**
 * About Page View - Polished & Compact
 * Displays app information, branding, author details, and legal disclaimers.
 */

export function renderAbout(container) {
    const manifest = chrome.runtime.getManifest();

    container.innerHTML = `
        <div class="view-header">
            <button class="header-back-btn" id="about-back-btn">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                <span>BACK</span>
            </button>
            <h1 class="view-title">About</h1>
            <div class="header-action-area"></div>
        </div>
        
        <div class="view-body" style="overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 20px 16px;">
            
            <!-- Branding Section -->
            <div class="about-branding" style="text-align: center; margin-bottom: 24px; animation: fadeIn 0.4s ease-out;">
                <div class="app-logo-wrapper" style="
                    width: 72px; 
                    height: 72px; 
                    margin: 0 auto 12px; 
                    background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(33, 150, 243, 0.1));
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                ">
                    <svg viewBox="0 0 512 512" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(76, 175, 80, 0.4)); animation: float 6s ease-in-out infinite;">
                        <style>@keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-4px); } 100% { transform: translateY(0px); } }</style>
                        <defs>
                            <linearGradient id="icon_gradient" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
                                <stop offset="0" stop-color="#81c784"/>
                                <stop offset="1" stop-color="#2196f3"/>
                            </linearGradient>
                        </defs>
                        <path d="M256 460C256 460 416 380 416 260V120L256 60L96 120V260C96 380 256 460 256 460Z" fill="url(#icon_gradient)" fill-opacity="0.2" stroke="url(#icon_gradient)" stroke-width="24"/>
                        <path d="M196 256L236 296L316 216" stroke="#ffffff" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                
                <h2 class="app-name" style="
                    font-size: 18px; 
                    font-weight: 800; 
                    margin: 0 0 2px;
                    background: linear-gradient(90deg, #ffffff, #81c784, #4caf50); 
                    -webkit-background-clip: text; 
                    background-clip: text; 
                    color: transparent;
                    text-transform: uppercase;
                    letter-spacing: -0.5px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                ">AdGuard Home Manager</h2>
                
                <div class="app-version" style="
                    display: inline-block;
                    font-family: monospace;
                    font-size: 11px;
                    color: var(--color-text-secondary);
                    opacity: 0.7;
                ">v${manifest.version}</div>
            </div>

            <!-- Author Card -->
            <div class="author-card" style="
                width: 100%;
                background: linear-gradient(to right, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                padding: 12px 16px;
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 24px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ">
                <div style="
                    width: 42px; 
                    height: 42px; 
                    border-radius: 50%; 
                    background: linear-gradient(135deg, #FF6B6B, #4ECDC4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    color: white;
                    font-size: 16px;
                    flex-shrink: 0;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                ">SD</div>
                <div style="overflow: hidden;">
                    <div style="font-size: 10px; text-transform: uppercase; color: var(--color-text-tertiary); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 2px;">Developed By</div>
                    <div style="font-weight: 600; color: white; font-size: 14px; white-space: nowrap;">Saugata Datta</div>
                    <a href="https://technochat.in" target="_blank" style="font-size: 11px; color: var(--color-accent); text-decoration: none; opacity: 0.9;">technochat.in</a>
                </div>
            </div>

            <!-- Vertical Links List -->
            <div class="about-links" style="width: 100%; display: flex; flex-direction: column; gap: 10px; margin-bottom: auto;">
                <a href="https://github.com/iAmSaugata" target="_blank" class="about-link-btn" title="View GitHub Profile">
                    <div class="icon-box" style="background: rgba(33, 150, 243, 0.1); color: #2196f3;">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                    </div>
                    <span>GitHub Profile</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" class="arrow" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </a>
                
                <a href="https://github.com/iAmSaugata/AdGuardHomeManageFilter/blob/main/privacy-policy.md" target="_blank" class="about-link-btn" title="View Privacy Policy">
                    <div class="icon-box" style="background: rgba(76, 175, 80, 0.1); color: #4caf50;">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    </div>
                    <span>Privacy Policy</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" class="arrow" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </a>

                <!-- Changed LICENSE link to point to repo root LICENSE if not yet pushed, or specific file. Assuming standard repo structure relative to privacy policy -->
                <a href="https://github.com/iAmSaugata/AdGuardHomeManageFilter/blob/main/LICENSE" target="_blank" class="about-link-btn" title="View License">
                    <div class="icon-box" style="background: rgba(255, 152, 0, 0.1); color: #ff9800;">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                    </div>
                    <span>MIT License</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" class="arrow" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </a>
            </div>

            <!-- Disclaimer Footer -->
            <div class="disclaimer-footer" style="
                margin-top: 16px;
                font-size: 9px;
                color: var(--color-text-disabled);
                text-align: center;
                line-height: 1.4;
                opacity: 0.6;
            ">
                Not affiliated with AdGuard Software Ltd.<br>AdGuard Home is a trademark of AdGuard Software Ltd.
            </div>

        </div>
    `;

    // Inject styles for the link buttons
    const styleId = 'about-view-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .about-link-btn {
                display: flex;
                align-items: center;
                padding: 10px 12px;
                background: var(--color-bg-secondary);
                border: 1px solid var(--color-border);
                border-radius: 10px;
                text-decoration: none;
                color: var(--color-text-primary);
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
            }
            .about-link-btn:hover {
                background: rgba(255,255,255,0.06);
                border-color: rgba(255,255,255,0.15);
                transform: translateX(2px);
            }
            .about-link-btn:active {
                transform: translateX(0) scale(0.98);
            }
            .about-link-btn .icon-box {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 12px;
            }
            .about-link-btn span {
                flex-grow: 1;
            }
            .about-link-btn .arrow {
                color: var(--color-text-tertiary);
                transition: transform 0.2s;
            }
            .about-link-btn:hover .arrow {
                color: var(--color-text-secondary);
                transform: translateX(2px);
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    // Back Button Handler
    const backBtn = document.getElementById('about-back-btn');
    backBtn.addEventListener('click', () => {
        window.app.navigateTo('server-list');
    });
}
