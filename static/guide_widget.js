/*
 * ⚠️ HEY AI AGENT! Editing this script?
 * 1. Stop! Read spotiless_context.md & AGENTS.md rules first!
 * 2. Strict Fast-Path Budget: Capped at 1–2 tool calls total (Read -> Edit -> Done).
 * 3. Start all initial file reads at Line 1.
 */

(function () {
    const GUIDES = {
        mobile: [
            { src: "guide/mobile_step1.png", text: "<strong>1.</strong> Tap your profile icon, then tap <strong>View profile</strong>." },
            { src: "guide/mobile_step2.png", text: "<strong>2.</strong> Tap the <strong>Share</strong> icon or <strong>...</strong> under your profile." },
            { src: "guide/mobile_step3.png", text: "<strong>3.</strong> Tap <strong>Copy link</strong>, then paste it into Spoti-Less." }
        ],
        pc: [
            { src: "guide/pc_step1.png", text: "<strong>1.</strong> Click your <strong>Profile icon</strong> in the top-right." },
            { src: "guide/pc_step2.png", text: "<strong>2.</strong> Click <strong>Profile</strong> in the dropdown." },
            { src: "guide/pc_step3.png", text: "<strong>3.</strong> Click the <strong>...</strong> button under your profile header." },
            { src: "guide/pc_step4.png", text: "<strong>4.</strong> Click <strong>Copy link to profile</strong> and paste it here." }
        ]
    };

    function isMobileViewport() {
        return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
    }

    function ensureLightbox() {
        let box = document.getElementById("spg-lightbox");
        if (box) return box;
        box = document.createElement("div");
        box.id = "spg-lightbox";
        box.className = "spg-lightbox hidden";
        box.innerHTML = [
            '<button type="button" class="spg-lightbox-close" aria-label="Close">&times;</button>',
            '<img id="spg-lightbox-img" src="" alt="Spotify guide step">',
            '<div id="spg-lightbox-caption" class="spg-lightbox-caption"></div>'
        ].join("");
        box.addEventListener("click", (e) => {
            if (e.target === box || e.target.classList.contains("spg-lightbox-close")) {
                box.classList.add("hidden");
            }
        });
        document.body.appendChild(box);
        return box;
    }

    function openLightbox(src, htmlCaption) {
        const box = ensureLightbox();
        const img = document.getElementById("spg-lightbox-img");
        const cap = document.getElementById("spg-lightbox-caption");
        if (img) img.src = src;
        if (cap) cap.innerHTML = htmlCaption;
        box.classList.remove("hidden");
    }

    function renderSteps(grid, platform) {
        const steps = GUIDES[platform] || GUIDES.mobile;
        grid.innerHTML = "";
        steps.forEach((step) => {
            const card = document.createElement("div");
            card.className = "spg-step-card";

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "spg-step-img-btn";
            btn.title = "Click to zoom";
            const img = document.createElement("img");
            img.className = "spg-step-img";
            img.src = step.src;
            img.alt = "Spotify profile link step";
            img.loading = "lazy";
            btn.appendChild(img);
            btn.addEventListener("click", () => openLightbox(step.src, step.text));

            const cap = document.createElement("div");
            cap.className = "spg-step-caption";
            cap.innerHTML = step.text;

            card.appendChild(btn);
            card.appendChild(cap);
            grid.appendChild(card);
        });
    }

    function mountGuide(container) {
        if (!container || container.dataset.spgMounted === "1") return;
        container.dataset.spgMounted = "1";

        const defaultPlatform = isMobileViewport() ? "mobile" : "pc";
        const isOpen = container.dataset.open === "true";

        container.innerHTML = `
            <details class="spg-details" ${isOpen ? "open" : ""}>
                <summary class="spg-summary">📸 Photo Guide: How to Copy Your Spotify Profile Link (Mobile &amp; PC)</summary>
                <div class="spg-body">
                    <p class="spg-note">
                        Multiple Spotify users can share the same display name. Pasting your <strong>Profile Link</strong> (or a <strong>Public Playlist Link</strong>) guarantees Spoti-Less loads <em>your</em> exact account. Tap any photo to zoom.
                    </p>
                    <div class="spg-tabs" role="tablist">
                        <button type="button" class="spg-tab ${defaultPlatform === "mobile" ? "active" : ""}" data-platform="mobile">📱 Mobile</button>
                        <button type="button" class="spg-tab ${defaultPlatform === "pc" ? "active" : ""}" data-platform="pc">💻 PC / Desktop</button>
                    </div>
                    <div class="spg-steps-grid"></div>
                </div>
            </details>
        `;

        const grid = container.querySelector(".spg-steps-grid");
        const tabs = container.querySelectorAll(".spg-tab");
        renderSteps(grid, defaultPlatform);

        tabs.forEach((tab) => {
            tab.addEventListener("click", () => {
                tabs.forEach((t) => t.classList.remove("active"));
                tab.classList.add("active");
                renderSteps(grid, tab.dataset.platform);
            });
        });
    }

    function initAllGuides() {
        document.querySelectorAll("[data-spotify-photo-guide]").forEach(mountGuide);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAllGuides);
    } else {
        initAllGuides();
    }
})();
