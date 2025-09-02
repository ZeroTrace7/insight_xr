/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Chat, Type } from '@google/genai';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TubeGeometry } from 'three/src/geometries/TubeGeometry.js';


// --- 3D Viewer Class ---
class ThreeDViewer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2();
    private activeObjects: THREE.Object3D[] = [];
    private onObjectClick: (name: string) => void = () => {};
    private lastClicked: THREE.Mesh | null = null;
    private originalColor = new THREE.Color();
    private highlightColor = new THREE.Color(0x58a6ff);

    constructor(private canvas: HTMLCanvasElement) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.init();
    }

    private init() {
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.camera.position.z = 50;
        this.controls.enableDamping = true;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 200;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 2);
        pointLight.position.set(0, 0, 0);
        this.scene.add(pointLight);

        this.canvas.addEventListener('click', this.onClick.bind(this));
        window.addEventListener('resize', this.onResize.bind(this));

        this.animate();
    }

    private animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.activeObjects.forEach(obj => {
             if(obj.userData.update) obj.userData.update();
        });
        this.renderer.render(this.scene, this.camera);
    }

    private onResize() {
        const container = this.canvas.parentElement;
        if (!container) return;
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }
    
    private onClick(event: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = this.raycaster.intersectObjects(this.activeObjects, true);

        // Reset the previously clicked object if it exists and is highlightable
        if (this.lastClicked) {
            const material = this.lastClicked.material as THREE.MeshStandardMaterial;
            if (material.emissive) {
                 material.emissive.set(this.originalColor);
            }
            this.lastClicked = null;
        }

        if (intersects.length > 0) {
            const firstIntersect = intersects[0].object;
             if (firstIntersect instanceof THREE.Mesh && firstIntersect.name) {
                
                // Highlight the new object if it's highlightable (i.e., has an emissive property)
                const material = firstIntersect.material as THREE.MeshStandardMaterial;
                if (material.emissive) {
                    this.lastClicked = firstIntersect;
                    this.originalColor.copy(material.emissive);
                    material.emissive.set(this.highlightColor);
                }
                
                // Trigger the callback with the object's name
                this.onObjectClick(firstIntersect.name);
            }
        }
    }
    
    public setOnClickCallback(callback: (name: string) => void) {
        this.onObjectClick = callback;
    }

    public cleanup() {
        while (this.scene.children.length > 0) {
            const obj = this.scene.children[0];
            this.scene.remove(obj);
             if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                // Check if material is an array before disposing
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(material => material.dispose());
                } else {
                    (obj.material as THREE.Material).dispose();
                }
            }
        }
        this.activeObjects = [];
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 2);
        pointLight.position.set(0, 0, 0);
        this.scene.add(pointLight);
    }

    public loadSolarSystem() {
        this.cleanup();
        this.camera.position.set(0, 40, 120);
        this.controls.update();

        const createPlanet = (name: string, radius: number, color: number, distance: number, speed: number) => {
            const geometry = new THREE.SphereGeometry(radius, 32, 32);
            const material = new THREE.MeshStandardMaterial({ color });
            const planet = new THREE.Mesh(geometry, material);
            planet.name = name;
            
            const pivot = new THREE.Object3D();
            this.scene.add(pivot);
            pivot.add(planet);
            
            planet.position.x = distance;

            pivot.userData.update = () => {
                pivot.rotation.y += speed * 0.01;
            };
            this.activeObjects.push(pivot);

            return planet;
        };
        
        const sunGeo = new THREE.SphereGeometry(10, 32, 32);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xfdb813 });
        const sun = new THREE.Mesh(sunGeo, sunMat);
        sun.name = "Sun";
        this.scene.add(sun);
        this.activeObjects.push(sun);

        this.activeObjects.push(createPlanet("Mercury", 2, 0x8c8c8c, 20, 4.7));
        this.activeObjects.push(createPlanet("Venus", 3, 0xd8a162, 30, 3.5));
        this.activeObjects.push(createPlanet("Earth", 3.2, 0x4f70a5, 45, 2.9));
        this.activeObjects.push(createPlanet("Mars", 2.5, 0xc1440e, 60, 2.4));
        this.activeObjects.push(createPlanet("Jupiter", 7, 0xdeaf8c, 85, 1.3));
        this.activeObjects.push(createPlanet("Saturn", 6, 0xe3d9b4, 110, 0.9));
        this.activeObjects.push(createPlanet("Uranus", 4, 0xace5ee, 135, 0.6));
        this.activeObjects.push(createPlanet("Neptune", 4, 0x3e54e8, 155, 0.5));

        this.onResize();
    }
    
    public loadDnaModel() {
        this.cleanup();
        this.camera.position.set(0, 0, 80);
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        const dnaGroup = new THREE.Object3D();
        this.scene.add(dnaGroup);

        const numBasePairs = 20;
        const pairRise = 3.4; // Vertical distance between pairs
        const helixRadius = 10;
        const turnAngle = THREE.MathUtils.degToRad(36); // 10 pairs per 360-degree turn

        const baseColors = {
            'Adenine': 0x58a6ff, // Blue
            'Thymine': 0xf778ba, // Pink/Red
            'Guanine': 0x3fb950, // Green
            'Cytosine': 0xffff66, // Yellow
        };

        const baseMaterialA = new THREE.MeshStandardMaterial({ color: baseColors['Adenine'], roughness: 0.5 });
        const baseMaterialT = new THREE.MeshStandardMaterial({ color: baseColors['Thymine'], roughness: 0.5 });
        const baseMaterialG = new THREE.MeshStandardMaterial({ color: baseColors['Guanine'], roughness: 0.5 });
        const baseMaterialC = new THREE.MeshStandardMaterial({ color: baseColors['Cytosine'], roughness: 0.5 });
        const backboneMaterial = new THREE.MeshStandardMaterial({ color: 0xc9d1d9, roughness: 0.8 }); // Light gray for backbone
        const hBondMaterial = new THREE.MeshBasicMaterial({ color: 0x8b949e, transparent: true, opacity: 0.5 });

        const baseGeometry = new THREE.SphereGeometry(1.2, 16, 16); // Using spheres instead of boxes
        const hBondGeom = new THREE.CylinderGeometry(0.1, 0.1, 5.5, 8); // Thinner bonds for a cleaner look
        
        let lastP1: THREE.Vector3 | null = null;
        let lastP2: THREE.Vector3 | null = null;

        for (let i = 0; i < numBasePairs; i++) {
            const y = (i - numBasePairs / 2) * pairRise;
            const angle = i * turnAngle;
            
            const pairGroup = new THREE.Group();

            // Create Bases
            const isAT = Math.random() > 0.5;
            const base1 = new THREE.Mesh(baseGeometry, isAT ? baseMaterialA : baseMaterialG);
            const base2 = new THREE.Mesh(baseGeometry, isAT ? baseMaterialT : baseMaterialC);

            base1.name = isAT ? "Adenine" : "Guanine";
            base2.name = isAT ? "Thymine" : "Cytosine";
            
            base1.position.x = -2.75;
            base2.position.x = 2.75;
            
            pairGroup.add(base1);
            pairGroup.add(base2);
            this.activeObjects.push(base1, base2); // Make bases clickable
            
            // Hydrogen Bonds (2 for A-T, 3 for G-C)
            const numBonds = isAT ? 2 : 3;
            const bondSpacing = 0.6; 
            for (let j = 0; j < numBonds; j++) {
                const hBond = new THREE.Mesh(hBondGeom, hBondMaterial);
                hBond.rotation.z = Math.PI / 2;
                // Position bonds along the z-axis
                hBond.position.z = (j - (numBonds - 1) / 2) * bondSpacing;
                pairGroup.add(hBond);
            }

            pairGroup.position.y = y;
            pairGroup.rotation.y = angle;
            dnaGroup.add(pairGroup);

            // Create Backbone points
            const p1_pos = new THREE.Vector3(helixRadius, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(new THREE.Vector3(0, y, 0));
            const p2_pos = new THREE.Vector3(-helixRadius, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(new THREE.Vector3(0, y, 0));

            // Connect backbone with tubes
            if (lastP1 && lastP2) {
                const curve1 = new THREE.CatmullRomCurve3([lastP1, p1_pos]);
                const curve2 = new THREE.CatmullRomCurve3([lastP2, p2_pos]);
                const tubeGeom1 = new TubeGeometry(curve1, 2, 0.4, 8, false);
                const tubeGeom2 = new TubeGeometry(curve2, 2, 0.4, 8, false);
                const strand1 = new THREE.Mesh(tubeGeom1, backboneMaterial);
                const strand2 = new THREE.Mesh(tubeGeom2, backboneMaterial);
                dnaGroup.add(strand1, strand2);
            }
            
            lastP1 = p1_pos;
            lastP2 = p2_pos;
        }
        
        // Auto-rotation
        dnaGroup.userData.update = () => {
            dnaGroup.rotation.y += 0.005;
        };
        this.activeObjects.push(dnaGroup);
        
        this.onResize();
    }
    
    public loadNeonAtomModel() {
        this.cleanup();
        this.camera.position.set(0, 15, 50);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    
        const atomGroup = new THREE.Object3D();
        this.scene.add(atomGroup);
        this.activeObjects.push(atomGroup);
    
        // Nucleus
        const nucleusGeo = new THREE.SphereGeometry(2.5, 32, 32);
        const nucleusMat = new THREE.MeshStandardMaterial({ color: 0xcc6666, roughness: 0.4 });
        const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
        nucleus.name = "Neon Nucleus";
        atomGroup.add(nucleus);
        this.activeObjects.push(nucleus);
    
        // Helper to create an electron and its visible orbital ring
        const createElectronAndRing = (radius: number, name: string, speed: number, eulerRotation: THREE.Euler, startAngle: number = 0) => {
            const electronGeo = new THREE.SphereGeometry(0.6, 16, 16);
            const electronMat = new THREE.MeshStandardMaterial({
                color: 0x58a6ff,
                emissive: 0x58a6ff,
                emissiveIntensity: 0.3
            });
            const electron = new THREE.Mesh(electronGeo, electronMat);
            electron.name = name;
            electron.position.x = radius;
    
            const ringGeo = new THREE.TorusGeometry(radius, 0.05, 16, 100);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xa371f7,
                transparent: true,
                opacity: 0.3
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            
            // The pivot group rotates the electron around the origin
            const pivot = new THREE.Group();
            pivot.add(electron);
            
            // The orbitGroup holds the static ring and the rotating pivot, and sets the plane of orbit
            const orbitGroup = new THREE.Group();
            orbitGroup.add(pivot);
            orbitGroup.add(ring);
            orbitGroup.rotation.copy(eulerRotation);
            
            pivot.rotation.y = startAngle; // Set initial position on the ring
    
            orbitGroup.userData.update = () => {
                pivot.rotation.y += speed * 0.01;
            };
    
            atomGroup.add(orbitGroup);
            this.activeObjects.push(electron, orbitGroup);
        };
    
        // --- Create Electrons based on Neon's configuration (1s², 2s², 2p⁶) ---
        const sOrbitalSpeed = 1.2;
        const pOrbitalSpeed = 1.0;
    
        // 1s Orbital (2 electrons) - represented as two different orbital planes for visual clarity
        createElectronAndRing(8, "1s Electron", sOrbitalSpeed, new THREE.Euler(0, 0, 0), Math.random() * Math.PI * 2);
        createElectronAndRing(8, "1s Electron", sOrbitalSpeed, new THREE.Euler(Math.PI / 2, Math.PI / 3, 0), Math.random() * Math.PI * 2);
    
        // 2s Orbital (2 electrons) - further out, also visually separated
        createElectronAndRing(16, "2s Electron", sOrbitalSpeed * 0.8, new THREE.Euler(0, Math.PI / 2, Math.PI / 4), Math.random() * Math.PI * 2);
        createElectronAndRing(16, "2s Electron", sOrbitalSpeed * 0.8, new THREE.Euler(0, -Math.PI / 2, -Math.PI / 4), Math.random() * Math.PI * 2);
    
        // 2p Orbitals (6 electrons, 2 in each of 3 orthogonal p-orbitals)
        const pz_rot = new THREE.Euler(0, 0, 0); // XY plane
        const px_rot = new THREE.Euler(0, Math.PI / 2, 0); // YZ plane
        const py_rot = new THREE.Euler(Math.PI / 2, 0, 0); // XZ plane
        
        // 2 electrons in pz orbital (opposite each other)
        createElectronAndRing(16, "2p Electron", pOrbitalSpeed, pz_rot, 0);
        createElectronAndRing(16, "2p Electron", pOrbitalSpeed, pz_rot, Math.PI);
        // 2 electrons in px orbital (opposite each other)
        createElectronAndRing(16, "2p Electron", pOrbitalSpeed, px_rot, 0);
        createElectronAndRing(16, "2p Electron", pOrbitalSpeed, px_rot, Math.PI);
        // 2 electrons in py orbital (opposite each other)
        createElectronAndRing(16, "2p Electron", pOrbitalSpeed, py_rot, 0);
        createElectronAndRing(16, "2p Electron", pOrbitalSpeed, py_rot, Math.PI);
        
        // Auto-rotation for the whole atom for a better view
        atomGroup.userData.update = () => {
            atomGroup.rotation.y += 0.001;
            atomGroup.rotation.x += 0.0005;
        };
        
        this.onResize();
    }

    public loadPlaceholder(modelName: string) {
        this.cleanup();
        // A placeholder for DNA / Atom models
    }
}


// --- DOM Element Selection ---

// App Containers
const authPage = document.getElementById('auth-page') as HTMLDivElement;
const mainContent = document.querySelector('.main-content') as HTMLElement;
const bottomNav = document.querySelector('.bottom-nav') as HTMLElement;

// Auth Page
const authForm = document.getElementById('auth-form') as HTMLFormElement;
const authEmailInput = document.getElementById('auth-email') as HTMLInputElement;
const authPasswordInput = document.getElementById('auth-password') as HTMLInputElement;
const authSubmitButton = document.getElementById('auth-submit-button') as HTMLButtonElement;
const authModeToggle = document.getElementById('auth-mode-toggle') as HTMLSpanElement;
const authToggleText = document.getElementById('auth-toggle-text') as HTMLSpanElement;
const authError = document.getElementById('auth-error') as HTMLParagraphElement;
const authTitle = document.getElementById('auth-title') as HTMLHeadingElement;
const authSubtitle = document.getElementById('auth-subtitle') as HTMLParagraphElement;
const authVisualTitle = document.querySelector('.auth-visual > h1') as HTMLHeadingElement;
const authVisualSubtitle = document.querySelector('.auth-visual > p') as HTMLParagraphElement;
const signOutButton = document.getElementById('sign-out-button') as HTMLButtonElement;

// Page Navigation
const pages = document.querySelectorAll('.page');
const navButtons = {
    home: document.getElementById('nav-home') as HTMLButtonElement,
    simulations: document.getElementById('nav-simulations') as HTMLButtonElement,
    dashboard: document.getElementById('nav-dashboard') as HTMLButtonElement,
    profile: document.getElementById('nav-profile') as HTMLButtonElement,
};
const welcomeHeader = document.getElementById('welcome-header') as HTMLHeadingElement;
const profileName = document.getElementById('profile-name') as HTMLHeadingElement;
const profileEmail = document.getElementById('profile-email') as HTMLParagraphElement;


// Quick Actions
const reviewActionCard = document.getElementById('review-action-card') as HTMLDivElement;
const quizActionCard = document.getElementById('quiz-action-card') as HTMLDivElement;


// Home Page Module Cards
const emModuleCard = document.getElementById('em-module-card');
const ohmsLawModuleCard = document.getElementById('ohms-law-module-card');
const atomicOrbitalsModuleCard = document.getElementById('atomic-orbitals-module-card');
const dnaModuleCard = document.getElementById('dna-module-card');
const solarSystemModuleCard = document.getElementById('solar-system-module-card');

// Detail Page
const detailPage = document.getElementById('detail-page');
const detailTitle = document.getElementById('detail-title');
const detailImage = document.getElementById('detail-image');
const detailDescription = document.getElementById('detail-description');

// Simulation Tab Navigation
const navOhmsLaw = document.getElementById('nav-ohms-law');
const navEmWave = document.getElementById('nav-em-wave');
const nav3dViewer = document.getElementById('nav-3d-viewer');
const ohmsLawPanel = document.getElementById('ohms-law-panel');
const emWavePanel = document.getElementById('em-wave-panel');
const viewerPanel = document.getElementById('3d-viewer-panel');
const viewerTitle = document.getElementById('simulation-title-3d');
const viewerInfo = document.getElementById('3d-viewer-info');


// Ohm's Law Simulation
const voltageSlider = document.getElementById('voltage-slider') as HTMLInputElement;
const resistanceSlider = document.getElementById('resistance-slider') as HTMLInputElement;
const voltageValueSpan = document.getElementById('voltage-value');
const resistanceValueSpan = document.getElementById('resistance-value');
const currentValueSpan = document.getElementById('current-value');
const bulbGlow = document.getElementById('bulb-glow');

// EM Wave Simulation
const frequencySlider = document.getElementById('frequency-slider') as HTMLInputElement;
const amplitudeSlider = document.getElementById('amplitude-slider') as HTMLInputElement;
const frequencyValueSpan = document.getElementById('frequency-value');
const amplitudeValueSpan = document.getElementById('amplitude-value');
const wavelengthValueSpan = document.getElementById('wavelength-value');
const electricFieldPath = document.getElementById('electric-field-path') as unknown as SVGPathElement;
const magneticFieldPath = document.getElementById('magnetic-field-path') as unknown as SVGPathElement;

// 3D Viewer
const canvas = document.getElementById('3d-canvas') as HTMLCanvasElement;
const loader = document.getElementById('3d-loader');
let threeDViewer: ThreeDViewer;

// Chat
const chatForm = document.getElementById('chat-form') as HTMLFormElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const chatSubmitButton = document.getElementById('chat-submit-button') as HTMLButtonElement;
const chatHistory = document.getElementById('chat-history');

// Quiz
const quizPage = document.getElementById('quiz-page');
const quizCard = document.getElementById('quiz-card');
const quizQuestionContainer = document.getElementById('quiz-question-container');
const quizQuestion = document.getElementById('quiz-question');
const quizOptions = document.getElementById('quiz-options');
const quizSubmitButton = document.getElementById('quiz-submit-button') as HTMLButtonElement;
const quizResults = document.getElementById('quiz-results');
const quizScore = document.getElementById('quiz-score');
const quizReturnHomeButton = document.getElementById('quiz-return-home-button') as HTMLButtonElement;
const quizProgress = document.getElementById('quiz-progress');

// Review Page
const reviewPage = document.getElementById('review-page');
const reviewContentContainer = document.getElementById('review-content-container');
const reviewTopicTitle = document.getElementById('review-topic-title');
const reviewSummaryLoader = document.getElementById('review-summary-loader');
const reviewSummary = document.getElementById('review-summary');
const reviewStartQuizButton = document.getElementById('review-start-quiz-button') as HTMLButtonElement;
const reviewQuizContainer = document.getElementById('review-quiz-container');
const reviewQuizActive = document.getElementById('review-quiz-active');
const reviewQuizQuestion = document.getElementById('review-quiz-question');
const reviewQuizOptions = document.getElementById('review-quiz-options');
const reviewQuizSubmitButton = document.getElementById('review-quiz-submit-button') as HTMLButtonElement;
const reviewQuizResults = document.getElementById('review-quiz-results');
const reviewQuizFeedback = document.getElementById('review-quiz-feedback');
const reviewNextButton = document.getElementById('review-next-button') as HTMLButtonElement;
const reviewReturnHomeButton = document.getElementById('review-return-home-button') as HTMLButtonElement;


// --- State and Constants ---
let chat: Chat;
let ai: GoogleGenAI;
let authMode: 'login' | 'signup' = 'login';
type ModuleKey = 'ohms' | 'em' | 'atomic' | 'dna' | 'solar';
type PageName = 'home' | 'simulations' | 'dashboard' | 'profile' | 'detail' | 'quiz' | 'auth' | 'review';
type TabKey = 'ohms' | 'em' | '3d';

type ModelType = 'atomic' | 'dna' | 'solar';

interface BaseModuleData {
    title: string;
    description: string;
    image: string;
}

interface SimModuleData extends BaseModuleData {
    targetTab: 'ohms' | 'em';
}

interface ThreeDModuleData extends BaseModuleData {
    targetTab: '3d';
    modelType: ModelType;
}

type ModuleDataConfig = SimModuleData | ThreeDModuleData;

const moduleData: Record<ModuleKey, ModuleDataConfig> = {
    'ohms': {
        title: "Ohm's Law",
        description: "This simulation demonstrates the relationship between voltage (V), current (I), and resistance (R) in a simple electrical circuit. Adjust the sliders to see how changing voltage and resistance affects the current and the brightness of the lightbulb.",
        image: "url('https://images.unsplash.com/photo-1589578236836-69a452178224?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wzOT二次A3fDB8MXxzZWFyY2h8Mnx8Y2lyY3VpdCUyMGJvYXJkfGVufDB8fHx8MTcxNjQxOTU3N3ww&ixlib=rb-4.0.3&q=80&w=1080')",
        targetTab: 'ohms'
    },
    'em': {
        title: "Electromagnetic Waves",
        description: "Visualize how an electromagnetic wave propagates. This simulation shows the electric field (E) and magnetic field (B) oscillating perpendicular to each other and to the direction of wave travel. Adjust frequency and amplitude to see how the wave changes.",
        image: "url('https://images.unsplash.com/photo-1614270279895-a22835c17cb0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wzOT二次A3fDB8MXxzZWFyY2h8NHx8YWJzdHJhY3QlMjBlbGVjdHJvbWFnbmV0aWN8ZW58MHx8fHwxNzE2NDAwODgzfDA&ixlib=rb-4.0.3&q=80&w=1080')",
        targetTab: 'em'
    },
    'atomic': {
        title: "Neon Atom Model",
        description: "Explore an interactive 3D model of a Neon atom. See its 10 electrons orbiting the nucleus in their respective 1s, 2s, and 2p orbitals. Click on any component to learn more about it from the AI assistant.",
        image: "url('https://images.unsplash.com/photo-1599991901213-9152a58d6335?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wzOT二次A3fDB8MXxzZWFyY2h8N3x8YWJzdHJhY3QlMjBhdG9tfGVufDB8fHx8MTcxNjQxOTY0N3ww&ixlib=rb-4.0.3&q=80&w=1080')",
        targetTab: '3d',
        modelType: 'atomic'
    },
     'dna': {
        title: "DNA Replication",
        description: "Explore an interactive 3D model of a DNA double helix. Zoom, pan, and rotate to see the molecule's structure. Click on the colored bases (A, T, C, G) to learn more about them from the AI assistant.",
        image: "url('https://images.unsplash.com/photo-1532187643623-dbf26353d395?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wzOT二次A3fDB8MXxzZWFyY2h8Nnx8Z2VuZXRpY3N8ZW58MHx8fHwxNzE2NDAwOTQ6fDA&ixlib=rb-4.0.3&q=80&w=1080')",
        targetTab: '3d',
        modelType: 'dna'
    },
    'solar': {
        title: "Solar System",
        description: "Explore an interactive 3D model of our solar system. Zoom, pan, and rotate to see the planets. Click on a planet or the sun to learn more about it from the AI assistant.",
        image: "url('https://images.unsplash.com/photo-1614726353902-75c60a58a743?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wzOT二次A3fDB8MXxzZWFyY2h8Mnx8c29sYXIlMjBzeXN0ZW18ZW58MHx8fHwxNzE2OTU4NTMxfDA&ixlib=rb-4.0.3&q=80&w=1080')",
        targetTab: '3d',
        modelType: 'solar'
    }
};

const quizQuestions = [
    {
        question: "What does DNA stand for?",
        options: ["Deoxyribonucleic Acid", "Deoxyribonuclear Acid", "Denatured Ribonucleic Acid", "Double Nucleic Acid"],
        correctAnswer: 0
    },
    {
        question: "Which of the following is NOT one of the four nitrogenous bases in DNA?",
        options: ["Adenine", "Guanine", "Cytosine", "Uracil"],
        correctAnswer: 3
    },
    {
        question: "In the DNA double helix, Adenine (A) always pairs with...",
        options: ["Guanine (G)", "Cytosine (C)", "Thymine (T)", "Adenine (A)"],
        correctAnswer: 2
    },
    {
        question: "What is the primary function of the enzyme DNA Polymerase?",
        options: ["Unzipping the DNA strands", "Synthesizing new DNA strands", "Correcting errors in the DNA sequence", "Connecting DNA fragments"],
        correctAnswer: 1
    },
    {
        question: "The 'backbone' of the DNA molecule is made of what two components?",
        options: ["Sugars and Bases", "Phosphates and Bases", "Sugars and Phosphates", "Proteins and Sugars"],
        correctAnswer: 2
    }
];

let currentQuestionIndex = 0;
let score = 0;
let reviewTopic = '';
let reviewCorrectAnswerIndex: number | null = null;


// --- Initialization ---
function initializeApp() {
    // Check for critical elements
    if (!voltageSlider || !resistanceSlider || !chatForm || !frequencySlider || !amplitudeSlider || !canvas || !reviewActionCard) {
        handleFatalError("A critical UI element is missing. The application cannot start.");
        return;
    }
    
    // Check authentication status first
    checkAuthStatus();

    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: `You are a friendly and encouraging AI tutor specializing in physics, chemistry, and astronomy for school students. 
                Your goal is to explain complex concepts like Ohm's Law, circuits, electromagnetic waves, atomic orbitals, DNA replication, and our solar system in a simple, intuitive, and engaging way. 
                When asked about a celestial body like the Sun or a planet, provide a concise, interesting fact or a short paragraph about it.
                When asked about a DNA base (Adenine, Thymine, Guanine, Cytosine), explain what it is and what it pairs with.
                When asked about the parts of a Neon atom, explain their role. For the Neon Nucleus, mention it contains 10 protons and 10 neutrons. For electrons, describe them as negatively charged particles occupying specific energy levels or orbitals. Differentiate between the 1s, 2s, and 2p electrons based on their energy level and proximity to the nucleus.
                Use analogies and real-world examples. Keep your explanations concise and clear. Do not use markdown.`,
            },
        });
    } catch (error) {
        console.error(error);
        handleFatalError("Failed to initialize the AI. Please check the API key and configuration.");
        return;
    }

    // Set initial simulation states
    updateOhmSimulation();
    updateEMWaveSimulation();
    
    // Init 3D Viewer
    threeDViewer = new ThreeDViewer(canvas);
    threeDViewer.setOnClickCallback(onObjectSelected);


    // --- Event Listeners ---
    
    // Auth
    authForm.addEventListener('submit', handleAuthSubmit);
    authModeToggle.addEventListener('click', toggleAuthMode);
    signOutButton.addEventListener('click', handleSignOut);

    // Main App Navigation
    navButtons.home.addEventListener('click', () => navigateTo('home'));
    navButtons.simulations.addEventListener('click', () => navigateTo('simulations'));
    navButtons.dashboard.addEventListener('click', () => navigateTo('dashboard'));
    navButtons.profile.addEventListener('click', () => navigateTo('profile'));

    // Quick Actions
    reviewActionCard.addEventListener('click', startReviewSession);
    quizActionCard.addEventListener('click', startQuiz);

    // Home Page Module Links
    ohmsLawModuleCard.addEventListener('click', () => showDetailPage('ohms'));
    emModuleCard.addEventListener('click', () => showDetailPage('em'));
    atomicOrbitalsModuleCard.addEventListener('click', () => showDetailPage('atomic'));
    dnaModuleCard.addEventListener('click', () => showDetailPage('dna'));
    solarSystemModuleCard.addEventListener('click', () => showDetailPage('solar'));


    // Simulation Controls
    voltageSlider.addEventListener('input', updateOhmSimulation);
    resistanceSlider.addEventListener('input', updateOhmSimulation);
    frequencySlider.addEventListener('input', updateEMWaveSimulation);
    amplitudeSlider.addEventListener('input', updateEMWaveSimulation);

    // Simulation Tabs
    navOhmsLaw.addEventListener('click', () => switchTab('ohms'));
    navEmWave.addEventListener('click', () => switchTab('em'));
    nav3dViewer.addEventListener('click', () => switchTab('3d'));

    // Chat
    chatForm.addEventListener('submit', handleChatSubmit);
    
    // Quiz
    quizSubmitButton.addEventListener('click', handleQuizSubmit);
    quizReturnHomeButton.addEventListener('click', () => navigateTo('home'));

    // Review Session
    reviewStartQuizButton.addEventListener('click', handleReviewQuizStart);
    reviewQuizSubmitButton.addEventListener('click', handleReviewQuizSubmit);
    reviewNextButton.addEventListener('click', generateReviewQuestion);
    reviewReturnHomeButton.addEventListener('click', () => navigateTo('home'));

}

// --- Auth Logic ---
function checkAuthStatus() {
    const userString = localStorage.getItem('currentUser');
    if (userString) {
        const user = JSON.parse(userString);
        showApp(user);
    } else {
        showAuthPage();
    }
}

function showApp(user) {
    authPage.style.display = 'none';
    mainContent.style.display = 'block';
    bottomNav.style.display = 'flex';
    
    // Personalize UI
    const name = user.name || user.email.split('@')[0];
    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
    
    welcomeHeader.textContent = `Good morning, ${capitalizedName}!`;
    profileName.textContent = capitalizedName;
    profileEmail.textContent = user.email;

    navigateTo('home');
}

function showAuthPage() {
    authPage.style.display = 'flex';
    authPage.classList.add('active');
    mainContent.style.display = 'none';
    bottomNav.style.display = 'none';
    
    // Hide other pages
    pages.forEach(page => page.classList.remove('active'));
    updateAuthUI();
}

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'signup' : 'login';
    const authCard = document.querySelector('.auth-card');
    if (authCard) {
        authCard.classList.remove('form-fade-in');
        void authCard.clientWidth; // Trigger reflow to restart animation
        authCard.classList.add('form-fade-in');
    }
    updateAuthUI();
}

function updateAuthUI() {
    authError.textContent = '';
    if (authMode === 'login') {
        authTitle.textContent = 'Sign In';
        authSubtitle.textContent = 'to continue to Insight XR';
        authSubmitButton.textContent = 'Sign In';
        authToggleText.textContent = "Don't have an account?";
        authModeToggle.textContent = 'Sign Up';
        if(authVisualTitle) authVisualTitle.textContent = 'Welcome Back!';
        if(authVisualSubtitle) authVisualSubtitle.textContent = 'Sign in to continue your journey through the wonders of science.';

    } else {
        authTitle.textContent = 'Create Account';
        authSubtitle.textContent = 'to get started with Insight XR';
        authSubmitButton.textContent = 'Create Account';
        authToggleText.textContent = 'Already have an account?';
        authModeToggle.textContent = 'Sign In';
        if(authVisualTitle) authVisualTitle.textContent = 'Join the Adventure!';
        if(authVisualSubtitle) authVisualSubtitle.textContent = 'Create your account to unlock interactive simulations and personalized learning.';
    }
}

function handleAuthSubmit(e: Event) {
    e.preventDefault();
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;

    if (!email || !password) {
        authError.textContent = 'Please enter both email and password.';
        return;
    }
    
    if (authMode === 'login') {
        // --- NOTE: This is a simplified, insecure login for prototype purposes. ---
        // --- In a real application, passwords should be hashed and validated on a server. ---
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const user = users.find(u => u.email === email);

        if (user && user.password === password) {
            localStorage.setItem('currentUser', JSON.stringify(user));
            checkAuthStatus();
        } else {
            authError.textContent = 'Invalid email or password.';
        }
    } else { // Signup
        if (password.length < 6) {
            authError.textContent = 'Password must be at least 6 characters.';
            return;
        }
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        if (users.some(u => u.email === email)) {
            authError.textContent = 'An account with this email already exists.';
            return;
        }
        const newUser = { email, password };
        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        checkAuthStatus();
    }
}

function handleSignOut() {
    localStorage.removeItem('currentUser');
    authMode = 'login'; // Reset to login mode
    showAuthPage();
}


// --- Main Page Navigation ---
function navigateTo(pageName: PageName) {
    if (pageName === 'auth') {
        showAuthPage();
        return;
    }
    pages.forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) targetPage.classList.add('active');
    
    Object.values(navButtons).forEach(button => button.classList.remove('active'));
    if (navButtons[pageName]) {
        navButtons[pageName].classList.add('active');
    } else if (pageName === 'detail' || pageName === 'quiz' || pageName === 'review') {
        // Keep home active when on sub-pages
        navButtons.home.classList.add('active');
    }
}

// --- Detail Page Logic ---
function showDetailPage(moduleKey: ModuleKey) {
    const data = moduleData[moduleKey];
    if (!data) return;

    detailTitle.textContent = data.title;
    detailDescription.textContent = data.description;
    detailImage.style.backgroundImage = data.image;

    const detailStartButton = document.getElementById('detail-start-button');
    if (!detailStartButton || !detailStartButton.parentNode) return;

    const newButton = detailStartButton.cloneNode(true) as HTMLButtonElement;
    detailStartButton.parentNode.replaceChild(newButton, detailStartButton);
    
    newButton.addEventListener('click', () => {
        navigateTo('simulations');
        switchTab(data.targetTab);
        if (data.targetTab === '3d') {
            load3DModel((data as ThreeDModuleData).modelType, data.title);
        }
    });

    navigateTo('detail');
}

// --- Simulation Tab Navigation ---
function switchTab(tab: TabKey) {
    const tabMap = {
        'ohms': { nav: navOhmsLaw, panel: ohmsLawPanel, text: "Ask about Ohm's Law..." },
        'em': { nav: navEmWave, panel: emWavePanel, text: "Ask about EM waves..." },
        '3d': { nav: nav3dViewer, panel: viewerPanel, text: "Ask about the 3D model..." }
    };

    Object.keys(tabMap).forEach(key => {
        const isTarget = key === tab;
        const currentElements = tabMap[key as TabKey];

        currentElements.nav?.classList.toggle('active', isTarget);
        currentElements.nav?.setAttribute('aria-pressed', isTarget.toString());
        currentElements.panel?.classList.toggle('active', isTarget);
    });

    chatInput.placeholder = tabMap[tab].text;
}


// --- 3D Model Loading ---
function load3DModel(modelType: string, title: string) {
    if (!threeDViewer || !loader) return;
    
    viewerTitle.textContent = title;
    loader.classList.add('active');

    // Give the browser a moment to render the loader before blocking the thread
    setTimeout(() => {
        switch (modelType) {
            case 'solar':
                threeDViewer.loadSolarSystem();
                viewerInfo.textContent = 'Click on a celestial body to learn about it.';
                break;
            case 'dna':
                threeDViewer.loadDnaModel();
                viewerInfo.textContent = 'Click on a colored base to learn more about it.';
                break;
            case 'atomic':
                 threeDViewer.loadNeonAtomModel();
                 viewerInfo.textContent = `Click on any component of the Neon atom to learn more.`;
                break;
        }
        loader.classList.remove('active');
    }, 200);
}

// --- Simulation Logic ---

// Ohm's Law
function updateOhmSimulation() {
    const voltage = parseFloat(voltageSlider.value);
    const resistance = parseFloat(resistanceSlider.value);
    const current = resistance > 0 ? voltage / resistance : 0;

    voltageValueSpan.textContent = voltage.toFixed(1);
    resistanceValueSpan.textContent = resistance.toFixed(0);
    currentValueSpan.textContent = current.toFixed(2);
    
    updateBulbVisuals(current);
}

function updateBulbVisuals(current: number) {
    if (!bulbGlow) return;
    const maxVisualCurrent = 5;
    const brightness = Math.min(current / maxVisualCurrent, 1);
    const glowOpacity = brightness;
    const glowRadius = 5 + brightness * 20;

    bulbGlow.style.fill = `rgba(255, 221, 0, ${glowOpacity})`;
    bulbGlow.style.filter = `blur(${glowRadius}px)`;
}

// Electromagnetic Waves
function updateEMWaveSimulation() {
    const frequency = parseFloat(frequencySlider.value);
    const amplitude = parseFloat(amplitudeSlider.value);

    frequencyValueSpan.textContent = frequency.toFixed(0);
    amplitudeValueSpan.textContent = amplitude.toFixed(0);
    const wavelength = 20 / frequency; 
    wavelengthValueSpan.textContent = wavelength.toFixed(1);

    drawWaves(frequency, amplitude);
}

function drawWaves(frequency: number, amplitude: number) {
    if (!electricFieldPath || !magneticFieldPath) return;

    const width = 400;
    const height = 200;
    const centerY = height / 2;
    const waveLength = width - 40;
    const steps = 200;

    let ePath = `M 20 ${centerY}`;
    let bPath = `M 20 ${centerY}`;

    for (let i = 0; i <= steps; i++) {
        const x = 20 + (i / steps) * waveLength;
        const angle = (i / steps) * (frequency / 2) * Math.PI * 2;
        
        const yE = centerY - Math.sin(angle) * amplitude;
        ePath += ` L ${x} ${yE}`;

        const yB = centerY - Math.cos(angle) * (amplitude * 0.5);
        const xB = x + Math.cos(angle) * 10;
        bPath += ` L ${xB} ${yB}`;
    }

    electricFieldPath.setAttribute('d', ePath);
    magneticFieldPath.setAttribute('d', bPath);
}

// --- Quiz Logic ---
function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    navigateTo('quiz');
    quizResults.classList.add('hidden');
    quizQuestionContainer.classList.remove('hidden');
    quizSubmitButton.classList.remove('hidden');
    displayQuestion();
}

function displayQuestion() {
    const currentQuestion = quizQuestions[currentQuestionIndex];
    quizQuestion.textContent = currentQuestion.question;
    quizProgress.textContent = `Question ${currentQuestionIndex + 1} of ${quizQuestions.length}`;
    quizOptions.innerHTML = '';

    currentQuestion.options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.classList.add('quiz-option');
        optionElement.innerHTML = `
            <input type="radio" id="option${index}" name="quiz-option" value="${index}">
            <label for="option${index}">${option}</label>
        `;
        quizOptions.appendChild(optionElement);
    });
    
    if (currentQuestionIndex === quizQuestions.length - 1) {
        quizSubmitButton.textContent = "Submit Quiz";
    } else {
        quizSubmitButton.textContent = "Next Question";
    }
}

function handleQuizSubmit() {
    const selectedOption = quizOptions.querySelector('input[name="quiz-option"]:checked') as HTMLInputElement;
    if (!selectedOption) {
        alert("Please select an answer.");
        return;
    }

    const selectedAnswer = parseInt(selectedOption.value);
    if (selectedAnswer === quizQuestions[currentQuestionIndex].correctAnswer) {
        score++;
    }

    currentQuestionIndex++;
    if (currentQuestionIndex < quizQuestions.length) {
        displayQuestion();
    } else {
        showQuizResults();
    }
}

function showQuizResults() {
    quizQuestionContainer.classList.add('hidden');
    quizSubmitButton.classList.add('hidden');
    quizResults.classList.remove('hidden');
    quizScore.textContent = `You scored ${score} out of ${quizQuestions.length}!`;
}

// --- Review Session Logic ---
function startReviewSession() {
    navigateTo('review');
    reviewContentContainer.classList.remove('hidden');
    reviewQuizContainer.classList.add('hidden');
    reviewSummary.textContent = '';
    reviewStartQuizButton.classList.add('hidden');
    reviewSummaryLoader.classList.add('active');
    generateReviewContent();
}

async function generateReviewContent() {
    try {
        const topics = ["DNA Base Pairing", "Ohm's Law", "Electron Shells in a Neon Atom", "Electromagnetic Waves"];
        reviewTopic = topics[Math.floor(Math.random() * topics.length)];
        reviewTopicTitle.textContent = `Reviewing: ${reviewTopic}`;

        const response = await chat.sendMessage({ message: `Explain the concept of '${reviewTopic}' in one simple paragraph for a high school student. Focus on the core idea.` });
        reviewSummary.textContent = response.text;

    } catch (error) {
        console.error("Failed to generate review content:", error);
        reviewSummary.textContent = "Sorry, I couldn't load the review content. Please try again later.";
    } finally {
        reviewSummaryLoader.classList.remove('active');
        reviewStartQuizButton.classList.remove('hidden');
    }
}

function handleReviewQuizStart() {
    reviewContentContainer.classList.add('hidden');
    reviewQuizContainer.classList.remove('hidden');
    generateReviewQuestion();
}

async function generateReviewQuestion() {
    reviewQuizActive.classList.remove('hidden');
    reviewQuizResults.classList.add('hidden');
    reviewQuizOptions.innerHTML = '';
    reviewQuizQuestion.textContent = 'Generating a new question...';
    reviewQuizSubmitButton.disabled = true;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a single multiple-choice quiz question about "${reviewTopic}". The question should test a key aspect of the concept. Provide four plausible options.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        question: { type: Type.STRING, description: "The question text." },
                        options: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "An array of four possible answers."
                        },
                        correctAnswerIndex: { type: Type.INTEGER, description: "The 0-based index of the correct answer in the options array." }
                    },
                    required: ["question", "options", "correctAnswerIndex"]
                },
            },
        });

        const quizData = JSON.parse(response.text);

        if (quizData.options.length < 2) { // Ensure there are at least 2 options
             throw new Error("AI did not return enough options.");
        }

        reviewQuizQuestion.textContent = quizData.question;
        reviewCorrectAnswerIndex = quizData.correctAnswerIndex;

        quizData.options.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.classList.add('quiz-option');
            optionElement.innerHTML = `
                <input type="radio" id="review-option${index}" name="review-quiz-option" value="${index}">
                <label for="review-option${index}">${option}</label>
            `;
            reviewQuizOptions.appendChild(optionElement);
        });

    } catch (error) {
        console.error("Failed to generate review question:", error);
        reviewQuizQuestion.textContent = "Sorry, I couldn't generate a question. Please try again.";
    } finally {
        reviewQuizSubmitButton.disabled = false;
    }
}

function handleReviewQuizSubmit() {
    const selectedOption = reviewQuizOptions.querySelector('input[name="review-quiz-option"]:checked') as HTMLInputElement;
    if (!selectedOption) {
        alert("Please select an answer.");
        return;
    }

    const selectedAnswer = parseInt(selectedOption.value);
    
    reviewQuizFeedback.classList.remove('correct', 'incorrect');

    if (selectedAnswer === reviewCorrectAnswerIndex) {
        reviewQuizFeedback.textContent = "Correct! Great job.";
        reviewQuizFeedback.classList.add('correct');
    } else {
        const correctOptionLabel = reviewQuizOptions.querySelector(`label[for="review-option${reviewCorrectAnswerIndex}"]`);
        const correctAnswerText = correctOptionLabel ? correctOptionLabel.textContent : 'the correct answer';
        reviewQuizFeedback.textContent = `Not quite. The correct answer was: "${correctAnswerText}"`;
        reviewQuizFeedback.classList.add('incorrect');
    }

    reviewQuizActive.classList.add('hidden');
    reviewQuizResults.classList.remove('hidden');
}


// --- Chat & AI Logic ---
function onObjectSelected(name: string) {
    if (!name) return;
    addMessageToHistory(`You clicked on ${name}.`, 'user');
    askAI(`Tell me about ${name}.`);
}


async function askAI(prompt: string) {
    setChatLoading(true);
    try {
        const response = await chat.sendMessage({ message: prompt });
        const aiResponse = response.text;
        
        const aiMessageElement = addMessageToHistory('', 'ai');
        const aiParagraph = aiMessageElement.querySelector('.message p') as HTMLParagraphElement;

        if (aiParagraph) {
            aiParagraph.textContent = aiResponse;
        }
        chatHistory.scrollTop = chatHistory.scrollHeight;

    } catch (error) {
        console.error("Error asking AI:", error);
        addMessageToHistory("Sorry, I encountered an error. Please try again.", 'ai', true);
    } finally {
        setChatLoading(false);
    }
}


async function handleChatSubmit(e: Event) {
    e.preventDefault();
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    addMessageToHistory(userMessage, 'user');
    chatInput.value = '';
    askAI(userMessage);
}

function addMessageToHistory(message: string, sender: 'user' | 'ai', isError = false): HTMLElement {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message-wrapper'); // New wrapper for avatar + content
    messageWrapper.classList.add(`${sender}-wrapper`);

    const avatar = document.createElement('div');
    avatar.classList.add('chat-avatar');
    avatar.innerHTML = sender === 'ai'
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="4" y="12" width="16" height="8" rx="2"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg>`;

    const messageContent = document.createElement('div');
    messageContent.classList.add('message');
    messageContent.classList.add(`${sender}-message`);
    if (isError) {
        messageContent.style.backgroundColor = '#5c1a1a';
        messageContent.style.color = '#f8d7da';
    }
    
    const p = document.createElement('p');
    p.textContent = message;
    messageContent.appendChild(p);
    
    messageWrapper.appendChild(avatar);
    messageWrapper.appendChild(messageContent);
    
    chatHistory.appendChild(messageWrapper);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return messageWrapper;
}

function setChatLoading(isLoading: boolean) {
    chatInput.disabled = isLoading;
    chatSubmitButton.disabled = isLoading;
}

// --- Error Handling ---
function handleFatalError(message: string) {
    const mainContainer = document.querySelector('.main-content');
    if (mainContainer) {
        mainContainer.innerHTML = `<div class="error-card">${message}</div>`;
    } else {
        document.body.innerHTML = `<div class="error-card">${message}</div>`;
    }
}

// --- Start the App ---
initializeApp();