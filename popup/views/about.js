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
        
        <div class="view-body" style="overflow: hidden; display: flex; flex-direction: column; align-items: center; padding: 10px 16px; justify-content: space-between;">
            
            <!-- Branding Section (Compacted) -->
            <div class="about-branding" style="text-align: center; margin-bottom: 4px; animation: fadeIn 0.4s ease-out;">
                <div class="app-logo-wrapper" style="
                    width: 54px; 
                    height: 54px; 
                    margin: 0 auto 6px; 
                    background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(33, 150, 243, 0.1));
                    border-radius: 18px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                ">
                    <svg viewBox="0 0 512 512" width="40" height="40" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(76, 175, 80, 0.4)); animation: float 6s ease-in-out infinite;">
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
                    font-size: 15px; 
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
                ">AdGuard Home Manager</h2>
                
                <div class="app-version" style="
                    display: inline-block;
                    font-family: monospace;
                    font-size: 10px;
                    color: var(--color-text-secondary);
                    opacity: 0.6;
                    padding: 2px 8px;
                    background: rgba(255,255,255,0.03);
                    border-radius: 10px;
                ">v${manifest.version}</div>
            </div>

            <!-- Innovative Author Card -->
            <div class="author-card-wrapper" style="
                width: 100%;
                margin-bottom: 8px;
                position: relative;
                padding: 1px;
                background: linear-gradient(135deg, rgba(76, 175, 80, 0.5), rgba(33, 150, 243, 0.5), rgba(76, 175, 80, 0.5));
                background-size: 200% 200%;
                border-radius: 16px;
                animation: borderFlow 4s ease infinite;
            ">
                <style>
                    @keyframes borderFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                    @keyframes glowPulse { 0% { box-shadow: 0 0 5px rgba(76, 175, 80, 0.2); } 50% { box-shadow: 0 0 15px rgba(76, 175, 80, 0.4); } 100% { box-shadow: 0 0 5px rgba(76, 175, 80, 0.2); } }
                </style>
                <div class="author-card" style="
                    background: #1c1f26;
                    border-radius: 15px;
                    padding: 10px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    overflow: hidden;
                    position: relative;
                ">
                    <!-- Avatar Area -->
                    <div style="position: relative;">
                        <div style="
                            position: absolute; inset: -3px; 
                            background: linear-gradient(90deg, #81c784, #4caf50, #2196f3); 
                            border-radius: 50%; 
                            animation: spin 3s linear infinite; 
                            opacity: 0.7; 
                            filter: blur(2px);
                        "></div>
                        <div style="
                            width: 48px; 
                            height: 48px; 
                            border-radius: 50%; 
                            background: #15171b;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-weight: 800;
                            font-size: 18px;
                            position: relative;
                            z-index: 1;
                            border: 2px solid #1c1f26;
                        ">
                            <span style="background: linear-gradient(135deg, #ffffff, #b0bec5); -webkit-background-clip: text; background-clip: text; color: transparent;">SD</span>
                        </div>
                    </div>
                    
                    <!-- Text Info -->
                    <div style="flex-grow: 1; z-index: 1; display: flex; flex-direction: column; justify-content: center;">
                        <div style="
                            font-size: 9px; 
                            text-transform: uppercase; 
                            color: #81c784; 
                            font-weight: 800; 
                            letter-spacing: 1px; 
                            margin-bottom: 2px;
                        ">Architect</div>
                        <div style="
                            font-weight: 800; 
                            color: white; 
                            font-size: 15px; 
                            letter-spacing: -0.3px;
                            background: linear-gradient(90deg, #fff, #e0e0e0);
                            -webkit-background-clip: text;
                            background-clip: text;
                            color: transparent;
                        ">Saugata Datta</div>
                        
                        <!-- Built with Antigravity -->
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 4px;
                            margin-top: 5px;
                            opacity: 0.7;
                        ">
                            <span style="font-size: 9px; color: #94a3b8; font-weight: 500;">Coded with Google Antigravity</span>
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" style="color: #4285F4;">
                                <path d="M16 18l6-6-6-6"></path>
                                <path d="M8 6l-6 6 6 6"></path>
                                <path d="M12 21l4-18"></path>
                            </svg>
                        </div>
                    </div>
                    
                    <!-- Interactive Action Button -->
                    <a href="https://technochat.in" target="_blank" class="shiny-btn" style="
                        position: relative;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 36px;
                        height: 36px;
                        background: rgba(33, 150, 243, 0.1);
                        border-radius: 12px;
                        color: #2196f3;
                        text-decoration: none;
                        border: 1px solid rgba(33, 150, 243, 0.2);
                        overflow: hidden;
                    " title="Visit Web Site">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"></path><path d="M10 14L21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>
                    </a>
                </div>
            </div>

            <!-- Vertical Links List (Compacted) -->
            <div class="about-links" style="width: 100%; display: flex; flex-direction: column; gap: 8px; margin-bottom: auto;">
                <a href="https://technochat.in/the-ultimate-command-center-for-adguard-home-power-users/" target="_blank" class="about-link-btn" title="Get Help">
                    <div class="icon-box" style="background: rgba(33, 150, 243, 0.1); color: #2196f3;">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"></line><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"></line><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"></line><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"></line></svg>
                    </div>
                    <span>Get Help</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" class="arrow" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </a>

                <a href="https://github.com/iAmSaugata/AdGuardHomeManageFilter#readme" target="_blank" class="about-link-btn" title="View ReadMe">
                    <div class="icon-box" style="background: rgba(255, 255, 255, 0.05); color: #f0f6fc;">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                    </div>
                    <span>ReadMe</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" class="arrow" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </a>
                
                <a href="https://github.com/iAmSaugata/AdGuardHomeManageFilter/blob/main/privacy-policy.md" target="_blank" class="about-link-btn" title="View Privacy Policy">
                    <div class="icon-box" style="background: rgba(76, 175, 80, 0.1); color: #4caf50;">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    </div>
                    <span>Privacy Policy</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" class="arrow" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </a>

                <a href="https://github.com/iAmSaugata/AdGuardHomeManageFilter/blob/main/LICENSE" target="_blank" class="about-link-btn" title="View License">
                    <div class="icon-box" style="background: rgba(255, 152, 0, 0.1); color: #ff9800;">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                    </div>
                    <span>MIT License</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" class="arrow" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </a>
            </div>

            <!-- Disclaimer Footer -->
            <div class="disclaimer-footer" style="
                margin-top: 12px;
                font-size: 10px;
                color: var(--color-text-secondary);
                text-align: center;
                line-height: 1.4;
                opacity: 0.9;
                font-weight: 500;
            ">
                Not affiliated with AdGuard Software Ltd.<br>AdGuard Home is a trademark of AdGuard Software Ltd.
            </div>

        </div>
    `;

    // Inject styles (if not already present)
    const styleId = 'about-view-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .shiny-btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
                transition: left 0.5s;
                transform: skewX(-25deg);
            }
            .shiny-btn:hover::before {
                left: 100%;
            }
            .shiny-btn:hover {
                transform: scale(1.05);
                box-shadow: 0 0 8px rgba(33, 150, 243, 0.4);
                background: rgba(33, 150, 243, 0.2) !important;
            }
            .about-link-btn {
                display: flex;
                align-items: center;
                padding: 8px 12px;
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
                width: 28px;
                height: 28px;
                border-radius: 6px;
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
