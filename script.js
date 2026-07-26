const chapterElements = [...document.querySelectorAll('.chapter')];
const timelineDotsContainer = document.getElementById('timeline-dots');
const timelineProgress = document.getElementById('timeline-progress');
const reducedMotionToggle = document.getElementById('reduced-motion-toggle');
const audioToggle = document.getElementById('audio-toggle');
const fallbackNotice = document.getElementById('webgl-fallback');

const chapterStates = [
    { camera: [0, 1.2, 9], color: [0.03, 0.04, 0.08], fog: [0.05, 0.06, 0.1], atom: 0.2, board: 0.1, tower: 0.0, shock: 0.0, fragments: 0.05, legacy: 0.0 },
    { camera: [-0.6, 0.9, 8], color: [0.05, 0.1, 0.18], fog: [0.08, 0.12, 0.2], atom: 0.8, board: 0.2, tower: 0.0, shock: 0.0, fragments: 0.05, legacy: 0.0 },
    { camera: [0.5, 0.6, 7], color: [0.08, 0.15, 0.25], fog: [0.1, 0.18, 0.28], atom: 1.0, board: 0.8, tower: 0.0, shock: 0.0, fragments: 0.08, legacy: 0.0 },
    { camera: [1.3, 0.4, 6], color: [0.11, 0.13, 0.19], fog: [0.14, 0.16, 0.22], atom: 0.45, board: 0.55, tower: 1.0, shock: 0.0, fragments: 0.16, legacy: 0.0 },
    { camera: [0.2, 0.0, 5.2], color: [0.24, 0.11, 0.05], fog: [0.25, 0.14, 0.08], atom: 0.25, board: 0.2, tower: 0.85, shock: 1.0, fragments: 0.25, legacy: 0.0 },
    { camera: [-1.2, -0.2, 6.4], color: [0.18, 0.11, 0.1], fog: [0.2, 0.13, 0.12], atom: 0.1, board: 0.1, tower: 0.3, shock: 0.25, fragments: 0.85, legacy: 0.0 },
    { camera: [0.4, 0.5, 7.6], color: [0.09, 0.09, 0.12], fog: [0.11, 0.11, 0.15], atom: 0.08, board: 0.12, tower: 0.15, shock: 0.0, fragments: 0.45, legacy: 0.6 },
    { camera: [0, 0.8, 8.2], color: [0.06, 0.08, 0.11], fog: [0.08, 0.1, 0.13], atom: 0.25, board: 0.0, tower: 0.0, shock: 0.0, fragments: 0.2, legacy: 1.0 }
];

let currentChapter = -1;
let reducedMotion = localStorage.getItem('opp_reduced_motion') === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let audioEnabled = false;
let isWebGLReady = false;
let audioContext;
let threeReady = false;

const createTimelineDots = () => {
    chapterElements.forEach((chapter, index) => {
        const dot = document.createElement('li');
        dot.setAttribute('title', chapter.dataset.title || `Chapter ${index + 1}`);
        timelineDotsContainer.appendChild(dot);
    });
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;

const applyReducedMotion = () => {
    document.body.classList.toggle('reduced-motion', reducedMotion);
    reducedMotionToggle.setAttribute('aria-pressed', String(reducedMotion));
    reducedMotionToggle.textContent = `Reduced Motion: ${reducedMotion ? 'On' : 'Off'}`;
};

const updateScrollUI = () => {
    const viewportHeight = window.innerHeight;
    const documentSpan = document.documentElement.scrollHeight - viewportHeight;
    const globalProgress = documentSpan > 0 ? clamp(window.scrollY / documentSpan, 0, 1) : 0;
    timelineProgress.style.height = `${globalProgress * 100}%`;

    const dots = [...timelineDotsContainer.children];
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    chapterElements.forEach((chapter, index) => {
        const rect = chapter.getBoundingClientRect();
        const progress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height), 0, 1);
        chapter.style.setProperty('--chapter-progress', progress.toFixed(3));
        const active = rect.top < viewportHeight * 0.54 && rect.bottom > viewportHeight * 0.42;
        chapter.classList.toggle('is-active', active);

        const centerDistance = Math.abs((rect.top + (rect.height / 2)) - (viewportHeight / 2));
        if (centerDistance < nearestDistance) {
            nearestDistance = centerDistance;
            nearest = index;
        }
    });

    if (nearest !== currentChapter) {
        currentChapter = nearest;
        dots.forEach((dot, index) => dot.classList.toggle('is-active', index === nearest));
        playAudioCue(nearest);
    }
};

const goToChapter = (targetIndex) => {
    const index = clamp(targetIndex, 0, chapterElements.length - 1);
    chapterElements[index].scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
};

window.addEventListener('keydown', (event) => {
    const key = event.key;
    if (['ArrowDown', 'PageDown', ' ', 'ArrowUp', 'PageUp', 'Home', 'End'].includes(key)) {
        event.preventDefault();
    }

    if (key === 'ArrowDown' || key === 'PageDown' || key === ' ') {
        goToChapter(currentChapter + 1);
    } else if (key === 'ArrowUp' || key === 'PageUp') {
        goToChapter(currentChapter - 1);
    } else if (key === 'Home') {
        goToChapter(0);
    } else if (key === 'End') {
        goToChapter(chapterElements.length - 1);
    }
});

reducedMotionToggle.addEventListener('click', () => {
    reducedMotion = !reducedMotion;
    localStorage.setItem('opp_reduced_motion', String(reducedMotion));
    applyReducedMotion();
});

audioToggle.addEventListener('click', async () => {
    audioEnabled = !audioEnabled;
    audioToggle.setAttribute('aria-pressed', String(audioEnabled));
    audioToggle.textContent = `Audio Cues: ${audioEnabled ? 'On' : 'Off'}`;
    if (audioEnabled && !audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
    }
});

const playAudioCue = (chapterIndex) => {
    if (!audioEnabled || !audioContext) {
        return;
    }

    const tones = [220, 246.94, 277.18, 329.63, 392, 329.63, 261.63, 220];
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const frequency = tones[chapterIndex % tones.length];

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.03, audioContext.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.24);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.25);
};

const checkWebGLSupport = () => {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch {
        return false;
    }
};

const start3D = async () => {
    if (threeReady || !isWebGLReady) {
        return;
    }

    threeReady = true;
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js');

    const container = document.getElementById('three-container');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, reducedMotion ? 1.2 : 1.8));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    const keyLight = new THREE.DirectionalLight(0xffe2bd, 1.1);
    keyLight.position.set(2, 3, 3);
    const rimLight = new THREE.DirectionalLight(0x8cb2ff, 0.8);
    rimLight.position.set(-3, 1, -2);
    scene.add(ambientLight, keyLight, rimLight);

    const atomGroup = new THREE.Group();
    const nucleus = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0x6ea9ff, emissive: 0x1b3f70, roughness: 0.35, metalness: 0.4 })
    );
    const orbit1 = new THREE.Mesh(
        new THREE.TorusGeometry(1.2, 0.018, 16, 100),
        new THREE.MeshBasicMaterial({ color: 0x9ec0ff, transparent: true, opacity: 0.7 })
    );
    orbit1.rotation.x = Math.PI / 4;
    const orbit2 = orbit1.clone();
    orbit2.rotation.y = Math.PI / 2.2;
    atomGroup.add(nucleus, orbit1, orbit2);

    const boardGroup = new THREE.Group();
    const board = new THREE.Mesh(
        new THREE.BoxGeometry(2.7, 1.6, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x203044, roughness: 0.7, metalness: 0.05 })
    );
    const boardFrame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(2.8, 1.7, 0.12)),
        new THREE.LineBasicMaterial({ color: 0x9ec0ff })
    );
    boardGroup.add(board, boardFrame);
    boardGroup.position.set(-1.4, 0.7, -0.9);
    boardGroup.rotation.y = 0.3;

    const towerGroup = new THREE.Group();
    const towerBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.2, 2.2, 16),
        new THREE.MeshStandardMaterial({ color: 0x8f7965, roughness: 0.75 })
    );
    const towerTop = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xf4b979, emissive: 0x6b3204, emissiveIntensity: 0.35 })
    );
    towerTop.position.y = 1.3;
    towerGroup.add(towerBody, towerTop);
    towerGroup.position.set(1.8, -0.5, -0.5);

    const shockwave = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.1, 18, 120),
        new THREE.MeshBasicMaterial({ color: 0xffb36b, transparent: true, opacity: 0 })
    );
    shockwave.rotation.x = Math.PI / 2;

    const fragments = new THREE.Points(
        new THREE.BufferGeometry(),
        new THREE.PointsMaterial({ color: 0xd4deef, size: 0.035, transparent: true, opacity: 0.45 })
    );
    const fragmentCount = 500;
    const fragmentPositions = new Float32Array(fragmentCount * 3);
    for (let i = 0; i < fragmentCount; i += 1) {
        fragmentPositions[i * 3] = (Math.random() - 0.5) * 8;
        fragmentPositions[(i * 3) + 1] = (Math.random() - 0.5) * 6;
        fragmentPositions[(i * 3) + 2] = (Math.random() - 0.5) * 6;
    }
    fragments.geometry.setAttribute('position', new THREE.BufferAttribute(fragmentPositions, 3));
    fragments.position.z = -1.4;

    const legacyRing = new THREE.Mesh(
        new THREE.TorusKnotGeometry(0.75, 0.12, 120, 18, 2, 3),
        new THREE.MeshStandardMaterial({ color: 0x9bb5d2, roughness: 0.45, metalness: 0.6 })
    );
    legacyRing.position.set(0, 0.2, -1.1);

    scene.add(atomGroup, boardGroup, towerGroup, shockwave, fragments, legacyRing);

    const setOpacity = (target, opacity) => {
        if (target.material) {
            target.material.transparent = true;
            target.material.opacity = clamp(opacity, 0, 1);
        }
        if (target.children) {
            target.children.forEach((child) => setOpacity(child, opacity));
        }
    };

    const tempColor = new THREE.Color();
    const tempFog = new THREE.Color();

    const animate = () => {
        const chapterProgress = clamp((window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)) * (chapterStates.length - 1), 0, chapterStates.length - 1);
        const index = Math.floor(chapterProgress);
        const t = reducedMotion ? Math.round(chapterProgress) - index : chapterProgress - index;
        const current = chapterStates[index];
        const next = chapterStates[Math.min(index + 1, chapterStates.length - 1)];

        const camX = lerp(current.camera[0], next.camera[0], t);
        const camY = lerp(current.camera[1], next.camera[1], t);
        const camZ = lerp(current.camera[2], next.camera[2], t);
        camera.position.set(camX, camY, camZ);
        camera.lookAt(0, 0.25, -0.4);

        tempColor.setRGB(
            lerp(current.color[0], next.color[0], t),
            lerp(current.color[1], next.color[1], t),
            lerp(current.color[2], next.color[2], t)
        );
        scene.background = tempColor;

        tempFog.setRGB(
            lerp(current.fog[0], next.fog[0], t),
            lerp(current.fog[1], next.fog[1], t),
            lerp(current.fog[2], next.fog[2], t)
        );
        scene.fog = new THREE.Fog(tempFog, 6, 18);

        const atomWeight = lerp(current.atom, next.atom, t);
        const boardWeight = lerp(current.board, next.board, t);
        const towerWeight = lerp(current.tower, next.tower, t);
        const shockWeight = lerp(current.shock, next.shock, t);
        const fragmentWeight = lerp(current.fragments, next.fragments, t);
        const legacyWeight = lerp(current.legacy, next.legacy, t);

        atomGroup.rotation.y += reducedMotion ? 0.0009 : 0.0042;
        atomGroup.rotation.x += reducedMotion ? 0.0003 : 0.0014;
        atomGroup.scale.setScalar(0.7 + atomWeight * 0.55);
        atomGroup.position.set(-0.9 + atomWeight * 0.5, 0.25, 0.25);
        setOpacity(atomGroup, atomWeight);

        boardGroup.position.x = -1.8 + boardWeight * 0.9;
        boardGroup.rotation.y = 0.85 - boardWeight * 0.55;
        boardGroup.scale.setScalar(0.45 + boardWeight * 0.7);
        setOpacity(boardGroup, boardWeight);

        towerGroup.position.y = -0.9 + towerWeight * 0.42;
        towerGroup.scale.setScalar(0.65 + towerWeight * 0.45);
        setOpacity(towerGroup, towerWeight);

        shockwave.scale.setScalar(0.5 + (shockWeight * 3.8));
        shockwave.position.y = -0.7 + shockWeight * 0.95;
        shockwave.material.opacity = shockWeight * 0.5;

        fragments.rotation.y += reducedMotion ? 0.0003 : 0.0015;
        fragments.rotation.x += reducedMotion ? 0.0001 : 0.0006;
        fragments.material.opacity = 0.12 + (fragmentWeight * 0.5);
        fragments.position.y = -0.3 + fragmentWeight * 0.2;

        legacyRing.rotation.x += reducedMotion ? 0.0006 : 0.002;
        legacyRing.rotation.y += reducedMotion ? 0.0008 : 0.0032;
        legacyRing.scale.setScalar(0.55 + legacyWeight * 0.75);
        setOpacity(legacyRing, legacyWeight);
        keyLight.intensity = 0.8 + (shockWeight * 0.8);
        rimLight.intensity = 0.6 + (legacyWeight * 0.6);

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    };

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, reducedMotion ? 1.1 : 1.8));
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
};

const initialize = async () => {
    createTimelineDots();
    applyReducedMotion();
    updateScrollUI();

    window.addEventListener('scroll', updateScrollUI, { passive: true });
    window.addEventListener('resize', updateScrollUI);

    isWebGLReady = checkWebGLSupport();
    if (!isWebGLReady) {
        fallbackNotice.classList.add('visible');
        return;
    }

    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
            start3D().catch(() => {
                fallbackNotice.classList.add('visible');
            });
        }, { timeout: 1800 });
    } else {
        setTimeout(() => {
            start3D().catch(() => {
                fallbackNotice.classList.add('visible');
            });
        }, 600);
    }
};

initialize();
