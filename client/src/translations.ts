export type Language = 'en' | 'kn' | 'te'

export const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
]

// 1. Define the shape of your translation structure
export type Translation = {
  brandTagline: string
  cases: string
  lightMode: string
  darkMode: string
  tabs: {
    map: string
    network: string
    resolution: string
    cases: string
    assistant: string
    analytics: string
    ai: string
  }
  liveStats: string
  filters: string
  crimeType: string
  minSeverity: string
  timeOfDay: string
  mlTuning: string
  eps: string
  minSamples: string
  showDensity: string
  runAnalysis: string
  runningAnalysis: string
  runningClustering: string
  filtered: string
  total: string
  hotspots: string
  open: string
  openCase: string
  closed: string
  underInvestigation: string
  populationDensity: string
  aiHotspot: string
  denseZones: (n: number) => string
}

// 2. Enforce the Translation interface across all languages in the object
export const translations: Record<Language, Translation> = {
  en: {
    brandTagline: 'AI-Powered Criminal Network Analysis',
    cases: 'cases',
    lightMode: 'Light',
    darkMode: 'Dark',
    tabs: {
      map: 'Geospatial Map',
      network: 'Criminal Network',
      resolution: 'Entity Resolution',
      cases: 'Case Management',
      assistant: 'Crime Assistant',
      analytics: 'Analytics',
      ai: 'AI Insights',
    },
    liveStats: 'Live Stats',
    filters: 'Filters',
    crimeType: 'Crime Type',
    minSeverity: 'Minimum Severity',
    timeOfDay: 'Time of Day',
    mlTuning: 'ML Tuning',
    eps: 'Eps',
    minSamples: 'Min Samples',
    showDensity: 'Show Population Density',
    runAnalysis: '🔍 Run AI Analysis',
    runningAnalysis: 'Running Analysis...',
    runningClustering: 'Running DBSCAN clustering...',
    filtered: 'Filtered',
    total: 'Total',
    hotspots: 'Hotspots',
    open: 'Open',
    openCase: 'Open Case',
    closed: 'Closed',
    underInvestigation: 'Under Investigation',
    populationDensity: 'Population Density',
    aiHotspot: 'AI Hotspot',
    denseZones: (n: number) => `${n} dense zone${n !== 1 ? 's' : ''} detected`,
  },
  kn: {
    brandTagline: 'ಎಐ ಅಪರಾಧ ಜಾಲ ವಿಶ್ಲೇಷಣೆ',
    cases: 'ಪ್ರಕರಣಗಳು',
    lightMode: 'ಬೆಳಕು',
    darkMode: 'ಕತ್ತಲು',
    tabs: {
      map: 'ಭೌಗೋಳಿಕ ನಕ್ಷೆ',
      network: 'ಅಪರಾಧ ಜಾಲ',
      resolution: 'ಘಟಕ ಪರಿಹಾರ',
      cases: 'ಪ್ರಕರಣ ನಿರ್ವಹಣೆ',
      assistant: 'ಅಪರಾಧ ಸಹಾಯಕ',
      analytics: 'ವಿಶ್ಲೇಷಣೆ',
      ai: 'ಎಐ ಒಳನೋಟಗಳು',
    },
    liveStats: 'ನೇರ ಅಂಕಿಅಂಶಗಳು',
    filters: 'ಫಿಲ್ಟರ್‌ಗಳು',
    crimeType: 'ಅಪರಾಧದ ವಿಧ',
    minSeverity: 'ಕನಿಷ್ಠ ತೀವ್ರತೆ',
    timeOfDay: 'ದಿನದ ಸಮಯ',
    mlTuning: 'ಎಂಎಲ್ ಟ್ಯೂನಿಂಗ್',
    eps: 'ಎಪ್ಸ್',
    minSamples: 'ಕನಿಷ್ಠ ಮಾದರಿಗಳು',
    showDensity: 'ಜನಸಂಖ್ಯಾ ಸಾಂದ್ರತೆ ತೋರಿಸಿ',
    runAnalysis: '🔍 ಎಐ ವಿಶ್ಲೇಷಣೆ ಚಲಾಯಿಸಿ',
    runningAnalysis: 'ವಿಶ್ಲೇಷಣೆ ನಡೆಯುತ್ತಿದೆ...',
    runningClustering: 'DBSCAN ಕ್ಲಸ್ಟರಿಂಗ್ ನಡೆಯುತ್ತಿದೆ...',
    filtered: 'ಫಿಲ್ಟರ್ ಮಾಡಲಾಗಿದೆ',
    total: 'ಒಟ್ಟು',
    hotspots: 'ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು',
    open: 'ತೆರೆದಿದೆ',
    openCase: 'ತೆರೆದ ಪ್ರಕರಣ',
    closed: 'ಮುಚ್ಚಲಾಗಿದೆ',
    underInvestigation: 'ತನಿಖೆಯಲ್ಲಿದೆ',
    populationDensity: 'ಜನಸಂಖ್ಯಾ ಸಾಂದ್ರತೆ',
    aiHotspot: 'ಎಐ ಹಾಟ್‌ಸ್ಪಾಟ್',
    denseZones: (n: number) => `${n} ದಟ್ಟ ವಲಯ${n !== 1 ? 'ಗಳು' : ''} ಪತ್ತೆಯಾಗಿದೆ`,
  },
  te: {
    brandTagline: 'ఏఐ నేర నెట్‌వర్క్ విశ్లేషణ',
    cases: 'కేసులు',
    lightMode: 'లైట్',
    darkMode: 'డార్క్',
    tabs: {
      map: 'జియోస్పేషియల్ మ్యాప్',
      network: 'నేర నెట్‌వర్క్',
      resolution: 'ఎంటిటీ రిజల్యూషన్',
      cases: 'కేస్ మేనేజ్‌మెంట్',
      assistant: 'క్రైమ్ అసిస్టెంట్',
      analytics: 'అనలిటిక్స్',
      ai: 'ఏఐ ఇన్‌సైట్స్',
    },
    liveStats: 'లైవ్ స్టాట్స్',
    filters: 'ఫిల్టర్‌లు',
    crimeType: 'నేర రకం',
    minSeverity: 'కనీస తీవ్రత',
    timeOfDay: 'రోజు సమయం',
    mlTuning: 'ఎంఎల్ ట్యూనింగ్',
    eps: 'ఎప్స్',
    minSamples: 'కనీస నమూనాలు',
    showDensity: 'జనసాంద్రతను చూపించు',
    runAnalysis: '🔍 ఏఐ విశ్లేషణ రన్ చేయండి',
    runningAnalysis: 'విశ్లేషణ నడుస్తోంది...',
    runningClustering: 'DBSCAN క్లస్టరింగ్ నడుస్తోంది...',
    filtered: 'ఫిల్టర్ చేయబడింది',
    total: 'మొత్తం',
    hotspots: 'హాట్‌స్పాట్‌లు',
    open: 'ఓపెన్',
    openCase: 'ఓపెన్ కేసు',
    closed: 'మూసివేయబడింది',
    underInvestigation: 'దర్యాప్తులో ఉంది',
    populationDensity: 'జనసాంద్రత',
    aiHotspot: 'ఏఐ హాట్‌స్పాట్',
    denseZones: (n: number) => `${n} దట్టమైన జోన్${n !== 1 ? 'లు' : ''} గుర్తించబడింది`,
  },
}