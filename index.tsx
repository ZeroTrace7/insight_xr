/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Chat, Type } from '@google/genai';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TubeGeometry } from 'three/src/geometries/TubeGeometry.js';
import { auth, db, storage, googleProvider, isFirebaseConfigured } from './insightxr-backend/src/firebase';
import { 
    User, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    signInWithPopup,
    getAdditionalUserInfo,
    updateProfile
} from 'firebase/auth';
import { doc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

const DEFAULT_AVATARS = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=c0aede',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie&backgroundColor=ffd5dc',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Max&backgroundColor=d1d4f9',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna&backgroundColor=ffdfbf'
];

function getRandomAvatar(): string {
    return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
}

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
             if (obj.userData.update) {
                 obj.userData.update();
             }
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

        if (this.lastClicked) {
            const material = this.lastClicked.material as THREE.MeshStandardMaterial;
            if (this.lastClicked.userData.originalEmissive) {
                material.emissive.copy(this.lastClicked.userData.originalEmissive);
                delete this.lastClicked.userData.originalEmissive;
            }
            this.lastClicked = null;
        }

        if (intersects.length > 0) {
            const firstIntersect = intersects[0].object;
            if (firstIntersect instanceof THREE.Mesh && firstIntersect.name) {
                const material = firstIntersect.material as THREE.MeshStandardMaterial;
                if (material.emissive) {
                    this.lastClicked = firstIntersect;
                    this.lastClicked.userData.originalEmissive = material.emissive.clone();
                    material.emissive.set(this.highlightColor);
                }
                
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
            obj.traverse(child => {
                 if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        (child.material as THREE.Material).dispose();
                    }
                }
            });
            this.scene.remove(obj);
        }
        this.activeObjects = [];
        this.lastClicked = null;
        
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
    
        const sOrbitalSpeed = 1.2;
        const pOrbitalSpeed = 1.0;
    
        createElectronAndRing(8, "1s Electron", sOrbitalSpeed, new THREE.Euler(0, 0, 0), Math.random() * Math.PI * 2);
        createElectronAndRing(8, "1s Electron", sOrbitalSpeed, new THREE.Euler(Math.PI / 2, Math.PI / 3, 0), Math.random() * Math.PI * 2);
    
        createElectronAndRing(16, "2s Electron", sOrbitalSpeed * 0.8, new THREE.Euler(0, Math.PI / 2, Math.PI / 4), Math.random() * Math.PI * 2);
        createElectronAndRing(16, "2s Electron", sOrbitalSpeed * 0.8, new THREE.Euler(0, -Math.PI / 2, -Math.PI / 4), Math.random() * Math.PI * 2);
    
        const pz_rot = new THREE.Euler(0, 0, 0);
        const px_rot = new THREE.Euler(0, Math.PI / 2, 0);
        const py_rot = new THREE.Euler(Math.PI / 2, 0, 0);
        
        createElectronAndRing(16, "2p Electron", pOrbitalSpeed, pz_rot, 0);
        createElectronAndRing(16, "2p Electron", pOrbitalSpeed, pz_rot, Math.PI);
        createElectronAndRing(16, "2p Electron", pOrbitalSpeed, px_rot, 0);
        createElectronAndRing(16, "2p Electron", pOrbitalSpeed, px_rot, Math.PI);
        createElectronAndRing(16, "2p Electron", pOrbitalSpeed, py_rot, 0);
        createElectronAndRing(16, "2p Electron", pOrbitalSpeed, py_rot, Math.PI);
        
        atomGroup.userData.update = () => {
            atomGroup.rotation.y += 0.001;
            atomGroup.rotation.x += 0.0005;
        };
        
        this.onResize();
    }

    public loadPlaceholder(modelName: string) {
        this.cleanup();
    }
}

const authPage = document.getElementById('auth-page') as HTMLDivElement;
const mainContent = document.querySelector('.main-content') as HTMLElement;
const bottomNav = document.querySelector('.bottom-nav') as HTMLElement;

// Auth Page
const authForm = document.getElementById('auth-form') as HTMLFormElement;
const authEmailInput = document.getElementById('auth-email') as HTMLInputElement;
const authPasswordInput = document.getElementById('auth-password') as HTMLInputElement;
const passwordToggleButton = document.getElementById('password-toggle-button') as HTMLButtonElement;
const authSubmitButton = document.getElementById('auth-submit-button') as HTMLButtonElement;
const authError = document.getElementById('auth-error') as HTMLParagraphElement;
const authVisualTitle = document.getElementById('auth-visual-title') as HTMLHeadingElement;
const authVisualSubtitle = document.getElementById('auth-visual-subtitle') as HTMLParagraphElement;
const signOutButton = document.getElementById('sign-out-button') as HTMLButtonElement;
const googleSignInButton = document.querySelector('.google-btn') as HTMLButtonElement;
const authTabSignIn = document.getElementById('auth-tab-signin') as HTMLButtonElement;
const authTabSignUp = document.getElementById('auth-tab-signup') as HTMLButtonElement;


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
const profileAvatarImg = document.getElementById('profile-avatar-img') as HTMLImageElement;
const chooseAvatarButton = document.getElementById('choose-avatar-button') as HTMLButtonElement;
const avatarSelectorModal = document.getElementById('avatar-selector-modal') as HTMLDivElement;
const closeAvatarModal = document.getElementById('close-avatar-modal') as HTMLButtonElement;
const avatarGrid = document.getElementById('avatar-grid') as HTMLDivElement;
const avatarLoader = document.getElementById('avatar-loader') as HTMLDivElement;
const themeToggleButton = document.getElementById('theme-toggle-button') as HTMLButtonElement;


// Quick Actions
const reviewActionCard = document.getElementById('review-action-card') as HTMLDivElement;
const quizActionCard = document.getElementById('quiz-action-card') as HTMLDivElement;

// Leaderboard
const leaderboardList = document.getElementById('leaderboard-list') as HTMLDivElement;
const refreshLeaderboardButton = document.getElementById('refresh-leaderboard-button') as HTMLButtonElement;

// Home Page Module Cards
const emModuleCard = document.getElementById('em-module-card');
const ohmsLawModuleCard = document.getElementById('ohms-law-module-card');
const atomicOrbitalsModuleCard = document.getElementById('atomic-orbitals-module-card');
const dnaModuleCard = document.getElementById('dna-module-card');
const solarSystemModuleCard = document.getElementById('solar-system-module-card');
const programmingModuleCard = document.getElementById('programming-module-card');

// Detail Page
const detailPage = document.getElementById('detail-page');
const detailTitle = document.getElementById('detail-title');
const detailImage = document.getElementById('detail-image');
const detailDescription = document.getElementById('detail-description');

// Simulation Tab Navigation
const navOhmsLaw = document.getElementById('nav-ohms-law');
const navEmWave = document.getElementById('nav-em-wave');
const nav3dViewer = document.getElementById('nav-3d-viewer');
const navProgramming = document.getElementById('nav-programming');
const ohmsLawPanel = document.getElementById('ohms-law-panel');
const emWavePanel = document.getElementById('em-wave-panel');
const viewerPanel = document.getElementById('3d-viewer-panel');
const programmingPanel = document.getElementById('programming-panel');
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
const waveCrest = document.getElementById('wave-crest') as unknown as SVGLineElement;
const wavelengthIndicator = document.getElementById('wavelength-indicator') as unknown as SVGGElement;

// 3D Viewer
const canvas = document.getElementById('3d-canvas') as HTMLCanvasElement;
const loader = document.getElementById('3d-loader');
let threeDViewer: ThreeDViewer;

// Programming Panel
const codeInput = document.getElementById('code-input') as HTMLTextAreaElement;
const runCodeButton = document.getElementById('run-code-button') as HTMLButtonElement;
const codeOutput = document.getElementById('code-output') as HTMLElement;
const outputLoader = document.getElementById('output-loader') as HTMLDivElement;

// Chat
const chatForm = document.getElementById('chat-form') as HTMLFormElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const chatSubmitButton = document.getElementById('chat-submit-button') as HTMLButtonElement;
const chatHistory = document.getElementById('chat-history');

// Quiz
const quizPage = document.getElementById('quiz-page');
const quizPageTitle = document.getElementById('quiz-page-title');
const quizPageSubtitle = document.getElementById('quiz-page-subtitle');
const quizTopicSelection = document.getElementById('quiz-topic-selection');
const quizTopicGrid = document.getElementById('quiz-topic-grid');
const quizActiveSession = document.getElementById('quiz-active-session');
const quizCard = document.getElementById('quiz-card');
const quizQuestionContainer = document.getElementById('quiz-question-container');
const quizQuestion = document.getElementById('quiz-question');
const quizOptions = document.getElementById('quiz-options');
const quizExplanation = document.getElementById('quiz-explanation');
const quizSubmitButton = document.getElementById('quiz-submit-button') as HTMLButtonElement;
const quizResults = document.getElementById('quiz-results');
const quizResultsTitle = document.getElementById('quiz-results-title');
const quizScore = document.getElementById('quiz-score');
const quizReviewList = document.getElementById('quiz-review-list');
const quizReturnHomeButton = document.getElementById('quiz-return-home-button') as HTMLButtonElement;
const quizProgress = document.getElementById('quiz-progress');

// Review Page
const reviewPage = document.getElementById('review-page');
const reviewPageSubtitle = document.getElementById('review-page-subtitle');
// Review Views
const reviewSummaryView = document.getElementById('review-summary-view');
const reviewActiveSession = document.getElementById('review-active-session');
const reviewResultsView = document.getElementById('review-results-view');
// Review Summary
const reviewTopicTitle = document.getElementById('review-topic-title');
const reviewSummaryLoader = document.getElementById('review-summary-loader');
const reviewSummary = document.getElementById('review-summary');
const reviewStartQuizButton = document.getElementById('review-start-quiz-button') as HTMLButtonElement;
// Review Active Quiz
const reviewQuestionContainer = document.getElementById('review-question-container');
const reviewProgress = document.getElementById('review-progress');
const reviewQuestion = document.getElementById('review-question');
const reviewOptions = document.getElementById('review-options');
const reviewExplanation = document.getElementById('review-explanation');
const reviewSubmitButton = document.getElementById('review-submit-button') as HTMLButtonElement;
// Review Results
const reviewResultsTitle = document.getElementById('review-results-title');
// FIX: Renamed variable to avoid conflict with the 'reviewScore' state variable.
const reviewScoreEl = document.getElementById('review-score');
const reviewReviewList = document.getElementById('review-review-list');
const reviewAnotherTopicButton = document.getElementById('review-another-topic-button') as HTMLButtonElement;
const reviewReturnHomeButton = document.getElementById('review-return-home-button') as HTMLButtonElement;


// --- State and Constants ---

let chat: Chat;
let ai: GoogleGenAI;
let authMode: 'login' | 'signup' = 'login';
let currentUser: User | null = null;
type ModuleKey = 'ohms' | 'em' | 'atomic' | 'dna' | 'solar' | 'programming';
type PageName = 'home' | 'simulations' | 'dashboard' | 'profile' | 'detail' | 'quiz' | 'auth' | 'review';
type TabKey = 'ohms' | 'em' | '3d' | 'programming';

type ModelType = 'atomic' | 'dna' | 'solar';


// EM Wave Animation State
let emWaveAnimationId: number | null = null;
let lastEmWaveTimestamp = 0;
let crestPosition = 20;
const propagationSpeed = 60; // pixels per second, constant for 'c'

interface BaseModuleData {
    title: string;
    description: string;
    image: string;
}

interface SimModuleData extends BaseModuleData {
    targetTab: 'ohms' | 'em' | 'programming';
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
        image: "url('https://images.unsplash.com/photo-1589578236836-69a452178224?w=1080&h=720&fit=crop&q=80')",
        targetTab: 'ohms'
    },
    'em': {
        title: "Electromagnetic Waves",
        description: "Visualize how an electromagnetic wave propagates. This simulation shows the electric field (E) and magnetic field (B) oscillating perpendicular to each other and to the direction of wave travel. Adjust frequency and amplitude to see how the wave changes.",
        image: "url('https://images.unsplash.com/photo-1614270279895-a22835c17cb0?w=1080&h=720&fit=crop&q=80')",
        targetTab: 'em'
    },
    'atomic': {
        title: "Neon Atom Model",
        description: "Explore an interactive 3D model of a Neon atom. See its 10 electrons orbiting the nucleus in their respective 1s, 2s, and 2p orbitals. Click on any component to learn more about it from the AI assistant.",
        image: "url('https://images.unsplash.com/photo-1599991901213-9152a58d6335?w=1080&h=720&fit=crop&q=80')",
        targetTab: '3d',
        modelType: 'atomic'
    },
     'dna': {
        title: "DNA Replication",
        description: "Explore an interactive 3D model of a DNA double helix. Zoom, pan, and rotate to see the molecule's structure. Click on the colored bases (A, T, C, G) to learn more about them from the AI assistant.",
        image: "url('https://images.unsplash.com/photo-1532187643623-dbf26353d395?w=1080&h=720&fit=crop&q=80')",
        targetTab: '3d',
        modelType: 'dna'
    },
    'solar': {
        title: "Solar System",
        description: "Explore an interactive 3D model of our solar system. Zoom, pan, and rotate to see the planets. Click on a planet or the sun to learn more about it from the AI assistant.",
        image: "url('https://images.unsplash.com/photo-1614726353902-75c60a58a743?w=1080&h=720&fit=crop&q=80')",
        targetTab: '3d',
        modelType: 'solar'
    },
    'programming': {
        title: "Java Fundamentals",
        description: "This module introduces the fundamental concepts of programming using Java. Learn about variables, data types, control flow, and basic syntax through interactive examples and challenges. No prior experience needed!",
        image: "url('https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1080&h=720&fit=crop&q=80')",
        targetTab: 'programming'
    }
};

const questionBank = {
    'dna': [
        {
            question: "What does DNA stand for?",
            options: ["Deoxyribonucleic Acid", "Deoxyribonuclear Acid", "Denatured Ribonucleic Acid", "Double Nucleic Acid"],
            correctAnswer: 0,
            explanation: "DNA stands for Deoxyribonucleic Acid. It's the molecule carrying genetic instructions for all known organisms."
        },
        {
            question: "Which base pairs with Adenine (A) in DNA?",
            options: ["Guanine (G)", "Cytosine (C)", "Thymine (T)", "Uracil (U)"],
            correctAnswer: 2,
            explanation: "In DNA, Adenine (A) always forms a bond with Thymine (T), while Guanine (G) pairs with Cytosine (C)."
        },
        {
            question: "What is the shape of a DNA molecule commonly described as?",
            options: ["Single Helix", "Alpha Pleated Sheet", "Double Helix", "Triple Helix"],
            correctAnswer: 2,
            explanation: "The structure of DNA is a double helix, resembling a twisted ladder, with the base pairs forming the rungs."
        },
        {
            question: "What forms the 'backbone' of the DNA double helix?",
            options: ["Nitrogenous Bases", "Sugar and Phosphate Groups", "Amino Acids", "Hydrogen Bonds"],
            correctAnswer: 1,
            explanation: "The sides of the DNA ladder are made of alternating sugar (deoxyribose) and phosphate groups, forming the sugar-phosphate backbone."
        },
        {
            question: "How many hydrogen bonds are formed between Guanine (G) and Cytosine (C)?",
            options: ["One", "Two", "Three", "Four"],
            correctAnswer: 2,
            explanation: "Guanine and Cytosine form three hydrogen bonds, making their connection stronger than the two bonds between Adenine and Thymine."
        }
    ],
    'ohms': [
        {
            question: "According to Ohm's Law, if you increase the voltage in a circuit while keeping resistance constant, what happens to the current?",
            options: ["It decreases", "It stays the same", "It increases", "It becomes zero"],
            correctAnswer: 2,
            explanation: "Ohm's Law (V=IR) states that current (I) is directly proportional to voltage (V). If voltage increases, current increases."
        },
        {
            question: "What is the unit of electrical resistance?",
            options: ["Volt (V)", "Ampere (A)", "Watt (W)", "Ohm (Ω)"],
            correctAnswer: 3,
            explanation: "The standard unit of electrical resistance is the Ohm, symbolized by the Greek letter omega (Ω)."
        },
        {
            question: "A circuit has a 12V battery and a 4Ω resistor. What is the current?",
            options: ["48 A", "3 A", "0.33 A", "16 A"],
            correctAnswer: 1,
            explanation: "Using Ohm's Law (I = V/R), the current is 12 Volts / 4 Ohms = 3 Amperes."
        },
        {
            question: "If you double the resistance in a circuit while keeping the voltage the same, what happens to the current?",
            options: ["It is halved", "It is doubled", "It stays the same", "It is quadrupled"],
            correctAnswer: 0,
            explanation: "According to Ohm's Law (I = V/R), current is inversely proportional to resistance. If resistance doubles, the current is cut in half."
        },
        {
            question: "What is the electrical power (in Watts) consumed by a circuit with 10V and 2A?",
            options: ["5 W", "8 W", "12 W", "20 W"],
            correctAnswer: 3,
            explanation: "Power (P) is calculated as Voltage (V) times Current (I). So, P = 10V * 2A = 20 Watts."
        }
    ],
    'em': [
        {
            question: "In an electromagnetic wave, the electric field and magnetic field are...",
            options: ["Parallel to each other", "Perpendicular to each other", "In the same direction as wave travel", "Opposite to each other"],
            correctAnswer: 1,
            explanation: "A key property of EM waves is that the electric and magnetic fields oscillate perpendicular to each other and to the direction of wave propagation."
        },
        {
            question: "If you increase the frequency of an electromagnetic wave, what happens to its wavelength?",
            options: ["It increases", "It decreases", "It stays the same", "It depends on the amplitude"],
            correctAnswer: 1,
            explanation: "Frequency and wavelength are inversely proportional (c = fλ). As frequency goes up, wavelength must go down."
        },
        {
            question: "Which of these has the shortest wavelength?",
            options: ["Radio waves", "Microwaves", "Visible light", "X-rays"],
            correctAnswer: 3,
            explanation: "X-rays have a much higher frequency and therefore a much shorter wavelength than radio waves, microwaves, or visible light."
        },
        {
            question: "What is the speed of all electromagnetic waves in a vacuum?",
            options: ["The speed of sound", "The speed of light", "It varies with frequency", "It depends on amplitude"],
            correctAnswer: 1,
            explanation: "All forms of electromagnetic radiation, from radio waves to gamma rays, travel at the constant speed of light (c) in a vacuum."
        },
        {
            question: "What is the primary source of electromagnetic waves?",
            options: ["A stationary charge", "A constant magnetic field", "An accelerating electric charge", "A wire with constant current"],
            correctAnswer: 2,
            explanation: "Electromagnetic waves are produced by the vibration or acceleration of electric charges, which creates oscillating electric and magnetic fields."
        }
    ],
    'atomic': [
        {
            question: "How many electrons does a neutral Neon (Ne) atom have?",
            options: ["8", "12", "10", "18"],
            correctAnswer: 2,
            explanation: "Neon's atomic number is 10, meaning a neutral atom has 10 protons and, therefore, 10 electrons to balance the charge."
        },
        {
            question: "Which electron orbital is closest to the nucleus in a Neon atom?",
            options: ["1s", "2s", "2p", "3s"],
            correctAnswer: 0,
            explanation: "The 1s orbital is in the first energy level (n=1), making it the lowest energy level and the one closest to the nucleus."
        },
        {
            question: "What particle is found in the nucleus and has no electric charge?",
            options: ["Proton", "Electron", "Photon", "Neutron"],
            correctAnswer: 3,
            explanation: "Neutrons are located in the nucleus along with protons, but they are electrically neutral (have no charge)."
        },
        {
            question: "The number of which particle defines the element?",
            options: ["Electrons", "Protons", "Neutrons", "Nucleons"],
            correctAnswer: 1,
            explanation: "The atomic number, which is the number of protons in the nucleus, uniquely identifies a chemical element."
        },
        {
            question: "What is the charge of an electron?",
            options: ["Positive", "Negative", "Neutral", "It varies"],
            correctAnswer: 1,
            explanation: "Electrons are fundamental subatomic particles that carry a negative electric charge."
        }
    ],
    'solar': [
        {
            question: "Which planet is known as the 'Red Planet'?",
            options: ["Venus", "Mars", "Jupiter", "Saturn"],
            correctAnswer: 1,
            explanation: "Mars is called the Red Planet because of the iron oxide (rust) on its surface, which gives it a reddish appearance."
        },
        {
            question: "What is the largest planet in our solar system?",
            options: ["Saturn", "Neptune", "Earth", "Jupiter"],
            correctAnswer: 3,
            explanation: "Jupiter is the largest planet, with a mass more than twice that of all the other planets in our solar system combined."
        },
        {
            question: "What is the name of the star at the center of our solar system?",
            options: ["Alpha Centauri", "Sirius", "The Sun", "Betelgeuse"],
            correctAnswer: 2,
            explanation: "The Sun is the star at the heart of our solar system, and its gravity holds the system together."
        },
        {
            question: "Which planet is famous for its extensive and prominent rings?",
            options: ["Uranus", "Jupiter", "Mars", "Saturn"],
            correctAnswer: 3,
            explanation: "While other gas giants have rings, Saturn's are by far the most spectacular and well-known, made of ice and rock particles."
        },
        {
            question: "Which planet is closest to the Sun?",
            options: ["Mercury", "Venus", "Earth", "Mars"],
            correctAnswer: 0,
            explanation: "Mercury is the innermost planet in our solar system, making it the closest to the Sun."
        }
    ],
    'programming': [
        {
            question: "What is the correct syntax for the main method in a Java program?",
            options: ["public static void main(String[] args)", "public void main(String args)", "static public void main()", "main(String[] args)"],
            correctAnswer: 0,
            explanation: "The standard entry point for a Java application is the `public static void main(String[] args)` method."
        },
        {
            question: "Which command is used to print output to the console in Java?",
            options: ["Console.WriteLine()", "print()", "System.out.println()", "cout <<"],
            correctAnswer: 2,
            explanation: "`System.out.println()` is the method used to print a line of text to the standard output console."
        },
        {
            question: "Which data type would you use to store a whole number like 10?",
            options: ["double", "String", "boolean", "int"],
            correctAnswer: 3,
            explanation: "The `int` data type is used to store 32-bit signed integers (whole numbers)."
        },
        {
            question: "What character must be at the end of most Java statements?",
            options: ["A period (.)", "A colon (:)", "A semicolon (;)", "A comma (,)"],
            correctAnswer: 2,
            explanation: "The semicolon (;) is used to mark the end of a statement in Java, similar to how a period ends a sentence."
        },
        {
            question: "How do you declare and initialize a variable to store the text 'Hello'?",
            options: ["string text = 'Hello';", "var text = 'Hello';", "String text = \"Hello\";", "Text text = \"Hello\";"],
            correctAnswer: 2,
            explanation: "In Java, strings are represented by the `String` class (with a capital S) and string literals are enclosed in double quotes."
        }
    ]
};

// Quiz State
let currentQuestionIndex = 0;
let score = 0;
let currentQuizTopic: ModuleKey | null = null;
let userAnswers: { question: string, selected: number, correct: number, options: string[], explanation: string }[] = [];
type QuizState = 'answering' | 'feedback';
let quizState: QuizState = 'answering';

// Review State
let reviewTopic = '';
type ReviewQuizQuestion = { question: string, options: string[], correctAnswerIndex: number, explanation: string };
let reviewQuestions: ReviewQuizQuestion[] = [];
let currentReviewQuestionIndex = 0;
let reviewScore = 0;
let reviewUserAnswers: { question: string, selected: number, correct: number, options: string[], explanation: string }[] = [];
type ReviewQuizState = 'answering' | 'feedback';
let reviewQuizState: ReviewQuizState = 'answering';


// --- AI Chat Session Management ---
function resetChatSession() {
    if (!ai) return; // Don't reset if AI isn't initialized
    try {
        chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: `You are a friendly and encouraging AI tutor specializing in physics, chemistry, astronomy, and basic programming for school students. 
                Your goal is to explain complex concepts like Ohm's Law, circuits, electromagnetic waves, atomic orbitals, DNA replication, and our solar system in a simple, intuitive, and engaging way. 
                When asked about a celestial body like the Sun or a planet, provide a concise, interesting fact or a short paragraph about it.
                When asked about a DNA base (Adenine, Thymine, Guanine, Cytosine), explain what it is and what it pairs with.
                When asked about the parts of a Neon atom, explain their role. For the Neon Nucleus, mention it contains 10 protons and 10 neutrons. For electrons, describe them as negatively charged particles occupying specific energy levels or orbitals. Differentiate between the 1s, 2s, and 2p electrons based on their energy level and proximity to the nucleus.
                When asked about basic Java programming concepts like variables, data types, or loops, provide a simple explanation with a short code example.
                If a student provides you with Java code and an error message, explain the error in a beginner-friendly way, identify the likely problem in their code, and suggest a clear, simple fix. Be encouraging and avoid overly technical jargon.
                Use analogies and real-world examples. Keep your explanations concise and clear. Do not use markdown.`,
            },
        });
    } catch (error) {
        console.error("Error creating new chat session:", error);
        addMessageToHistory("Sorry, I couldn't start a new conversation. Please try again.", 'ai', true);
    }
}


// --- Initialization ---
function initializeApp() {
    // Check for critical elements
    if (!voltageSlider || !resistanceSlider || !chatForm || !frequencySlider || !amplitudeSlider || !canvas || !reviewActionCard) {
        handleFatalError("A critical UI element is missing. The application cannot start.");
        return;
    }

    // --- Configuration Checks ---
    if (!isFirebaseConfigured) {
        handleFatalError(`
            <h2 style="margin-bottom: 1rem;">Firebase Configuration Missing</h2>
            <p style="color: var(--text-color-secondary); line-height: 1.6;">
                Your Firebase environment variables are not set correctly. Authentication and database features are disabled.
            </p>
            <p style="margin-top: 1.5rem;">
                Please add your Firebase project credentials (e.g., <code>FIREBASE_API_KEY</code>) to your environment variables and restart the server.
            </p>
        `);
        return;
    }

    if (!process.env.API_KEY) {
        handleFatalError(`
            <h2 style="margin-bottom: 1rem;">Gemini API Key Missing</h2>
            <p style="color: var(--text-color-secondary); line-height: 1.6;">
                Your Gemini API key is not set. The AI tutor and other generative features are disabled.
            </p>
            <p style="margin-top: 1.5rem;">
                Please add your <code>GEMINI_API_KEY</code> to your environment variables and restart the server.
            </p>
        `);
        return;
    }
    
    // Listen for Firebase auth state changes
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUser = user;
            showApp(user);
        } else {
            currentUser = null;
            showAuthPage();
        }
    });

    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } catch (error) {
        console.error(error);
        handleFatalError("Failed to initialize the AI service. The API key might be invalid or missing.");
        return;
    }
    
    resetChatSession();

    // Set initial simulation states
    updateOhmSimulation();
    updateEMWaveSimulation();
    
    // Init 3D Viewer
    threeDViewer = new ThreeDViewer(canvas);
    threeDViewer.setOnClickCallback(onObjectSelected);


    // --- Event Listeners ---
    
    // Auth
    authForm.addEventListener('submit', handleAuthSubmit);
    authTabSignIn.addEventListener('click', () => switchAuthTab('login'));
    authTabSignUp.addEventListener('click', () => switchAuthTab('signup'));
    signOutButton.addEventListener('click', handleSignOut);
    googleSignInButton.addEventListener('click', handleGoogleSignIn);
    passwordToggleButton.addEventListener('click', togglePasswordVisibility);

    // Main App Navigation
    navButtons.home.addEventListener('click', () => navigateTo('home'));
    navButtons.simulations.addEventListener('click', () => navigateTo('simulations'));
    navButtons.dashboard.addEventListener('click', () => navigateTo('dashboard'));
    navButtons.profile.addEventListener('click', () => navigateTo('profile'));

    // Profile Actions
    chooseAvatarButton?.addEventListener('click', showAvatarSelector);
    closeAvatarModal?.addEventListener('click', closeAvatarSelector);
    themeToggleButton?.addEventListener('click', toggleTheme);
    
    // Close modal when clicking outside
    avatarSelectorModal?.addEventListener('click', (e) => {
        if (e.target === avatarSelectorModal) {
            closeAvatarSelector();
        }
    });


    // Quick Actions
    reviewActionCard.addEventListener('click', startReviewSession);
    quizActionCard.addEventListener('click', startQuiz);

    // Home Page Module Links
    ohmsLawModuleCard.addEventListener('click', () => showDetailPage('ohms'));
    emModuleCard.addEventListener('click', () => showDetailPage('em'));
    atomicOrbitalsModuleCard.addEventListener('click', () => showDetailPage('atomic'));
    dnaModuleCard.addEventListener('click', () => showDetailPage('dna'));
    solarSystemModuleCard.addEventListener('click', () => showDetailPage('solar'));
    programmingModuleCard.addEventListener('click', () => showDetailPage('programming'));


    // Simulation Controls
    voltageSlider.addEventListener('input', updateOhmSimulation);
    resistanceSlider.addEventListener('input', updateOhmSimulation);
    frequencySlider.addEventListener('input', updateEMWaveSimulation);
    amplitudeSlider.addEventListener('input', updateEMWaveSimulation);

    // Simulation Tabs
    navOhmsLaw.addEventListener('click', () => switchTab('ohms'));
    navEmWave.addEventListener('click', () => switchTab('em'));
    nav3dViewer.addEventListener('click', () => switchTab('3d'));
    navProgramming.addEventListener('click', () => switchTab('programming'));

    // Programming Panel
    runCodeButton?.addEventListener('click', handleRunCode);

    // Chat
    chatForm.addEventListener('submit', handleChatSubmit);
    
    // Quiz
    quizSubmitButton.addEventListener('click', handleQuizAction);
    quizReturnHomeButton.addEventListener('click', () => navigateTo('home'));

    // Review Session
    reviewStartQuizButton.addEventListener('click', generateAndStartReviewQuiz);
    reviewSubmitButton.addEventListener('click', handleReviewAction);
    reviewAnotherTopicButton.addEventListener('click', startReviewSession);
    reviewReturnHomeButton.addEventListener('click', () => navigateTo('home'));
    
    // Leaderboard
    refreshLeaderboardButton.addEventListener('click', loadLeaderboard);
    
    // Apply initial theme
    applyInitialTheme();

}

// --- Theme Management ---
function applyInitialTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.toggle('light-theme', savedTheme === 'light');
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    const newTheme = isLight ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme: string) {
    if (!themeToggleButton) return;
    const sunIcon = themeToggleButton.querySelector('.icon-sun');
    const moonIcon = themeToggleButton.querySelector('.icon-moon');
    if (theme === 'light') {
        sunIcon?.classList.add('hidden');
        moonIcon?.classList.remove('hidden');
    } else {
        sunIcon?.classList.remove('hidden');
        moonIcon?.classList.add('hidden');
    }
}


// --- Auth Logic ---
function showApp(user: User) {
    authPage.style.display = 'none';
    mainContent.style.display = 'block';
    bottomNav.style.display = 'flex';
    if(themeToggleButton) themeToggleButton.style.display = 'flex';
    
    // Personalize UI
    const name = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
    
    // Dynamic greeting based on time of day
    const currentHour = new Date().getHours();
    let greeting = "Good morning";
    if (currentHour >= 12 && currentHour < 18) {
        greeting = "Good afternoon";
    } else if (currentHour >= 18 || currentHour < 5) {
        greeting = "Good evening";
    }
    
    welcomeHeader.textContent = `${greeting}, ${capitalizedName}!`;
    profileName.textContent = capitalizedName;
    profileEmail.textContent = user.email;

    if (user.photoURL) {
        profileAvatarImg.src = user.photoURL;
    }
    
    // Show the choose avatar button
    if (chooseAvatarButton) {
        chooseAvatarButton.style.display = 'flex';
    }

    navigateTo('home');
}

function showAuthPage() {
    authPage.style.display = 'flex';
    authPage.classList.add('active');
    mainContent.style.display = 'none';
    bottomNav.style.display = 'none';
    if(themeToggleButton) themeToggleButton.style.display = 'none';
    
    // Hide other pages
    pages.forEach(page => page.classList.remove('active'));
    updateAuthUI();
}

function switchAuthTab(mode: 'login' | 'signup') {
    authMode = mode;

    // Animate the form for visual feedback
    const form = document.getElementById('auth-form');
    if (form) {
        form.classList.remove('form-fade-in');
        void form.clientWidth; // Trigger reflow to restart animation
        form.classList.add('form-fade-in');
    }

    // Update tab visuals
    authTabSignIn.classList.toggle('active', mode === 'login');
    authTabSignUp.classList.toggle('active', mode === 'signup');

    // Update button text and other UI elements
    updateAuthUI();
}


function updateAuthUI() {
    authError.textContent = '';
    if (authMode === 'login') {
        authSubmitButton.textContent = 'Sign In';
        if(authVisualTitle) authVisualTitle.textContent = 'Welcome Back!';
        if(authVisualSubtitle) authVisualSubtitle.textContent = 'Sign in to continue your journey through the wonders of science.';

    } else {
        authSubmitButton.textContent = 'Create Account';
        if(authVisualTitle) authVisualTitle.textContent = 'Join the Adventure!';
        if(authVisualSubtitle) authVisualSubtitle.textContent = 'Create your account to unlock interactive simulations and personalized learning.';
    }
}

function togglePasswordVisibility() {
    const isPassword = authPasswordInput.type === 'password';
    authPasswordInput.type = isPassword ? 'text' : 'password';

    const eyeIcon = passwordToggleButton.querySelector('.icon-eye');
    const eyeOffIcon = passwordToggleButton.querySelector('.icon-eye-off');

    if (isPassword) {
        eyeIcon?.classList.add('hidden');
        eyeOffIcon?.classList.remove('hidden');
        passwordToggleButton.setAttribute('aria-label', 'Hide password');
    } else {
        eyeIcon?.classList.remove('hidden');
        eyeOffIcon?.classList.add('hidden');
        passwordToggleButton.setAttribute('aria-label', 'Show password');
    }
}

async function handleAuthSubmit(e: Event) {
    e.preventDefault();
    if (!auth || !db) return; // Guard against uninitialized firebase

    authSubmitButton.disabled = true;
    authError.textContent = '';
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;

    if (!email || !password) {
        authError.textContent = 'Please enter both email and password.';
        authSubmitButton.disabled = false;
        return;
    }

    try {
        if (authMode === 'signup') {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Assign a random default avatar
            const randomAvatar = getRandomAvatar();
            
            // Update user profile with avatar
            await updateProfile(user, {
                photoURL: randomAvatar
            });
            
            // Create a user document in Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                photoURL: randomAvatar,
                availableAvatars: DEFAULT_AVATARS, // Store all 5 avatars for later selection
                createdAt: new Date(),
            });
            // onAuthStateChanged will handle UI update
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle UI update
        }
    } catch (error) {
        console.error("Firebase Auth Error:", error);
        authError.textContent = error.message;
    } finally {
        authSubmitButton.disabled = false;
    }
}

async function handleGoogleSignIn() {
    if (!auth || !db) return; // Guard against uninitialized firebase
    authError.textContent = '';
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const additionalUserInfo = getAdditionalUserInfo(result);

        // If it's a new user, create their document in Firestore
        if (additionalUserInfo?.isNewUser) {
            // Assign a random default avatar (Google avatar as backup)
            const randomAvatar = getRandomAvatar();
            const finalAvatar = user.photoURL || randomAvatar;
            
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: finalAvatar,
                availableAvatars: DEFAULT_AVATARS, // Store all 5 avatars for later selection
                createdAt: new Date(),
            });
        }
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        authError.textContent = error.message;
    }
}

async function handleSignOut() {
    if (!auth) return;
    try {
        await signOut(auth);
        // onAuthStateChanged will handle UI update
    } catch (error) {
        console.error("Sign Out Error:", error);
    }
}

// --- Avatar Selection from Defaults ---
function showAvatarSelector() {
    if (!avatarSelectorModal || !avatarGrid) return;
    
    // Clear existing avatars
    avatarGrid.innerHTML = '';
    
    // Create avatar options
    DEFAULT_AVATARS.forEach((avatarUrl, index) => {
        const avatarOption = document.createElement('div');
        avatarOption.className = 'avatar-option';
        avatarOption.innerHTML = `<img src="${avatarUrl}" alt="Avatar option ${index + 1}">`;
        
        // Check if this is the current avatar
        if (currentUser && currentUser.photoURL === avatarUrl) {
            avatarOption.classList.add('selected');
        }
        
        avatarOption.addEventListener('click', () => selectAvatar(avatarUrl));
        avatarGrid.appendChild(avatarOption);
    });
    
    // Show modal
    avatarSelectorModal.style.display = 'flex';
}

function closeAvatarSelector() {
    if (avatarSelectorModal) {
        avatarSelectorModal.style.display = 'none';
    }
}

async function selectAvatar(avatarUrl: string) {
    if (!currentUser || !auth || !db) return;
    
    try {
        // Update Firebase Auth profile
        await updateProfile(currentUser, {
            photoURL: avatarUrl
        });
        
        // Update Firestore
        await updateDoc(doc(db, "users", currentUser.uid), {
            photoURL: avatarUrl
        });
        
        // Update UI
        if (profileAvatarImg) {
            profileAvatarImg.src = avatarUrl;
        }
        
        // Close modal
        closeAvatarSelector();
        
        // Show success message
        console.log('Avatar updated successfully!');
    } catch (error) {
        console.error('Error updating avatar:', error);
    }
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
    
    // Load leaderboard when navigating to home page
    if (pageName === 'home') {
        loadLeaderboard();
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
        'ohms': { 
            nav: navOhmsLaw, 
            panel: ohmsLawPanel, 
            text: "Ask about Ohm's Law...",
            greeting: "Hello! How can I help you with the Ohm's Law simulation today?" 
        },
        'em': { 
            nav: navEmWave, 
            panel: emWavePanel, 
            text: "Ask about EM waves...",
            greeting: "Welcome! Feel free to ask anything about electromagnetic waves."
        },
        '3d': { 
            nav: nav3dViewer, 
            panel: viewerPanel, 
            text: "Ask about the 3D model...",
            greeting: "Hi there! I'm ready to answer your questions about the 3D model."
        },
        'programming': { 
            nav: navProgramming, 
            panel: programmingPanel, 
            text: "Ask about Java basics...",
            greeting: "Ready to code? Ask me any questions you have about Java programming."
        }
    };

    Object.keys(tabMap).forEach(key => {
        const isTarget = key === tab;
        const currentElements = tabMap[key as TabKey];

        currentElements.nav?.classList.toggle('active', isTarget);
        currentElements.nav?.setAttribute('aria-pressed', isTarget.toString());
        currentElements.panel?.classList.toggle('active', isTarget);
    });

    // Start/stop EM wave animation
    if (tab === 'em') {
        startEMWaveAnimation();
    } else {
        stopEMWaveAnimation();
    }

    chatInput.placeholder = tabMap[tab].text;

    // Reset chat session for the new context
    resetChatSession();
    if (chatHistory) {
        chatHistory.innerHTML = '';
        addMessageToHistory(tabMap[tab].greeting, 'ai');
    }
    setChatLoading(false); // Ensure UI is responsive
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
function startEMWaveAnimation() {
    if (emWaveAnimationId === null) {
        lastEmWaveTimestamp = performance.now();
        emWaveAnimationId = requestAnimationFrame(animateEMWave);
    }
}

function stopEMWaveAnimation() {
    if (emWaveAnimationId !== null) {
        cancelAnimationFrame(emWaveAnimationId);
        emWaveAnimationId = null;
    }
}

function animateEMWave(timestamp: number) {
    const deltaTime = (timestamp - lastEmWaveTimestamp) / 1000; // seconds
    lastEmWaveTimestamp = timestamp;

    const wavePixelWidth = 400 - 40; // from drawWaves
    crestPosition += propagationSpeed * deltaTime;
    if (crestPosition > 20 + wavePixelWidth) {
        crestPosition = 20;
    }

    if (waveCrest) {
        waveCrest.setAttribute('x1', crestPosition.toString());
        waveCrest.setAttribute('x2', crestPosition.toString());
    }

    emWaveAnimationId = requestAnimationFrame(animateEMWave);
}

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
    if (!electricFieldPath || !magneticFieldPath || !wavelengthIndicator) return;

    const width = 400;
    const height = 200;
    const centerY = height / 2;
    const waveLengthPixels = width - 40;
    const steps = 200;

    let ePath = `M 20 ${centerY}`;
    let bPath = `M 20 ${centerY}`;

    for (let i = 0; i <= steps; i++) {
        const x = 20 + (i / steps) * waveLengthPixels;
        const angle = (i / steps) * (frequency / 2) * Math.PI * 2;
        
        const yE = centerY - Math.sin(angle) * amplitude;
        ePath += ` L ${x} ${yE}`;

        const yB = centerY - Math.cos(angle) * (amplitude * 0.5);
        const xB = x + Math.cos(angle) * 10;
        bPath += ` L ${xB} ${yB}`;
    }

    electricFieldPath.setAttribute('d', ePath);
    magneticFieldPath.setAttribute('d', bPath);

    // --- New Wavelength Indicator Logic ---
    const cycles = frequency / 2;
    const oneWavelengthInPixels = waveLengthPixels / cycles;

    if (oneWavelengthInPixels > 0 && isFinite(oneWavelengthInPixels) && oneWavelengthInPixels <= waveLengthPixels) {
         const indicatorLine = wavelengthIndicator.children[0] as SVGPathElement;
         const startTick = wavelengthIndicator.children[1] as SVGPathElement;
         const endTick = wavelengthIndicator.children[2] as SVGPathElement;
         const lambdaText = wavelengthIndicator.children[3] as SVGTextElement;

         const startX = 20;
         const endX = 20 + oneWavelengthInPixels;

         indicatorLine.setAttribute('d', `M ${startX} 120 L ${endX} 120`);
         startTick.setAttribute('d', `M ${startX} 115 L ${startX} 125`);
         endTick.setAttribute('d', `M ${endX} 115 L ${endX} 125`);
         lambdaText.setAttribute('x', (startX + endX / 2).toString());

         wavelengthIndicator.setAttribute('visibility', 'visible');
    } else {
         wavelengthIndicator.setAttribute('visibility', 'hidden');
    }
}

// --- Java Code Execution ---
async function handleRunCode() {
    if (!codeInput || !codeOutput || !outputLoader || !runCodeButton || !ai) return;

    const code = codeInput.value.trim();
    if (!code) {
        codeOutput.textContent = 'Please enter some code to run.';
        return;
    }

    outputLoader.classList.add('active');
    codeOutput.textContent = ''; // Clear previous output
    runCodeButton.disabled = true;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are a Java code execution engine.
Execute the following Java code and return ONLY the standard output.
Do not add any explanation, commentary, or markdown formatting like \`\`\`java or \`\`\`.
If there is a compilation or runtime error, return the exact error message.
If the code runs successfully but produces no output, return the text "[No output produced]".

Code to execute:
${code}
            `,
        });
        
        let output = response.text.trim();
        output = output.replace(/^```(java)?\n/i, '').replace(/\n```$/, '');
        codeOutput.textContent = output;

        // Check for common error indicators in the output.
        const isError = /error:|exception|failed|cannot find symbol|not a statement/i.test(output);

        if (isError) {
             // Automatically ask the AI tutor to explain the error.
            addMessageToHistory("I got an error running my code. Can you help me fix it?", 'user');
            
            const errorPrompt = `I'm a student learning Java. I wrote this code:\n\n\`\`\`java\n${code}\n\`\`\`\n\nWhen I ran it, I got this error message:\n\n\`\`\`\n${output}\n\`\`\`\n\nCan you explain what this error means in simple, beginner-friendly terms? What might be causing it, and how can I fix my code?`;
            
            askAI(errorPrompt);
        }

    } catch (error) {
        console.error("Error executing code:", error);
        const errorMessage = `An error occurred while trying to run the code. Please try again.\n\n${error.toString()}`;
        codeOutput.textContent = errorMessage;
        addMessageToHistory("Oops, something went wrong with the simulation itself. Can you help?", 'user');
        askAI(`The code execution simulation failed with this message: ${error.toString()}. What could this mean?`);
    } finally {
        outputLoader.classList.remove('active');
        runCodeButton.disabled = false;
    }
}


// --- Quiz Logic ---
function startQuiz() {
    navigateTo('quiz');
    
    quizPageTitle.textContent = "Test Your Knowledge";
    quizPageSubtitle.textContent = "Select a topic to begin!";
    
    quizTopicSelection.classList.remove('hidden');
    quizActiveSession.classList.add('hidden');
    quizResults.classList.add('hidden');
    
    quizTopicGrid.innerHTML = '';
    
    Object.keys(questionBank).forEach(key => {
        const moduleKey = key as ModuleKey;
        const data = moduleData[moduleKey];
        if (!data) return;

        const card = document.createElement('div');
        card.className = 'quiz-topic-card';
        card.innerHTML = `
            <div class="icon-wrapper quiz-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21.2,12.2c0.2-0.2,0.2-0.5,0-0.7l-2.2-2.2c-0.2-0.2-0.5-0.2-0.7,0l-1.1,1.1c-0.5-0.3-1-0.5-1.6-0.6l-0.2-1.4 c0-0.3-0.3-0.5-0.6-0.5h-3.2c-0.3,0-0.5,0.2-0.6,0.5l-0.2,1.4c-0.6,0.1-1.1,0.3-1.6,0.6l-1.1-1.1c-0.2-0.2-0.5-0.2-0.7,0 L5.1,9.2C4.9,9.4,4.9,9.7,5.1,9.9l1.1,1.1c-0.3,0.5-0.5,1-0.6,1.6l-1.4,0.2c-0.3,0-0.5,0.3-0.5,0.6v3.2c0,0.3,0.2,0.5,0.5,0.6 l1.4,0.2c0.1,0.6,0.3,1.1,0.6,1.6l-1.1,1.1c-0.2-0.2-0.2-0.5,0,0.7l2.2,2.2c0.2,0.2,0.5,0.2,0.7,0l1.1-1.1c0.5,0.3,1,0.5,1.6,0.6 l0.2,1.4c0,0.3,0.3,0.5,0.6,0.5h3.2c0.3,0,0.5-0.2,0.6,0.5l0.2-1.4c0.6-0.1,1.1-0.3,1.6-0.6l1.1,1.1c0.2,0.2,0.5,0.2,0.7,0 l2.2-2.2c0.2-0.2,0.2-0.5,0-0.7l-1.1-1.1c0.3-0.5,0.5-1,0.6-1.6l1.4,0.2c0.3,0,0.5-0.3,0.5-0.6v-3.2C21.8,12.5,21.5,12.2,21.2,12.2z M12,15.5c-1.9,0-3.5-1.6-3.5-3.5s1.6-3.5,3.5-3.5s3.5,1.6,3.5,3.5S13.9,15.5,12,15.5z"/></svg>
            </div>
            <h3>${data.title}</h3>
        `;
        card.addEventListener('click', () => startTopicalQuiz(moduleKey));
        quizTopicGrid.appendChild(card);
    });
}

function startTopicalQuiz(topic: ModuleKey) {
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    currentQuizTopic = topic;

    quizPageTitle.textContent = `${moduleData[topic].title} Quiz`;
    quizPageSubtitle.textContent = "Let's see what you know!";

    quizTopicSelection.classList.add('hidden');
    quizResults.classList.add('hidden');
    quizActiveSession.classList.remove('hidden');

    displayQuestion();
}


function displayQuestion() {
    if (!currentQuizTopic) return;
    quizState = 'answering';

    const questions = questionBank[currentQuizTopic];
    const currentQuestion = questions[currentQuestionIndex];
    quizQuestion.textContent = currentQuestion.question;
    quizProgress.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
    quizOptions.innerHTML = '';
    quizExplanation.classList.add('hidden');
    quizExplanation.textContent = '';

    currentQuestion.options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.classList.add('quiz-option');
        optionElement.innerHTML = `
            <input type="radio" id="option${index}" name="quiz-option" value="${index}">
            <label for="option${index}">${option}</label>
        `;
        quizOptions.appendChild(optionElement);
    });
    
    quizSubmitButton.textContent = "Check Answer";
}

function handleQuizAction() {
    if (quizState === 'answering') {
        handleCheckAnswer();
    } else {
        handleNextQuestion();
    }
}

function handleCheckAnswer() {
    const selectedOption = quizOptions.querySelector('input[name="quiz-option"]:checked') as HTMLInputElement;
    if (!selectedOption) {
        alert("Please select an answer.");
        return;
    }
    
    if (!currentQuizTopic) return;
    const questions = questionBank[currentQuizTopic];
    const currentQuestion = questions[currentQuestionIndex];
    const selectedAnswer = parseInt(selectedOption.value);
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    
    quizState = 'feedback';
    if (isCorrect) score++;

    userAnswers.push({
        question: currentQuestion.question,
        selected: selectedAnswer,
        correct: currentQuestion.correctAnswer,
        options: currentQuestion.options,
        explanation: currentQuestion.explanation
    });

    // Provide visual feedback
    const optionElements = quizOptions.querySelectorAll('.quiz-option');
    optionElements.forEach((opt, index) => {
        opt.classList.add('disabled');
        (opt.querySelector('input') as HTMLInputElement).disabled = true;

        if (index === currentQuestion.correctAnswer) {
            opt.classList.add('correct');
        }
        if (index === selectedAnswer && !isCorrect) {
            opt.classList.add('incorrect');
        }
    });

    quizExplanation.textContent = currentQuestion.explanation;
    quizExplanation.classList.remove('hidden');

    if (currentQuestionIndex === questions.length - 1) {
        quizSubmitButton.textContent = "Finish Quiz";
    } else {
        quizSubmitButton.textContent = "Next Question";
    }
}

function handleNextQuestion() {
    if (!currentQuizTopic) return;
    const questions = questionBank[currentQuizTopic];
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        displayQuestion();
    } else {
        showQuizResults();
    }
}

async function showQuizResults() {
    if (!currentQuizTopic) return;
    const questions = questionBank[currentQuizTopic];
    
    quizActiveSession.classList.add('hidden');
    quizResults.classList.remove('hidden');

    quizPageTitle.textContent = "Quiz Assessment";
    quizPageSubtitle.textContent = `Here's how you did on the ${moduleData[currentQuizTopic].title} quiz.`;
    
    quizScore.textContent = `You scored ${score} out of ${questions.length}!`;
    
    // ✨ NEW: Save quiz result to Firestore for leaderboard
    if (currentUser && db) {
        try {
            await addDoc(collection(db, 'quizResults'), {
                userId: currentUser.uid,
                userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous',
                score: score,
                topic: currentQuizTopic,
                timestamp: Date.now(),
                totalQuestions: questions.length,
                percentage: Math.round((score / questions.length) * 100)
            });
            console.log('✅ Quiz result saved to Firestore!');
        } catch (error) {
            console.error('❌ Error saving quiz result:', error);
        }
    }
    
    quizReviewList.innerHTML = '';
    userAnswers.forEach((answer, index) => {
        const reviewItem = document.createElement('div');
        reviewItem.className = 'review-item';

        const optionsHtml = answer.options.map((option, i) => {
            let className = '';
            if (i === answer.correct) {
                className = 'correct';
            } else if (i === answer.selected) {
                className = 'user-incorrect';
            }
            return `<div class="review-item-option ${className}">${option}</div>`;
        }).join('');

        reviewItem.innerHTML = `
            <p class="review-item-question">${index + 1}. ${answer.question}</p>
            <div class="review-item-options">${optionsHtml}</div>
            <p class="review-item-explanation">${answer.explanation}</p>
        `;
        quizReviewList.appendChild(reviewItem);
    });
}


// --- Review Session Logic ---
function startReviewSession() {
    navigateTo('review');

    // Reset state
    reviewQuestions = [];
    currentReviewQuestionIndex = 0;
    reviewScore = 0;
    reviewUserAnswers = [];
    reviewQuizState = 'answering';

    // Set UI to initial state
    reviewSummaryView.classList.remove('hidden');
    reviewActiveSession.classList.add('hidden');
    reviewResultsView.classList.add('hidden');
    reviewSummary.textContent = '';
    reviewStartQuizButton.classList.add('hidden');
    reviewSummaryLoader.classList.remove('hidden');
    reviewSummaryLoader.classList.add('active');

    generateReviewContent();
}

async function generateReviewContent() {
    if (!chat) return;
    try {
        const topics = ["DNA Base Pairing", "Ohm's Law", "Electron Shells in a Neon Atom", "Electromagnetic Waves", "The Planets of the Solar System", "Basic Java Syntax"];
        reviewTopic = topics[Math.floor(Math.random() * topics.length)];
        reviewTopicTitle.textContent = `Reviewing: ${reviewTopic}`;
        reviewPageSubtitle.textContent = `Let's reinforce your knowledge on ${reviewTopic}.`

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

async function generateAndStartReviewQuiz() {
    if (!ai) return;
    reviewSummaryView.classList.add('hidden');
    reviewActiveSession.classList.remove('hidden');
    reviewQuestion.textContent = 'Generating a new quiz...';
    reviewOptions.innerHTML = '';
    reviewSubmitButton.disabled = true;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a five-question multiple-choice quiz about "${reviewTopic}". Each question should test a key aspect of the concept. For each question, provide four plausible options, the 0-based index of the correct answer, and a brief explanation for the correct answer.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        quiz: {
                            type: Type.ARRAY,
                            description: "An array of 5 quiz questions.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    question: { type: Type.STRING },
                                    options: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING },
                                        description: "An array of four plausible answers."
                                    },
                                    correctAnswerIndex: { type: Type.INTEGER },
                                    explanation: { type: Type.STRING }
                                },
                                required: ["question", "options", "correctAnswerIndex", "explanation"]
                            }
                        }
                    },
                    required: ["quiz"]
                },
            },
        });

        const quizData = JSON.parse(response.text);

        if (!quizData.quiz || quizData.quiz.length < 5) {
             throw new Error("AI did not return a valid 5-question quiz.");
        }
        reviewQuestions = quizData.quiz;
        displayReviewQuestion();

    } catch (error) {
        console.error("Failed to generate review quiz:", error);
        reviewQuestion.textContent = "Sorry, I couldn't generate a quiz. Please try again.";
    } finally {
        reviewSubmitButton.disabled = false;
    }
}

function displayReviewQuestion() {
    reviewQuizState = 'answering';
    const currentQuestion = reviewQuestions[currentReviewQuestionIndex];

    reviewQuestion.textContent = currentQuestion.question;
    reviewProgress.textContent = `Question ${currentReviewQuestionIndex + 1} of ${reviewQuestions.length}`;
    reviewOptions.innerHTML = '';
    reviewExplanation.classList.add('hidden');
    reviewExplanation.textContent = '';

    currentQuestion.options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.classList.add('quiz-option');
        optionElement.innerHTML = `
            <input type="radio" id="review-option${index}" name="review-quiz-option" value="${index}">
            <label for="review-option${index}">${option}</label>
        `;
        reviewOptions.appendChild(optionElement);
    });
    
    reviewSubmitButton.textContent = "Check Answer";
    reviewSubmitButton.disabled = false;
}

function handleReviewAction() {
    if (reviewQuizState === 'answering') {
        handleCheckReviewAnswer();
    } else {
        handleNextReviewQuestion();
    }
}

function handleCheckReviewAnswer() {
    const selectedOption = reviewOptions.querySelector('input[name="review-quiz-option"]:checked') as HTMLInputElement;
    if (!selectedOption) {
        alert("Please select an answer.");
        return;
    }
    
    const currentQuestion = reviewQuestions[currentReviewQuestionIndex];
    const selectedAnswer = parseInt(selectedOption.value);
    const isCorrect = selectedAnswer === currentQuestion.correctAnswerIndex;
    
    reviewQuizState = 'feedback';
    if (isCorrect) reviewScore++;

    reviewUserAnswers.push({
        question: currentQuestion.question,
        selected: selectedAnswer,
        correct: currentQuestion.correctAnswerIndex,
        options: currentQuestion.options,
        explanation: currentQuestion.explanation
    });

    // Provide visual feedback
    const optionElements = reviewOptions.querySelectorAll('.quiz-option');
    optionElements.forEach((opt, index) => {
        opt.classList.add('disabled');
        (opt.querySelector('input') as HTMLInputElement).disabled = true;

        if (index === currentQuestion.correctAnswerIndex) {
            opt.classList.add('correct');
        }
        if (index === selectedAnswer && !isCorrect) {
            opt.classList.add('incorrect');
        }
    });

    reviewExplanation.textContent = currentQuestion.explanation;
    reviewExplanation.classList.remove('hidden');

    if (currentReviewQuestionIndex === reviewQuestions.length - 1) {
        reviewSubmitButton.textContent = "Finish Review";
    } else {
        reviewSubmitButton.textContent = "Next Question";
    }
}

function handleNextReviewQuestion() {
    currentReviewQuestionIndex++;
    if (currentReviewQuestionIndex < reviewQuestions.length) {
        displayReviewQuestion();
    } else {
        showReviewResults();
    }
}

function showReviewResults() {
    reviewActiveSession.classList.add('hidden');
    reviewResultsView.classList.remove('hidden');

    reviewPageSubtitle.textContent = `Here's how you did on the ${reviewTopic} review.`;
    
    // FIX: Use the renamed DOM element variable 'reviewScoreEl'.
    reviewScoreEl.textContent = `You scored ${reviewScore} out of ${reviewQuestions.length}!`;
    
    reviewReviewList.innerHTML = '';
    reviewUserAnswers.forEach((answer, index) => {
        const reviewItem = document.createElement('div');
        reviewItem.className = 'review-item';

        const optionsHtml = answer.options.map((option, i) => {
            let className = '';
            if (i === answer.correct) {
                className = 'correct';
            } else if (i === answer.selected) {
                className = 'user-incorrect';
            }
            return `<div class="review-item-option ${className}">${option}</div>`;
        }).join('');

        reviewItem.innerHTML = `
            <p class="review-item-question">${index + 1}. ${answer.question}</p>
            <div class="review-item-options">${optionsHtml}</div>
            <p class="review-item-explanation">${answer.explanation}</p>
        `;
        reviewReviewList.appendChild(reviewItem);
    });
}


// --- Chat & AI Logic ---
function onObjectSelected(name: string) {
    if (!name) return;
    addMessageToHistory(`You clicked on ${name}.`, 'user');
    askAI(`Tell me about ${name}.`);
}


async function askAI(prompt: string) {
    if (!chat) return;
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

// --- Leaderboard Logic ---
interface LeaderboardEntry {
    userId: string;
    totalScore: number;
}

interface Leaderboard {
    generatedAt: number;
    entries: LeaderboardEntry[];
}

async function loadLeaderboard() {
    try {
        leaderboardList.innerHTML = `
            <div class="leaderboard-loading">
                <div class="spinner"></div>
                <p>Loading leaderboard...</p>
            </div>
        `;

        const response = await fetch('/leaderboard/latest');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const leaderboard: Leaderboard = await response.json();

        if (leaderboard.entries.length === 0) {
            leaderboardList.innerHTML = `
                <div class="leaderboard-empty">
                    <p>No leaderboard data available yet.</p>
                    <p>Complete quizzes to appear on the leaderboard!</p>
                </div>
            `;
            return;
        }

        leaderboardList.innerHTML = '';
        leaderboard.entries.forEach((entry, index) => {
            const rank = index + 1;
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            
            let rankClass = '';
            if (rank === 1) rankClass = 'top-1';
            else if (rank === 2) rankClass = 'top-2';
            else if (rank === 3) rankClass = 'top-3';

            item.innerHTML = `
                <div class="leaderboard-rank ${rankClass}">#${rank}</div>
                <div class="leaderboard-user">${entry.userId}</div>
                <div class="leaderboard-score">${entry.totalScore}</div>
            `;
            
            leaderboardList.appendChild(item);
        });

    } catch (error) {
        console.error('Error loading leaderboard:', error);
        leaderboardList.innerHTML = `
            <div class="leaderboard-empty">
                <p>Unable to load leaderboard.</p>
                <p>Make sure the leaderboard service is running.</p>
            </div>
        `;
    }
}

// --- Profile Page Logic ---
function shuffleArray(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- Error Handling ---
function handleFatalError(message: string) {
    // Hide all main content and show a dedicated error screen
    document.body.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px;">
             <div class="error-card" style="max-width: 600px; text-align: left;">${message}</div>
        </div>
    `;
    // Add some styles for the dynamically created error card for better appearance
    const style = document.createElement('style');
    style.textContent = `
        .error-card { 
            background-color: var(--card-bg-color); 
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 2.5rem;
        }
        .error-card code {
            background-color: var(--bg-color);
            padding: 0.2em 0.4em;
            border-radius: 4px;
            font-family: monospace;
        }
    `;
    document.head.appendChild(style);
}

// --- Start the App ---
initializeApp();
