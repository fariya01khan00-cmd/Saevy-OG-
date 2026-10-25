import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../config/api';
import { AppSettings, FemaleAiVoiceId, MainTab, UserProfile } from '../types';
import { SIX_FEMALE_AI_VOICES } from '../data/demoData';
import {
  isSpeechRecognitionSupported,
  stopAllSpeechSynthesis,
  useSingleShotSpeechInput,
} from '../utils/speechCoordinator';

export interface SupportedAiLanguage {
  code: string;
  recLang: string;
  name: string;
  nativeName: string;
  flag: string;
  samplePrompt: string;
}

export const MULTILINGUAL_AI_LANGUAGES: SupportedAiLanguage[] = [
  {
    code: 'en',
    recLang: 'en-US',
    name: 'English',
    nativeName: 'English',
    flag: '🌐',
    samplePrompt: 'Find nearest safe spot and measure walking distance',
  },
  {
    code: 'hi',
    recLang: 'hi-IN',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    samplePrompt: 'निकटतम सुरक्षित स्थान खोजें और पैदल दूरी बताएं',
  },
  {
    code: 'es',
    recLang: 'es-ES',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    samplePrompt: 'Encuentra un lugar seguro y calcula la distancia a pie',
  },
  {
    code: 'fr',
    recLang: 'fr-FR',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    samplePrompt: 'Trouvez un endroit sûr et calculez la distance à pied',
  },
  {
    code: 'ar',
    recLang: 'ar-SA',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    samplePrompt: 'ابحث عن أقرب مكان آمن واحسب مسافة المشي',
  },
  {
    code: 'bn',
    recLang: 'bn-IN',
    name: 'Bengali',
    nativeName: 'বাংলা',
    flag: '🇮🇳',
    samplePrompt: 'নিকটতম নিরাপদ স্থান খুঁজুন এবং হাঁটার দূরত্ব বলুন',
  },
  {
    code: 'mr',
    recLang: 'mr-IN',
    name: 'Marathi',
    nativeName: 'मराठी',
    flag: '🇮🇳',
    samplePrompt: 'जवळचे सुरक्षित ठिकाण शोधा आणि चालण्याचे अंतर सांगा',
  },
  {
    code: 'te',
    recLang: 'te-IN',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    flag: '🇮🇳',
    samplePrompt: 'సమీపంలోని సురక్షిత ప్రాంతాన్ని కనుగొనండి',
  },
  {
    code: 'ta',
    recLang: 'ta-IN',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    flag: '🇮🇳',
    samplePrompt: 'அருகிலுள்ள பாதுகாப்பான இடத்தை கண்டுபிடி',
  },
  {
    code: 'gu',
    recLang: 'gu-IN',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    flag: '🇮🇳',
    samplePrompt: 'નજીકનું સુરક્ષિત સ્થાન શોધો અને ચાલવાનું અંતર કહો',
  },
  {
    code: 'de',
    recLang: 'de-DE',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    samplePrompt: 'Finde einen sicheren Ort und berechne die Gehdistanz',
  },
  {
    code: 'ja',
    recLang: 'ja-JP',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    samplePrompt: '最も近い安全な場所を見つけて徒歩距離を計算してください',
  },
];

type SaevyAiMode =
  | 'image_studio'
  | 'voice_dialogue'
  | 'threejs_3d'
  | 'bioscience'
  | 'music_calm'
  | 'google_search';

interface SaevyAiViewProps {
  isHi: boolean;
  settings: AppSettings;
  profile: UserProfile;
  onShowToast: (msg: string) => void;
  onNavigateTab?: (tab: MainTab) => void;
  onTriggerSos?: () => void;
}

export const SaevyAiView: React.FC<SaevyAiViewProps> = ({
  isHi,
  settings,
  profile,
  onShowToast,
  onNavigateTab,
  onTriggerSos,
}) => {
  const [activeMode, setActiveMode] = useState<SaevyAiMode>('voice_dialogue');

  // Multilingual State for Voice Dialogue & Spoken AI
  const [selectedAiLangCode, setSelectedAiLangCode] = useState<string>(isHi ? 'hi' : 'en');
  const [lastExecutedCommand, setLastExecutedCommand] = useState<string | null>(null);
  const [isSpeakingAudio, setIsSpeakingAudio] = useState(false);

  // 1. Image Studio & Animation State
  const [imagePrompt, setImagePrompt] = useState(
    'Golden geometric sanctuary shield glowing in midnight twilight'
  );
  const [imageStyle, setImageStyle] = useState('sanctuary_art');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{
    title: string;
    description: string;
    svg: string;
    tags: string[];
  } | null>({
    title: 'Nocturne Protection Seal',
    description: 'Bespoke golden sanctuary emblem symbolizing sovereignty, vigilance, and safety.',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%"><defs><linearGradient id="seal" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1B142E"/><stop offset="100%" stop-color="#0E0A18"/></linearGradient><linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FCE082"/><stop offset="100%" stop-color="#B8860B"/></linearGradient></defs><rect width="400" height="400" rx="36" fill="url(#seal)"/><circle cx="200" cy="180" r="90" fill="none" stroke="url(#gold)" stroke-width="2.5" stroke-dasharray="8 6"/><path d="M200 110 L250 145 L250 215 L200 250 L150 215 L150 145 Z" fill="none" stroke="url(#gold)" stroke-width="2"/><circle cx="200" cy="180" r="30" fill="url(#gold)" opacity="0.3"/><text x="200" y="320" text-anchor="middle" fill="#F5EFE6" font-family="serif" font-size="18" font-weight="600" letter-spacing="1">SAEVY SANCTUARY SHIELD</text><text x="200" y="348" text-anchor="middle" fill="#D4AF37" font-family="sans-serif" font-size="11" letter-spacing="3">AI GENERATED EMBLEM</text></svg>`,
    tags: ['Sanctuary', 'Golden Seal', 'Protection', 'Vigilance'],
  });
  const [isAnimatingVideo, setIsAnimatingVideo] = useState(false);
  const [videoFrame, setVideoFrame] = useState(0);

  // 2. Voice Dialogue State
  const [voiceInputText, setVoiceInputText] = useState('');
  const [aiVoiceReply, setAiVoiceReply] = useState(
    'Hello, I am Saevy AI. I can listen to your voice commands and speak with you fluently in multiple languages. How may I assist you with personal safety, walking directions, or wellness today?'
  );
  const [isVoiceThinking, setIsVoiceThinking] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<FemaleAiVoiceId>(
    settings.selectedFemaleVoiceId || 'kavya'
  );

  // 3. Three.js Canvas State
  const threeMountRef = useRef<HTMLDivElement | null>(null);
  const [threeRunning, setThreeRunning] = useState(true);
  const [shieldColor, setShieldColor] = useState<'gold' | 'rose' | 'emerald'>('gold');

  // 4. Bioscience Doctor Guidance State
  const [symptomQuery, setSymptomQuery] = useState('Excess water retention vs proper hydration');
  const [bioscienceAdvice, setBioscienceAdvice] = useState<{
    topic: string;
    cellularSummary: string;
    doctorChecklist: string[];
    remedySteps: string[];
    redFlags: string[];
  }>({
    topic: 'Fluid Balance & Excess Water Dynamics',
    cellularSummary:
      'Water balance in the body is regulated by osmotic pressure, aldosterone, and antidiuretic hormone (ADH). Excess fluid retention (edema) occurs when sodium balance shifts or circulation slows down, whereas intracellular dehydration causes fatigue and dizziness.',
    doctorChecklist: [
      'Daily baseline intake: 2.2L to 2.8L for healthy adults under normal climate.',
      'Check ankles and wrists in the evening for pit retention (leaves indentation when pressed).',
      'Maintain potassium intake (bananas, coconut water) to balance excess sodium.',
      'Elevate feet 15–20 minutes after long standing or transit.',
    ],
    remedySteps: [
      'Gentle warm fennel (saunf) and cumin (jeera) water to facilitate safe kidney filtration.',
      'Reduce processed sodium and refined sugars during pre-menstrual water-retention days.',
      'Practice 10-minute diaphragmatic breathing to enhance lymphatic drainage.',
    ],
    redFlags: [
      'Sudden swelling of face or eyes with short breath (requires emergency hospital visit).',
      'Persistent one-sided leg calf swelling or severe tenderness.',
    ],
  });

  // 5. Calming Music & Frequency Synthesizer State
  const [activeFrequency, setActiveFrequency] = useState<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscNodeRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // 6. Google Search Grounding State
  const [searchQuery, setSearchQuery] = useState('Zero FIR rules and women helpline in India');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    summary: string;
    facts: string[];
    checklist: string[];
  } | null>({
    summary:
      'Under Indian law (Section 173 BNSS / formerly CrPC), a Zero-FIR can be registered at ANY police station regardless of jurisdiction when a cognizable offense occurs against a woman.',
    facts: [
      '112: Unified National Emergency Number (Police, Fire, Ambulance).',
      '181: 24/7 Women Helpline for crisis intervention and rescue.',
      '1091: Dedicated Women in Distress patrol unit dispatch.',
      '1930: National Cyber Fraud & Digital Harassment Reporting.',
    ],
    checklist: [
      'Demand a free copy of the registered Zero-FIR with stamp and GD entry number.',
      'Female officers must record statements in sensitive cases under legal mandates.',
      'Free legal aid is provided via District Legal Services Authorities (DLSA).',
    ],
  });

  // Handle Image Generation
  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePrompt.trim()) return;
    setGeneratingImage(true);
    try {
      const res = await apiFetch('/api/ai/saevy-generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt, style: imageStyle }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedResult({
          title: data.title || imagePrompt.slice(0, 30),
          description: data.description || 'Custom generated sanctuary art.',
          svg: data.svg || '',
          tags: data.tags || ['Saevy AI', 'Custom'],
        });
        onShowToast('Saevy AI created your custom visual artwork.');
      }
    } catch {
      onShowToast('Could not generate artwork right now.');
    } finally {
      setGeneratingImage(false);
    }
  };

  // Animate Image to Video Simulation
  useEffect(() => {
    let interval: number | null = null;
    if (isAnimatingVideo) {
      interval = window.setInterval(() => {
        setVideoFrame((prev) => (prev + 1) % 6);
      }, 550);
    } else {
      setVideoFrame(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAnimatingVideo]);

  const selectedAiLanguage = useMemo(() => {
    return (
      MULTILINGUAL_AI_LANGUAGES.find((l) => l.code === selectedAiLangCode) ||
      MULTILINGUAL_AI_LANGUAGES[0]
    );
  }, [selectedAiLangCode]);

  const speakMultilingualReply = useCallback(
    async (
      textToSpeak: string,
      langObj: SupportedAiLanguage,
      voiceObj: (typeof SIX_FEMALE_AI_VOICES)[0]
    ) => {
      setIsSpeakingAudio(true);
      stopAllSpeechSynthesis();

      // 1. Try server-side Gemini 3.8 Flash-Lite TTS
      let playedServerAudio = false;
      try {
        const ttsRes = await apiFetch('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: textToSpeak.slice(0, 350),
            geminiVoiceName: voiceObj.geminiVoiceName,
            speechStyle: voiceObj.speechStyle,
          }),
        });
        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          if (ttsData?.audioDataUrl) {
            const audio = new Audio(ttsData.audioDataUrl);
            audio.onended = () => setIsSpeakingAudio(false);
            audio.onerror = () => setIsSpeakingAudio(false);
            await audio.play();
            playedServerAudio = true;
          }
        }
      } catch {
        playedServerAudio = false;
      }

      // 2. Seamless native Web Speech Synthesis in selected language if server TTS not played
      if (!playedServerAudio && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const clean = textToSpeak.replace(/[*#_`]/g, '').slice(0, 320);
          const utterance = new SpeechSynthesisUtterance(clean);
          utterance.lang = langObj.recLang;
          utterance.rate = 0.98;
          utterance.pitch = 1.05;

          const voices = window.speechSynthesis.getVoices();
          const match = voices.find(
            (v) =>
              v.lang.toLowerCase().startsWith(langObj.code) ||
              v.lang
                .toLowerCase()
                .replace('_', '-')
                .startsWith(langObj.recLang.toLowerCase().slice(0, 2))
          );
          if (match) utterance.voice = match;

          utterance.onend = () => setIsSpeakingAudio(false);
          utterance.onerror = () => setIsSpeakingAudio(false);
          window.speechSynthesis.speak(utterance);
        } catch {
          setIsSpeakingAudio(false);
        }
      }
    },
    []
  );

  // Dynamic Multilingual Voice Interaction Hook
  const voiceInput = useSingleShotSpeechInput({
    recognitionLang: selectedAiLanguage.recLang,
    uiLang: selectedAiLanguage.code === 'hi' ? 'hi' : 'en',
    onTranscript: (text) => {
      setVoiceInputText(text);
      void handleExecuteVoiceCommandOrQuery(text);
    },
  });

  // Smart Voice Command Parser
  const parseVoiceCommand = useCallback(
    (rawText: string): { isCommand: boolean; actionName?: string; replyText?: string } => {
      const lower = rawText.toLowerCase();

      // Command: Nearest safe spot
      if (
        lower.includes('safe spot') ||
        lower.includes('सुरक्षित स्थान') ||
        lower.includes('surakshit') ||
        lower.includes('police booth') ||
        lower.includes('lugar seguro') ||
        lower.includes('endroit sûr') ||
        lower.includes('مكان آمن') ||
        lower.includes('নিরাপদ')
      ) {
        if (onNavigateTab) onNavigateTab('haven');
        return {
          isCommand: true,
          actionName: 'Locate Nearest Safe Spot',
          replyText:
            selectedAiLanguage.code === 'hi'
              ? 'मैंने निकटतम सुरक्षित सार्वजनिक स्थान खोज लिया है और आपका सुरक्षित मार्ग मानचित्र पर खोल दिया है।'
              : selectedAiLanguage.code === 'es'
                ? 'Localizando el lugar seguro verificado más cercano y abriendo ruta segura en el mapa GPS.'
                : selectedAiLanguage.code === 'fr'
                  ? 'Localisation du point de sécurité le plus proche et affichage de votre itinéraire sécurisé.'
                  : selectedAiLanguage.code === 'ar'
                    ? 'جاري تحديد أقرب نقطة أمان عامة والمسار الآمن على الخريطة.'
                    : 'Locating the nearest verified crowded safe spot and displaying your safe route on GPS.',
        };
      }

      // Command: Measure walking distance
      if (
        lower.includes('walking distance') ||
        lower.includes('walk distance') ||
        lower.includes('calculate walk') ||
        lower.includes('पैदल दूरी') ||
        lower.includes('paidal') ||
        lower.includes('distancia a pie') ||
        lower.includes('distance à pied') ||
        lower.includes('مسافة المشي') ||
        lower.includes('steps') ||
        lower.includes('हॉकिंग')
      ) {
        if (onNavigateTab) onNavigateTab('haven');
        return {
          isCommand: true,
          actionName: 'Measure Walking Distance Tool',
          replyText:
            selectedAiLanguage.code === 'hi'
              ? 'पैदल दूरी टूल सक्रिय है। अपने जीपीएस स्थान से दूरी और कदमों की गणना के लिए मानचित्र पर किसी भी बिंदु पर टैप करें।'
              : selectedAiLanguage.code === 'es'
                ? 'Herramienta de distancia a pie activada. Toca cualquier punto en el mapa para calcular distancia y pasos.'
                : selectedAiLanguage.code === 'fr'
                  ? 'Outil de distance à pied activé. Touchez un point sur la carte pour mesurer la distance de marche.'
                  : selectedAiLanguage.code === 'ar'
                    ? 'تم تفعيل أداة حساب مسافة المشي. اضغط على أي نقطة على الخريطة لحساب المسافة والخطوات.'
                    : 'Walking distance tool activated. Tap any point on the map to measure walking distance and steps from your GPS pin.',
        };
      }

      // Command: Find FedEx / Courier
      if (
        lower.includes('fedex') ||
        lower.includes('courier') ||
        lower.includes('फेडेक्स') ||
        lower.includes('कूरियर') ||
        lower.includes('locker')
      ) {
        if (onNavigateTab) onNavigateTab('haven');
        return {
          isCommand: true,
          actionName: 'Find FedEx Safe Hub',
          replyText:
            selectedAiLanguage.code === 'hi'
              ? '24/7 सीसीटीवी और सुरक्षा निगरानी वाले फेडेक्स व कूरियर सेफ स्पॉट खोजे जा रहे हैं।'
              : selectedAiLanguage.code === 'es'
                ? 'Buscando centros FedEx y puntos de mensajería vigilados las 24 horas cerca de ti.'
                : 'Locating 24/7 monitored FedEx ship centers and courier safety hubs near you.',
        };
      }

      // Command: Excess water or hydration
      if (
        lower.includes('excess water') ||
        lower.includes('water check') ||
        lower.includes('hydration') ||
        lower.includes('पानी की जांच') ||
        lower.includes('retention') ||
        lower.includes('agua') ||
        lower.includes('eau') ||
        lower.includes('ماء')
      ) {
        if (onNavigateTab) onNavigateTab('haven');
        return {
          isCommand: true,
          actionName: 'Excess Water & Hydration Check',
          replyText:
            selectedAiLanguage.code === 'hi'
              ? 'अतिरिक्त पानी और शारीरिक तरल संतुलन की पुष्टि जांच खोली जा रही है।'
              : selectedAiLanguage.code === 'es'
                ? 'Abriendo confirmación de balance hídrico y retención de líquidos.'
                : 'Opening excess water retention and cellular hydration balance confirmation check.',
        };
      }

      // Command: Emergency SOS
      if (
        lower.includes('sos') ||
        lower.includes('emergency') ||
        lower.includes('help me') ||
        lower.includes('बचाओ') ||
        lower.includes('मदद') ||
        lower.includes('ayuda') ||
        lower.includes('urgence') ||
        lower.includes('طوارئ')
      ) {
        if (onTriggerSos) onTriggerSos();
        return {
          isCommand: true,
          actionName: 'Emergency SOS Alert',
          replyText:
            selectedAiLanguage.code === 'hi'
              ? 'आपातकालीन एसओएस प्रोटोकॉल सक्रिय है। शांत रहें और अच्छी रोशनी वाले सार्वजनिक स्थान पर रहें।'
              : selectedAiLanguage.code === 'es'
                ? 'Protocolo de emergencia SOS activo. Permanece en lugares iluminados con gente.'
                : 'Emergency SOS protocols standing by. Stay calm, move toward staffed public areas, and prepare to alert contacts.',
        };
      }

      return { isCommand: false };
    },
    [onNavigateTab, onTriggerSos, selectedAiLanguage]
  );

  const handleExecuteVoiceCommandOrQuery = async (queryText: string) => {
    const clean = queryText.trim();
    if (!clean) return;

    const voiceObj =
      SIX_FEMALE_AI_VOICES.find((v) => v.id === selectedVoiceId) || SIX_FEMALE_AI_VOICES[0];

    // Check if query is an actionable voice command
    const cmdResult = parseVoiceCommand(clean);
    if (cmdResult.isCommand && cmdResult.replyText) {
      setLastExecutedCommand(cmdResult.actionName || 'Command Executed');
      setAiVoiceReply(cmdResult.replyText);
      onShowToast(`⚡ Voice Command Executed: ${cmdResult.actionName}`);
      void speakMultilingualReply(cmdResult.replyText, selectedAiLanguage, voiceObj);
      return;
    }

    // Otherwise, execute natural multilingual AI conversational reasoning
    setIsVoiceThinking(true);
    setLastExecutedCommand(null);

    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', text: clean }],
          language: selectedAiLanguage.code,
          languageName: selectedAiLanguage.name,
          voicePersona: {
            name: voiceObj.name,
            role: voiceObj.role,
            tone: voiceObj.tone,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply = String(data.reply || '');
        setAiVoiceReply(reply);
        void speakMultilingualReply(reply, selectedAiLanguage, voiceObj);
      }
    } catch {
      onShowToast('Voice assistant unavailable right now.');
    } finally {
      setIsVoiceThinking(false);
    }
  };

  // Google Search Grounding Request
  const handleExecuteSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await apiFetch('/api/ai/search-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResult({
          summary: data.summary || '',
          facts: data.verifiedFacts || [],
          checklist: data.actionableChecklist || [],
        });
        onShowToast('Retrieved verified safety knowledge.');
      }
    } catch {
      onShowToast('Knowledge search unavailable right now.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Web Audio Calming Music / Frequency Synthesizer
  const toggleCalmFrequency = (hz: number) => {
    if (activeFrequency === hz) {
      if (oscNodeRef.current) {
        try {
          oscNodeRef.current.stop();
          oscNodeRef.current.disconnect();
        } catch {}
        oscNodeRef.current = null;
      }
      setActiveFrequency(null);
      return;
    }

    if (oscNodeRef.current) {
      try {
        oscNodeRef.current.stop();
        oscNodeRef.current.disconnect();
      } catch {}
    }

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      if (audioCtxRef.current.state === 'suspended') {
        void audioCtxRef.current.resume();
      }

      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz, audioCtxRef.current.currentTime);

      gain.gain.setValueAtTime(0.01, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audioCtxRef.current.currentTime + 1.5);

      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();

      oscNodeRef.current = osc;
      gainNodeRef.current = gain;
      setActiveFrequency(hz);
      onShowToast(`Playing ${hz} Hz therapeutic calming tone`);
    } catch {
      onShowToast('Audio synthesis not supported on this browser.');
    }
  };

  useEffect(() => {
    return () => {
      if (oscNodeRef.current) {
        try {
          oscNodeRef.current.stop();
          oscNodeRef.current.disconnect();
        } catch {}
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Three.js 3D Quantum Sanctuary Orb Scene
  useEffect(() => {
    if (activeMode !== 'threejs_3d' || !threeMountRef.current) return;

    const container = threeMountRef.current;
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 340;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 4.8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Color definitions
    const primaryHex =
      shieldColor === 'gold' ? 0xd4af37 : shieldColor === 'rose' ? 0xb76e79 : 0x34d399;

    // Group for entire rotating orb
    const group = new THREE.Group();
    scene.add(group);

    // Inner Dodecahedron (Core)
    const innerGeo = new THREE.DodecahedronGeometry(1.1, 1);
    const innerMat = new THREE.MeshStandardMaterial({
      color: primaryHex,
      wireframe: true,
      roughness: 0.2,
      metalness: 0.8,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    group.add(innerMesh);

    // Middle Torus Ring
    const torusGeo = new THREE.TorusGeometry(1.6, 0.04, 16, 100);
    const torusMat = new THREE.MeshBasicMaterial({ color: 0xf5efe6 });
    const torusMesh = new THREE.Mesh(torusGeo, torusMat);
    torusMesh.rotation.x = Math.PI / 3;
    group.add(torusMesh);

    // Outer Star Particles
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      const r = 1.9 + Math.random() * 0.9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      posArray[i] = r * Math.sin(phi) * Math.cos(theta);
      posArray[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      posArray[i + 2] = r * Math.cos(phi);
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.045,
      color: primaryHex,
      transparent: true,
      opacity: 0.85,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    group.add(particles);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);

    const pointLight = new THREE.PointLight(primaryHex, 2.5, 50);
    pointLight.position.set(3, 4, 3);
    scene.add(pointLight);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (threeRunning) {
        group.rotation.y += 0.007;
        group.rotation.x += 0.004;
        torusMesh.rotation.z += 0.008;
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      torusGeo.dispose();
      torusMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [activeMode, threeRunning, shieldColor]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. HERO HEADER */}
      <div className="rounded-[28px] bg-gradient-to-br from-[#1B142E] via-[#141022] to-[#0A0714] border border-[#D4AF37]/35 p-6 sm:p-8 text-[#F5EFE6] relative overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#D4AF37]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
              <span>Saevy AI Neural Guardian · Active</span>
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight">
              Saevy AI Multimodal Intelligence
            </h1>
            <p className="text-xs sm:text-sm text-[#B9AEBE] leading-relaxed">
              Equipped with Image Generation & Editing, Live Voice Dialogues, 3D WebGL Shields,
              Bioscience Doctor Guidance, Google Search Grounding, and Calming Audio Waves.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#D4AF37] font-medium">Model:</span>
            <span className="px-3 py-1 rounded-full bg-[#231A38] border border-[#3E2E5D] text-xs font-mono text-[#F5EFE6]">
              gemini-3.8-flash · multimodal
            </span>
          </div>
        </div>

        {/* MODE SELECTOR BUTTONS */}
        <div className="relative z-10 mt-6 pt-5 border-t border-[#2B233F] flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveMode('image_studio')}
            className={`min-h-[44px] px-4 rounded-full text-xs font-medium flex items-center gap-2 shrink-0 transition-all ${
              activeMode === 'image_studio'
                ? 'bg-[#D4AF37] text-[#0A0A0A] font-semibold shadow-[0_6px_20px_rgba(212,175,55,0.3)]'
                : 'bg-[#1D172E] text-[#B9AEBE] hover:text-[#F5EFE6] border border-[#2F2548]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">palette</span>
            <span>Image Studio & Video</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('voice_dialogue')}
            className={`min-h-[44px] px-4 rounded-full text-xs font-medium flex items-center gap-2 shrink-0 transition-all ${
              activeMode === 'voice_dialogue'
                ? 'bg-[#D4AF37] text-[#0A0A0A] font-semibold shadow-[0_6px_20px_rgba(212,175,55,0.3)]'
                : 'bg-[#1D172E] text-[#B9AEBE] hover:text-[#F5EFE6] border border-[#2F2548]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">record_voice_over</span>
            <span>Voice Conversations</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('threejs_3d')}
            className={`min-h-[44px] px-4 rounded-full text-xs font-medium flex items-center gap-2 shrink-0 transition-all ${
              activeMode === 'threejs_3d'
                ? 'bg-[#D4AF37] text-[#0A0A0A] font-semibold shadow-[0_6px_20px_rgba(212,175,55,0.3)]'
                : 'bg-[#1D172E] text-[#B9AEBE] hover:text-[#F5EFE6] border border-[#2F2548]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">view_in_ar</span>
            <span>3D Shield Scene</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('bioscience')}
            className={`min-h-[44px] px-4 rounded-full text-xs font-medium flex items-center gap-2 shrink-0 transition-all ${
              activeMode === 'bioscience'
                ? 'bg-[#D4AF37] text-[#0A0A0A] font-semibold shadow-[0_6px_20px_rgba(212,175,55,0.3)]'
                : 'bg-[#1D172E] text-[#B9AEBE] hover:text-[#F5EFE6] border border-[#2F2548]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">biotech</span>
            <span>Doctor Bioscience</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('music_calm')}
            className={`min-h-[44px] px-4 rounded-full text-xs font-medium flex items-center gap-2 shrink-0 transition-all ${
              activeMode === 'music_calm'
                ? 'bg-[#D4AF37] text-[#0A0A0A] font-semibold shadow-[0_6px_20px_rgba(212,175,55,0.3)]'
                : 'bg-[#1D172E] text-[#B9AEBE] hover:text-[#F5EFE6] border border-[#2F2548]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">music_note</span>
            <span>Calming Audio Tones</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('google_search')}
            className={`min-h-[44px] px-4 rounded-full text-xs font-medium flex items-center gap-2 shrink-0 transition-all ${
              activeMode === 'google_search'
                ? 'bg-[#D4AF37] text-[#0A0A0A] font-semibold shadow-[0_6px_20px_rgba(212,175,55,0.3)]'
                : 'bg-[#1D172E] text-[#B9AEBE] hover:text-[#F5EFE6] border border-[#2F2548]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">travel_explore</span>
            <span>Google Search Data</span>
          </button>
        </div>
      </div>

      {/* 2. MODE CONTENT PANELS */}
      <AnimatePresence mode="wait">
        {/* MODE A: IMAGE STUDIO & VIDEO ANIMATION */}
        {activeMode === 'image_studio' && (
          <motion.div
            key="image_studio"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            <div className="lg:col-span-5 luxury-card p-6 space-y-5">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0A0A0A]">
                  Saevy Visual & Image Generator
                </h3>
                <p className="text-xs text-[#5C544E] mt-0.5">
                  Describe any visual concept, safety poster, or empowerment motif.
                </p>
              </div>

              <form onSubmit={handleGenerateImage} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                    Image Prompt
                  </label>
                  <textarea
                    rows={3}
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="e.g. Elegant geometric protection shield with celestial gold lines..."
                    className="w-full p-3.5 rounded-2xl bg-[#FFFCF8] border border-[#F0E6DC] text-xs sm:text-sm text-[#0A0A0A] focus:outline-none focus:border-[#D4AF37] leading-relaxed resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                      Aesthetic Style
                    </label>
                    <select
                      value={imageStyle}
                      onChange={(e) => setImageStyle(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-full bg-[#FFFCF8] border border-[#F0E6DC] text-xs text-[#0A0A0A] focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="sanctuary_art">Luxury Sanctuary Art</option>
                      <option value="cyber_shield">Cyber Shield & Emblem</option>
                      <option value="botanical_wellness">Botanical Doctor Wellness</option>
                      <option value="minimal_editorial">Minimal Haute Editorial</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">Format</label>
                    <div className="min-h-[42px] px-3.5 rounded-full bg-[#FFFCF8] border border-[#F0E6DC] text-xs text-[#5C544E] flex items-center justify-between">
                      <span>Vector SVG + Canvas</span>
                      <span className="text-[#3E6B4E] font-semibold">Ready</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generatingImage}
                  className="btn-luxury w-full text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#D4AF37]">
                    auto_awesome
                  </span>
                  <span>{generatingImage ? 'Generating Artwork...' : 'Generate with Saevy AI'}</span>
                </button>
              </form>

              <div className="pt-2 border-t border-[#F0E6DC] space-y-2">
                <span className="text-xs font-semibold text-[#0A0A0A]">
                  Preset Creative Prompts:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Golden Lotus of Protection in Midnight Rain',
                    'Empowered Woman Zero-FIR Shield Poster',
                    'Cellular Hydration Osmotic Balance Diagram',
                    'Safe Transit Corridor with Illuminated Checkpoints',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setImagePrompt(preset)}
                      className="px-3 py-1.5 rounded-full bg-[#FAF1E6] hover:bg-[#F3E6D6] text-[11px] text-[#5C544E] text-left transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generated Art Display & Video Animation */}
            <div className="lg:col-span-7 luxury-card p-6 flex flex-col justify-between space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#0A0A0A]">
                    {generatedResult?.title || 'Generated Visual Canvas'}
                  </h3>
                  <p className="text-xs text-[#5C544E]">{generatedResult?.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAnimatingVideo((prev) => !prev)}
                  className={`min-h-[40px] px-4 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
                    isAnimatingVideo
                      ? 'bg-[#9E2A3B] text-[#FFFCF8]'
                      : 'bg-[#1F1830] text-[#F5EFE6] border border-[#D4AF37]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-[#D4AF37]">
                    {isAnimatingVideo ? 'stop' : 'movie'}
                  </span>
                  <span>{isAnimatingVideo ? 'Stop Animation' : 'Animate into Video'}</span>
                </button>
              </div>

              {/* Rendered Visual Container */}
              <div
                className={`w-full h-80 sm:h-96 rounded-3xl overflow-hidden bg-[#0F0C18] border border-[#D4AF37]/35 flex items-center justify-center p-4 relative transition-transform duration-500 ${
                  isAnimatingVideo ? 'scale-[1.02] shadow-[0_12px_40px_rgba(212,175,55,0.25)]' : ''
                }`}
              >
                {generatedResult?.svg ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: generatedResult.svg }}
                    className={`w-full h-full flex items-center justify-center transition-all duration-300 ${
                      isAnimatingVideo && videoFrame % 2 === 1 ? 'brightness-110 saturate-125' : ''
                    }`}
                  />
                ) : (
                  <div className="text-center text-xs text-[#8E8479]">
                    No artwork generated yet.
                  </div>
                )}

                {isAnimatingVideo && (
                  <div className="absolute bottom-4 left-4 right-4 p-2.5 rounded-2xl bg-[#0B0912]/85 backdrop-blur-md border border-[#D4AF37]/40 flex items-center justify-between text-xs text-[#F5EFE6]">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping" />
                      <span>Video Motion Reel · Frame {videoFrame + 1}/6</span>
                    </span>
                    <span className="text-[#D4AF37] font-mono">1080p · 24fps AI Simulated</span>
                  </div>
                )}
              </div>

              {/* Tags & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap gap-1.5">
                  {generatedResult?.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full bg-[#FAF1E6] text-[11px] text-[#8C6D1F] font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!generatedResult?.svg) return;
                      const blob = new Blob([generatedResult.svg], { type: 'image/svg+xml' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `saevy-art-${Date.now()}.svg`;
                      a.click();
                      URL.revokeObjectURL(url);
                      onShowToast('Downloaded vector SVG artwork');
                    }}
                    className="btn-luxury-outline px-4 text-xs font-medium flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Download SVG</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* MODE B: VOICE CONVERSATIONS & MULTILINGUAL VOICE COMMANDS */}
        {activeMode === 'voice_dialogue' && (
          <motion.div
            key="voice_dialogue"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            {/* 1. Multilingual Language Selector Strip */}
            <div className="luxury-card p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#D4AF37]">
                    translate
                  </span>
                  <h4 className="font-display font-bold text-sm sm:text-base text-[#0A0A0A]">
                    Talk to Saevy AI in Multiple Languages
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E3EFE3] text-[#3E6B4E]">
                    {selectedAiLanguage.name} Active
                  </span>
                </div>
                <span className="text-xs text-[#5C544E]">
                  Speech Recognition & Voice TTS adapts automatically
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {MULTILINGUAL_AI_LANGUAGES.map((lang) => {
                  const isSelected = selectedAiLangCode === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setSelectedAiLangCode(lang.code);
                        onShowToast(`Switched Saevy AI to ${lang.name} (${lang.nativeName})`);
                      }}
                      className={`min-h-[38px] px-3.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-[#0A0A0A] text-[#FFFCF8] shadow-sm border border-[#D4AF37]'
                          : 'bg-[#FFFCF8] text-[#5C544E] border border-[#F0E6DC] hover:border-[#D4AF37]/50 hover:text-[#0A0A0A]'
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.nativeName}</span>
                      <span className="text-[10px] opacity-75 font-normal">({lang.name})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Main Voice Interaction Console */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Column: Voice Commands & Microphone Hub */}
              <div className="lg:col-span-5 luxury-card p-6 flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-[#0A0A0A]">
                      Voice Command & Hands-Free
                    </h3>
                    {isSpeakingAudio && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D1FAE5] text-[#065F46] text-[11px] font-bold animate-pulse">
                        <span className="material-symbols-outlined text-[14px]">volume_up</span>
                        <span>Speaking</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5C544E] mt-0.5">
                    Tap the mic and speak any command or question in {selectedAiLanguage.name}.
                  </p>
                </div>

                {/* Central Interactive Microphone with Waveform Animation */}
                <div className="py-2 text-center space-y-3">
                  <div className="relative inline-flex items-center justify-center">
                    {voiceInput.status === 'listening' && (
                      <span className="absolute inset-0 rounded-full border-2 border-[#9E2A3B] animate-ping opacity-75" />
                    )}
                    {isSpeakingAudio && (
                      <span className="absolute inset-0 rounded-full border-2 border-[#10B981] animate-ping opacity-60" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (voiceInput.status === 'listening') {
                          voiceInput.stopListening();
                        } else {
                          stopAllSpeechSynthesis();
                          voiceInput.startListening();
                        }
                      }}
                      className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-[0_12px_36px_rgba(0,0,0,0.22)] active:scale-95 ${
                        voiceInput.status === 'listening'
                          ? 'bg-[#9E2A3B] text-[#FFFCF8] scale-105 ring-4 ring-[#9E2A3B]/30'
                          : isSpeakingAudio
                            ? 'bg-[#10B981] text-[#FFFFFF] scale-105 ring-4 ring-[#10B981]/30'
                            : 'bg-gradient-to-tr from-[#1F1830] via-[#2D2146] to-[#392955] text-[#F5EFE6] border-2 border-[#D4AF37]'
                      }`}
                      title={
                        voiceInput.status === 'listening'
                          ? 'Listening... Tap to stop'
                          : 'Tap to speak voice command'
                      }
                    >
                      <span className="material-symbols-outlined text-[38px] text-[#D4AF37]">
                        {voiceInput.status === 'listening'
                          ? 'mic'
                          : isSpeakingAudio
                            ? 'graphic_eq'
                            : 'mic_none'}
                      </span>
                    </button>
                  </div>

                  <div>
                    <div className="font-semibold text-xs text-[#0A0A0A]">
                      {voiceInput.status === 'listening'
                        ? `Listening in ${selectedAiLanguage.name}... Speak now`
                        : isSpeakingAudio
                          ? `Saevy AI speaking in ${selectedAiLanguage.name}...`
                          : isVoiceThinking
                            ? 'Reasoning & translating...'
                            : `Tap to speak in ${selectedAiLanguage.name}`}
                    </div>
                    <p className="text-[11px] text-[#5C544E]">
                      Locale: {selectedAiLanguage.recLang} · 12 Languages Live
                    </p>
                  </div>
                </div>

                {/* Quick 1-Tap Spoken Voice Commands */}
                <div className="space-y-2 pt-2 border-t border-[#F0E6DC]">
                  <span className="text-xs font-semibold text-[#0A0A0A] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-[#D4AF37]">
                      bolt
                    </span>
                    <span>1-Tap Voice Commands (or speak aloud):</span>
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {[
                      {
                        label: '📍 Nearest Safe Spot',
                        cmd: 'Find nearest safe spot and police booth',
                      },
                      {
                        label: '🚶‍♀️ Measure Walking Dist',
                        cmd: 'Measure walking distance and steps',
                      },
                      {
                        label: '📦 Find FedEx Locker',
                        cmd: 'Find FedEx and courier safe hubs',
                      },
                      {
                        label: '💧 Excess Water Check',
                        cmd: 'Check excess water and hydration',
                      },
                      {
                        label: '🚨 Emergency SOS',
                        cmd: 'Emergency SOS alert',
                      },
                      {
                        label: '🌿 Cramp Remedy @Home',
                        cmd: 'Natural kitchen home remedy for menstrual cramps',
                      },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setVoiceInputText(item.cmd);
                          void handleExecuteVoiceCommandOrQuery(item.cmd);
                        }}
                        className="p-2 rounded-xl bg-[#FFFCF8] hover:bg-[#FAF3EB] border border-[#F0E6DC] text-left text-[11px] text-[#0A0A0A] font-medium transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Persona Switcher */}
                <div className="space-y-2 pt-2 border-t border-[#F0E6DC]">
                  <span className="text-xs font-semibold text-[#0A0A0A]">
                    Companion Voice Persona:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    {SIX_FEMALE_AI_VOICES.map((v) => {
                      const active = selectedVoiceId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVoiceId(v.id)}
                          className={`p-2 rounded-xl border text-left transition-all ${
                            active
                              ? 'bg-[#1F1830] text-[#F5EFE6] border-[#D4AF37]'
                              : 'bg-[#FFFCF8] text-[#5C544E] border-[#F0E6DC]'
                          }`}
                        >
                          <div className="font-bold text-[11px] truncate">{v.name}</div>
                          <div className="text-[10px] opacity-75 truncate">{v.role.slice(0, 14)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Spoken Dialogue & Live Audio Replay */}
              <div className="lg:col-span-7 luxury-card p-6 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#F0E6DC]">
                  <div>
                    <h3 className="font-display text-lg font-bold text-[#0A0A0A]">
                      Multilingual Spoken Conversation
                    </h3>
                    <p className="text-xs text-[#5C544E]">
                      Real-time translation & voice command feedback in {selectedAiLanguage.name}.
                    </p>
                  </div>

                  {lastExecutedCommand && (
                    <span className="px-3 py-1 rounded-full bg-[#D1FAE5] text-[#065F46] border border-[#10B981]/40 text-xs font-bold">
                      ⚡ {lastExecutedCommand}
                    </span>
                  )}
                </div>

                <div className="space-y-4 my-2 flex-1">
                  {/* User Bubble */}
                  <div className="p-4 rounded-2xl bg-[#FFFCF8] border border-[#F0E6DC] space-y-1 shadow-sm">
                    <span className="text-[11px] font-semibold text-[#8C6D1F] uppercase tracking-wider flex items-center gap-1.5">
                      <span>You (Spoken / Typed)</span>
                      <span className="text-[10px] text-[#5C544E] font-normal">
                        [{selectedAiLanguage.name}]
                      </span>
                    </span>
                    <p className="text-xs sm:text-sm text-[#0A0A0A] leading-relaxed">
                      {voiceInputText ||
                        `Speak into the mic or try saying: "${selectedAiLanguage.samplePrompt}"`}
                    </p>
                  </div>

                  {/* AI Spoken Bubble */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1B142E] to-[#261B3D] border border-[#D4AF37]/50 text-[#F5EFE6] space-y-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" />
                        <span>
                          Saevy AI ({selectedVoiceId}) · {selectedAiLanguage.flag}{' '}
                          {selectedAiLanguage.nativeName}
                        </span>
                      </span>

                      <div className="flex items-center gap-2">
                        {isVoiceThinking && (
                          <span className="text-xs text-[#D4AF37] animate-pulse">
                            Translating & Thinking...
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const voiceObj =
                              SIX_FEMALE_AI_VOICES.find((v) => v.id === selectedVoiceId) ||
                              SIX_FEMALE_AI_VOICES[0];
                            void speakMultilingualReply(aiVoiceReply, selectedAiLanguage, voiceObj);
                          }}
                          className="px-3 py-1 rounded-full bg-[#FFFCF8]/15 hover:bg-[#FFFCF8]/25 text-[#F5EFE6] border border-[#D4AF37]/40 text-xs font-medium flex items-center gap-1 transition-colors"
                          title="Replay Voice Speech"
                        >
                          <span className="material-symbols-outlined text-[15px] text-[#D4AF37]">
                            volume_up
                          </span>
                          <span>Replay</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-[#F5EFE6] leading-relaxed">
                      {aiVoiceReply}
                    </p>
                  </div>
                </div>

                {/* Text fallback input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleExecuteVoiceCommandOrQuery(voiceInputText);
                  }}
                  className="flex items-center gap-2 pt-2 border-t border-[#F0E6DC]"
                >
                  <input
                    type="text"
                    value={voiceInputText}
                    onChange={(e) => setVoiceInputText(e.target.value)}
                    placeholder={`Type voice command or prompt in ${selectedAiLanguage.name}...`}
                    className="flex-1 min-h-[44px] px-4 rounded-full bg-[#FFFCF8] border border-[#F0E6DC] text-xs sm:text-sm text-[#0A0A0A] focus:outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    type="submit"
                    disabled={isVoiceThinking}
                    className="btn-luxury px-5 text-xs font-semibold shrink-0"
                  >
                    Execute
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}

        {/* MODE C: THREE.JS 3D SCENE */}
        {activeMode === 'threejs_3d' && (
          <motion.div
            key="threejs_3d"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            <div className="lg:col-span-8 rounded-[28px] bg-gradient-to-br from-[#120D1F] via-[#0E0A1A] to-[#05030A] border border-[#D4AF37]/45 p-6 relative overflow-hidden flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between z-10">
                <div>
                  <h3 className="font-display text-xl font-bold text-[#F5EFE6]">
                    WebGL Three.js 3D Sanctuary Shield
                  </h3>
                  <p className="text-xs text-[#B9AEBE]">
                    Interactive real-time 3D rendered geometry with particles & orbital rotation.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setThreeRunning((prev) => !prev)}
                    className="min-h-[38px] px-3.5 rounded-full bg-[#201833] border border-[#3A2C5A] text-xs text-[#F5EFE6] flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#D4AF37]">
                      {threeRunning ? 'pause' : 'play_arrow'}
                    </span>
                    <span>{threeRunning ? 'Pause Rotation' : 'Resume'}</span>
                  </button>
                </div>
              </div>

              {/* Three.js Canvas Container */}
              <div
                ref={threeMountRef}
                className="w-full h-80 sm:h-[420px] my-3 rounded-2xl flex items-center justify-center cursor-grab active:cursor-grabbing"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 z-10 pt-2 border-t border-[#261E38] text-xs text-[#B9AEBE]">
                <span>Render Engine: Three.js r170 · PerspectiveCamera 45° · MeshStandardMaterial</span>
                <span className="text-[#D4AF37] font-semibold">Live GPU Acceleration Active</span>
              </div>
            </div>

            {/* 3D Controls & Physics Properties */}
            <div className="lg:col-span-4 luxury-card p-6 space-y-5">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0A0A0A]">
                  3D Shield Customizer
                </h3>
                <p className="text-xs text-[#5C544E] mt-0.5">
                  Tweak geometry aura and energetic shielding frequencies.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-[#0A0A0A]">
                  Aura Resonance Color
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setShieldColor('gold')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 ${
                      shieldColor === 'gold'
                        ? 'bg-[#1F1830] text-[#D4AF37] border-[#D4AF37]'
                        : 'bg-[#FFFCF8] text-[#5C544E] border-[#F0E6DC]'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
                    <span>Gold</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShieldColor('rose')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 ${
                      shieldColor === 'rose'
                        ? 'bg-[#1F1830] text-[#B76E79] border-[#B76E79]'
                        : 'bg-[#FFFCF8] text-[#5C544E] border-[#F0E6DC]'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B76E79]" />
                    <span>Rose</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShieldColor('emerald')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 ${
                      shieldColor === 'emerald'
                        ? 'bg-[#1F1830] text-[#34D399] border-[#34D399]'
                        : 'bg-[#FFFCF8] text-[#5C544E] border-[#F0E6DC]'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" />
                    <span>Safe</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF1E6] border border-[#F0E6DC] space-y-2">
                <span className="text-xs font-semibold text-[#0A0A0A]">3D Geometry Breakdown:</span>
                <ul className="text-xs text-[#5C544E] space-y-1.5">
                  <li>• Core: Dodecahedron (12 pentagonal faces of protection)</li>
                  <li>• Orbital: Torus Ring (Infinite boundary boundary)</li>
                  <li>• Halo: 180 Celestial Particles (Spatial geofence boundary)</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  onShowToast('Calibrated 3D Quantum Protective Field');
                }}
                className="btn-luxury w-full text-xs font-medium flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[17px] text-[#D4AF37]">shield</span>
                <span>Calibrate Protective Field</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* MODE D: BIOSCIENCE & DOCTOR GUIDANCE */}
        {activeMode === 'bioscience' && (
          <motion.div
            key="bioscience"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            <div className="lg:col-span-4 luxury-card p-6 space-y-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0A0A0A]">
                  Doctor Bioscience Knowledge
                </h3>
                <p className="text-xs text-[#5C544E] mt-0.5">
                  Cellular hydration, symptom triage & clinical checks.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#0A0A0A]">Common Inquiries:</span>
                {[
                  'Excess water retention vs proper hydration',
                  'Electrolyte imbalance symptoms',
                  'Menstrual cramp physiological relief',
                  'Safe kitchen infusions for respiratory immunity',
                ].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setSymptomQuery(item);
                      onShowToast(`Loaded ${item} clinical insights`);
                    }}
                    className={`w-full p-3 rounded-2xl border text-left text-xs transition-colors ${
                      symptomQuery === item
                        ? 'bg-[#1F1830] text-[#F5EFE6] border-[#D4AF37]'
                        : 'bg-[#FFFCF8] text-[#5C544E] border-[#F0E6DC] hover:border-[#D4AF37]/60'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-[#EFE9DF] border border-[#D6C9B8] space-y-1.5 text-xs text-[#5C544E]">
                <strong className="text-[#0A0A0A]">Physician Safety Note:</strong>
                <p>
                  Educational references only. Never ignore persistent pain, high fever, or severe chest discomfort.
                </p>
              </div>
            </div>

            {/* Bioscience Results */}
            <div className="lg:col-span-8 luxury-card p-6 space-y-5">
              <div className="pb-3 border-b border-[#F0E6DC] flex items-center justify-between">
                <div>
                  <h3 className="font-display text-xl font-bold text-[#0A0A0A]">
                    {bioscienceAdvice.topic}
                  </h3>
                  <span className="text-xs text-[#8C6D1F] font-medium">
                    Verified Bioscience Reference
                  </span>
                </div>
                <span className="material-symbols-outlined text-[24px] text-[#D4AF37]">
                  medical_services
                </span>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[#0A0A0A] uppercase tracking-wider">
                  Cellular Mechanism & Physiology
                </h4>
                <p className="text-xs sm:text-sm text-[#5C544E] leading-relaxed">
                  {bioscienceAdvice.cellularSummary}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#FFFCF8] border border-[#F0E6DC] space-y-2">
                  <h5 className="text-xs font-semibold text-[#0A0A0A] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#3E6B4E]">
                      check_circle
                    </span>
                    <span>Clinical Safety Checklist</span>
                  </h5>
                  <ul className="text-xs text-[#5C544E] space-y-1.5 leading-relaxed">
                    {bioscienceAdvice.doctorChecklist.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF1E6] border border-[#F0E6DC] space-y-2">
                  <h5 className="text-xs font-semibold text-[#0A0A0A] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#D4AF37]">spa</span>
                    <span>Gentle @Home Remedies</span>
                  </h5>
                  <ul className="text-xs text-[#5C544E] space-y-1.5 leading-relaxed">
                    {bioscienceAdvice.remedySteps.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Red Flags Banner */}
              <div className="p-4 rounded-2xl bg-[#FBF0F1] border border-[#E9C3C7] space-y-2">
                <h5 className="text-xs font-bold text-[#9E2A3B] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  <span>Red-Flag Symptoms (When to Consult MD Immediately)</span>
                </h5>
                <ul className="text-xs text-[#9E2A3B] space-y-1">
                  {bioscienceAdvice.redFlags.map((rf, i) => (
                    <li key={i}>• {rf}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {/* MODE E: CALMING AUDIO & MUSIC TONES */}
        {activeMode === 'music_calm' && (
          <motion.div
            key="music_calm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="luxury-card p-6 sm:p-8 space-y-6"
          >
            <div>
              <h3 className="font-display text-xl font-bold text-[#0A0A0A]">
                Saevy Acoustic Frequency & Calming Generator
              </h3>
              <p className="text-xs text-[#5C544E] mt-0.5">
                Real-time harmonic sound waves synthesized via Web Audio API to alleviate panic, stress, and acute anxiety.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  hz: 432,
                  name: '432 Hz Miracle Tone',
                  desc: 'Reduces cortisol, slows heart rate, calms mental stress.',
                  badge: 'Heart Coherence',
                },
                {
                  hz: 528,
                  name: '528 Hz Solfeggio',
                  desc: 'Promotes deep tissue recovery and parasympathetic nervous activation.',
                  badge: 'Cellular Vitality',
                },
                {
                  hz: 174,
                  name: '174 Hz Foundation',
                  desc: 'Relieves physical tension and promotes grounding in sudden stress.',
                  badge: 'Somatic Relief',
                },
                {
                  hz: 285,
                  name: '285 Hz Quantum Field',
                  desc: 'Aura realignment and restorative cognitive composure.',
                  badge: 'Sanctuary Field',
                },
              ].map((freq) => {
                const isPlaying = activeFrequency === freq.hz;
                return (
                  <div
                    key={freq.hz}
                    className={`p-5 rounded-3xl border transition-all space-y-3 flex flex-col justify-between ${
                      isPlaying
                        ? 'bg-[#1B142E] text-[#F5EFE6] border-[#D4AF37] shadow-[0_12px_36px_rgba(212,175,55,0.22)]'
                        : 'bg-[#FFFCF8] text-[#0A0A0A] border-[#F0E6DC] hover:border-[#D4AF37]/60'
                    }`}
                  >
                    <div className="space-y-1">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${
                          isPlaying
                            ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                            : 'bg-[#FAF1E6] text-[#8C6D1F]'
                        }`}
                      >
                        {freq.badge}
                      </span>
                      <h4 className="font-display text-base font-bold">{freq.name}</h4>
                      <p
                        className={`text-xs leading-relaxed ${
                          isPlaying ? 'text-[#B9AEBE]' : 'text-[#5C544E]'
                        }`}
                      >
                        {freq.desc}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleCalmFrequency(freq.hz)}
                      className={`min-h-[42px] px-4 rounded-full text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        isPlaying
                          ? 'bg-[#9E2A3B] text-[#FFFCF8]'
                          : 'bg-[#0A0A0A] text-[#FFFCF8] border border-[#D4AF37]/50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isPlaying ? 'stop_circle' : 'play_arrow'}
                      </span>
                      <span>{isPlaying ? 'Stop Frequency' : 'Play Frequency'}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF1E6] border border-[#F0E6DC] flex items-center justify-between text-xs text-[#5C544E]">
              <span>Audio Synthesis: Pure Sine Wave Oscillator · Zero latency streaming</span>
              <button
                type="button"
                onClick={() => {
                  if (activeFrequency) toggleCalmFrequency(activeFrequency);
                }}
                className="underline hover:text-[#0A0A0A]"
              >
                Mute All Frequencies
              </button>
            </div>
          </motion.div>
        )}

        {/* MODE F: GOOGLE SEARCH GROUNDING */}
        {activeMode === 'google_search' && (
          <motion.div
            key="google_search"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="luxury-card p-6 sm:p-8 space-y-6"
          >
            <div>
              <h3 className="font-display text-xl font-bold text-[#0A0A0A]">
                Google Grounded Safety Knowledge
              </h3>
              <p className="text-xs text-[#5C544E] mt-0.5">
                Real-time verified legal protections, emergency numbers, and emergency transit advice.
              </p>
            </div>

            <form onSubmit={handleExecuteSearch} className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined text-[18px] text-[#D4AF37] absolute left-4 top-1/2 -translate-y-1/2">
                  search
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask any legal or safety verification (Zero-FIR, Women Helpline, Transit Safety)..."
                  className="w-full min-h-[48px] pl-11 pr-4 rounded-full bg-[#FFFCF8] border border-[#F0E6DC] text-xs sm:text-sm text-[#0A0A0A] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              <button
                type="submit"
                disabled={searchLoading}
                className="btn-luxury px-6 text-xs font-semibold shrink-0"
              >
                {searchLoading ? 'Searching...' : 'Search Google Data'}
              </button>
            </form>

            {searchResult && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-[#FFFCF8] border border-[#D4AF37]/50 space-y-2">
                  <span className="text-[11px] font-semibold text-[#8C6D1F] uppercase tracking-wider">
                    Executive Knowledge Summary
                  </span>
                  <p className="text-xs sm:text-sm text-[#0A0A0A] leading-relaxed">
                    {searchResult.summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-[#FAF1E6] border border-[#F0E6DC] space-y-2">
                    <h5 className="text-xs font-semibold text-[#0A0A0A]">Verified Helpline Data</h5>
                    <ul className="text-xs text-[#5C544E] space-y-1.5">
                      {searchResult.facts.map((f, i) => (
                        <li key={i}>• {f}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAF1E6] border border-[#F0E6DC] space-y-2">
                    <h5 className="text-xs font-semibold text-[#0A0A0A]">Actionable Legal Checklist</h5>
                    <ul className="text-xs text-[#5C544E] space-y-1.5">
                      {searchResult.checklist.map((c, i) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
